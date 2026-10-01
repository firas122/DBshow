import { getLinterText, type LinterText } from "@/lib/i18n/linterText";
import type { Locale } from "@/lib/i18n/locale";
import { areTypesCompatible, familyLabel } from "@/lib/schema/types-util";
import type {
  Column,
  HealthSummary,
  Relation,
  SchemaGraph,
  SchemaWarning,
  Table,
  WarningSeverity,
} from "@/lib/types";

/**
 * Static analysis over a SchemaGraph. Runs on every parse and attaches warnings
 * to the graph, to individual tables and to individual relations so the 3D scene
 * can colour nodes and edges straight from the model.
 */

const SEVERITY_WEIGHT: Record<WarningSeverity, number> = {
  error: 12,
  warning: 5,
  info: 1,
};

function singularize(word: string): string {
  if (/ies$/i.test(word)) return `${word.slice(0, -3)}y`;
  if (/(ses|xes|zes|ches|shes)$/i.test(word)) return word.slice(0, -2);
  if (/s$/i.test(word) && !/ss$/i.test(word)) return word.slice(0, -1);
  return word;
}

function pluralize(word: string): string {
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

function quoteIdent(name: string): string {
  return /^[a-z_][a-z0-9_]*$/i.test(name) ? name : `"${name}"`;
}

function attach(graph: SchemaGraph, warning: SchemaWarning, table?: Table, relation?: Relation) {
  graph.warnings.push(warning);
  if (table) table.warnings.push(warning);
  if (relation) relation.warnings.push(warning);
}

/** Directed dependency edges: child table -> parent table. */
function buildAdjacency(graph: SchemaGraph): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const table of graph.tables) adjacency.set(table.id, new Set());
  for (const relation of graph.relations) {
    if (relation.dangling) continue;
    adjacency.get(relation.sourceTable)?.add(relation.targetTable);
  }
  return adjacency;
}

/**
 * Enumerates simple cycles with a hard cap — schemas are small, but a dense
 * graph can have combinatorially many cycles and we only need examples.
 */
function findCycles(adjacency: Map<string, Set<string>>, maxCycles = 12, maxDepth = 12): string[][] {
  const cycles: string[][] = [];
  const seen = new Set<string>();

  const canonical = (cycle: string[]): string => {
    const lowest = cycle.indexOf([...cycle].sort()[0]);
    return [...cycle.slice(lowest), ...cycle.slice(0, lowest)].join(">");
  };

  const walk = (start: string, node: string, path: string[], onPath: Set<string>) => {
    if (cycles.length >= maxCycles || path.length > maxDepth) return;
    for (const next of adjacency.get(node) ?? []) {
      if (next === start) {
        const key = canonical(path);
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push([...path]);
        }
        continue;
      }
      // Only walk forward to nodes ordered after the start, which visits each
      // cycle from exactly one entry point.
      if (next < start || onPath.has(next)) continue;
      onPath.add(next);
      path.push(next);
      walk(start, next, path, onPath);
      path.pop();
      onPath.delete(next);
    }
  };

  for (const node of [...adjacency.keys()].sort()) {
    walk(node, node, [node], new Set([node]));
    if (cycles.length >= maxCycles) break;
  }
  return cycles;
}

function checkDanglingReferences(graph: SchemaGraph, tablesById: Map<string, Table>, L: LinterText) {
  for (const relation of graph.relations) {
    if (!relation.dangling) continue;

    const sourceTable = tablesById.get(relation.sourceTable);
    const targetTable = tablesById.get(relation.targetTable);
    const missingTable = !targetTable;

    const source = `${relation.sourceTable}.${relation.sourceColumn}`;
    const target = `${relation.targetTable}.${relation.targetColumn || "?"}`;
    attach(
      graph,
      {
        id: `dangling:${relation.id}`,
        kind: "dangling-reference",
        severity: "error",
        title: L.dangling.title,
        message: missingTable
          ? L.dangling.messageMissingTable(source, relation.targetTable)
          : L.dangling.messageMissingColumn(source, target, relation.targetTable),
        suggestion: missingTable
          ? L.dangling.suggestionMissingTable(relation.targetTable)
          : L.dangling.suggestionMissingColumn(relation.targetTable),
        fix: sourceTable
          ? `ALTER TABLE ${quoteIdent(sourceTable.name)} DROP CONSTRAINT fk_${relation.sourceTable}_${relation.sourceColumn};`
          : undefined,
        tableIds: [relation.sourceTable, relation.targetTable],
        columnName: relation.sourceColumn,
        relationId: relation.id,
      },
      sourceTable,
      relation,
    );
  }
}

function checkTypeMismatches(graph: SchemaGraph, tablesById: Map<string, Table>, L: LinterText) {
  for (const relation of graph.relations) {
    if (relation.dangling || relation.kind !== "explicit") continue;

    const sourceTable = tablesById.get(relation.sourceTable);
    const targetTable = tablesById.get(relation.targetTable);
    const sourceColumn = sourceTable?.columns.find((c) => c.name === relation.sourceColumn);
    const targetColumn = targetTable?.columns.find((c) => c.name === relation.targetColumn);
    if (!sourceTable || !targetTable || !sourceColumn || !targetColumn) continue;

    if (!areTypesCompatible(sourceColumn.family, targetColumn.family)) {
      attach(
        graph,
        {
          id: `type-mismatch:${relation.id}`,
          kind: "type-mismatch",
          severity: "warning",
          title: L.typeMismatch.title,
          message: L.typeMismatch.message(
            sourceTable.name,
            sourceColumn.name,
            sourceColumn.rawType,
            familyLabel(sourceColumn.family),
            targetTable.name,
            targetColumn.name,
            targetColumn.rawType,
            familyLabel(targetColumn.family),
          ),
          suggestion: L.typeMismatch.suggestion,
          fix: `ALTER TABLE ${quoteIdent(sourceTable.name)} ALTER COLUMN ${quoteIdent(
            sourceColumn.name,
          )} TYPE ${targetColumn.rawType};`,
          tableIds: [sourceTable.id, targetTable.id],
          columnName: sourceColumn.name,
          relationId: relation.id,
        },
        sourceTable,
        relation,
      );
      continue;
    }

    // Same family but a narrower declared width still truncates real keys.
    if (
      sourceColumn.family === "text" &&
      targetColumn.family === "text" &&
      sourceColumn.length !== undefined &&
      targetColumn.length !== undefined &&
      sourceColumn.length < targetColumn.length
    ) {
      attach(
        graph,
        {
          id: `type-width:${relation.id}`,
          kind: "type-mismatch",
          severity: "info",
          title: L.typeNarrower.title,
          message: L.typeNarrower.message(
            sourceTable.name,
            sourceColumn.name,
            sourceColumn.length,
            targetTable.name,
            targetColumn.name,
            targetColumn.length,
          ),
          suggestion: L.typeNarrower.suggestion(targetColumn.rawType),
          fix: `ALTER TABLE ${quoteIdent(sourceTable.name)} ALTER COLUMN ${quoteIdent(
            sourceColumn.name,
          )} TYPE ${targetColumn.rawType};`,
          tableIds: [sourceTable.id, targetTable.id],
          columnName: sourceColumn.name,
          relationId: relation.id,
        },
        sourceTable,
        relation,
      );
    }
  }
}

function checkMissingIndexes(graph: SchemaGraph, tablesById: Map<string, Table>, L: LinterText) {
  for (const relation of graph.relations) {
    if (relation.dangling || relation.kind !== "explicit") continue;
    const table = tablesById.get(relation.sourceTable);
    const column = table?.columns.find((c) => c.name === relation.sourceColumn);
    if (!table || !column || column.isIndexed) continue;

    attach(
      graph,
      {
        id: `missing-index:${relation.id}`,
        kind: "missing-index",
        severity: "warning",
        title: L.missingIndex.title,
        message: L.missingIndex.message(table.name, column.name),
        suggestion: L.missingIndex.suggestion,
        fix: `CREATE INDEX idx_${table.id}_${column.name.toLowerCase()} ON ${quoteIdent(
          table.name,
        )} (${quoteIdent(column.name)});`,
        tableIds: [table.id, relation.targetTable],
        columnName: column.name,
        relationId: relation.id,
      },
      table,
      relation,
    );
  }
}

interface ImplicitCandidate {
  relation: Relation;
  warning: SchemaWarning;
}

function checkImplicitForeignKeys(
  graph: SchemaGraph,
  tablesById: Map<string, Table>,
  L: LinterText,
): ImplicitCandidate[] {
  const explicitKeys = new Set(
    graph.relations.map((r) => `${r.sourceTable}.${r.sourceColumn.toLowerCase()}`),
  );
  const candidates: ImplicitCandidate[] = [];

  const resolveTable = (base: string): Table | undefined => {
    const attempts = new Set<string>([
      base,
      pluralize(base),
      singularize(base),
      pluralize(singularize(base)),
    ]);
    // `shipping_address_id` should still find an `addresses` table.
    const lastSegment = base.split("_").pop();
    if (lastSegment && lastSegment !== base) {
      attempts.add(lastSegment);
      attempts.add(pluralize(lastSegment));
      attempts.add(singularize(lastSegment));
    }
    for (const attempt of attempts) {
      const found = tablesById.get(attempt.toLowerCase());
      if (found) return found;
    }
    return undefined;
  };

  const namePatterns = [/^(.*?)_id$/i, /^(.*?)_key$/i, /^(.*?)_fk$/i, /^(.*?)Id$/, /^id_(.*)$/i];

  for (const table of graph.tables) {
    for (const column of table.columns) {
      if (column.isPrimaryKey) continue;
      if (explicitKeys.has(`${table.id}.${column.name.toLowerCase()}`)) continue;

      let base = "";
      for (const pattern of namePatterns) {
        const match = column.name.match(pattern);
        if (match?.[1]) {
          base = match[1];
          break;
        }
      }
      if (!base) continue;

      const target = resolveTable(base);
      if (!target || target.id === table.id) continue;

      const targetColumn =
        target.columns.find((c) => c.isPrimaryKey) ??
        target.columns.find((c) => c.name.toLowerCase() === "id");
      if (!targetColumn) continue;

      const relation: Relation = {
        id: `${table.id}.${column.name.toLowerCase()}->${target.id}.${targetColumn.name.toLowerCase()}:implicit`,
        sourceTable: table.id,
        sourceColumn: column.name,
        targetTable: target.id,
        targetColumn: targetColumn.name,
        kind: "implicit",
        warnings: [],
        health: "warning",
      };

      const typesAgree = areTypesCompatible(column.family, targetColumn.family);
      const warning: SchemaWarning = {
        id: `implicit-fk:${relation.id}`,
        kind: "implicit-fk",
        severity: "warning",
        title: L.implicitFk.title,
        message: L.implicitFk.message(table.name, column.name, target.name, targetColumn.name, !typesAgree),
        suggestion: L.implicitFk.suggestion,
        fix: `ALTER TABLE ${quoteIdent(table.name)} ADD CONSTRAINT fk_${table.id}_${column.name.toLowerCase()}\n  FOREIGN KEY (${quoteIdent(
          column.name,
        )}) REFERENCES ${quoteIdent(target.name)} (${quoteIdent(targetColumn.name)});`,
        tableIds: [table.id, target.id],
        columnName: column.name,
        relationId: relation.id,
      };

      candidates.push({ relation, warning });
    }
  }

  return candidates;
}

function checkCircularDependencies(graph: SchemaGraph, tablesById: Map<string, Table>, L: LinterText) {
  const adjacency = buildAdjacency(graph);
  const cycles = findCycles(adjacency);

  const nullableOnPath = (cycle: string[]): boolean =>
    cycle.some((tableId, index) => {
      const nextId = cycle[(index + 1) % cycle.length];
      return graph.relations.some((relation) => {
        if (relation.sourceTable !== tableId || relation.targetTable !== nextId) return false;
        const column = tablesById
          .get(tableId)
          ?.columns.find((c) => c.name === relation.sourceColumn);
        return column?.isNullable ?? false;
      });
    });

  for (const cycle of cycles) {
    const names = cycle.map((id) => tablesById.get(id)?.name ?? id);
    const isSelfReference = cycle.length === 1;
    const breakable = nullableOnPath(cycle);
    const path = [...names, names[0]].join(" → ");

    const warning: SchemaWarning = {
      id: `cycle:${cycle.join(">")}`,
      kind: "circular-dependency",
      severity: isSelfReference ? "info" : breakable ? "warning" : "error",
      title: isSelfReference ? L.circular.titleSelf : L.circular.titleCycle,
      message: isSelfReference ? L.circular.messageSelf(names[0]) : L.circular.messageCycle(path),
      suggestion: isSelfReference
        ? L.circular.suggestionSelf
        : breakable
          ? L.circular.suggestionBreakable
          : L.circular.suggestionUnbreakable,
      tableIds: cycle,
    };

    graph.warnings.push(warning);
    for (const tableId of cycle) tablesById.get(tableId)?.warnings.push(warning);

    // Colour every edge that participates in the cycle.
    for (let index = 0; index < cycle.length; index += 1) {
      const from = cycle[index];
      const to = cycle[(index + 1) % cycle.length];
      for (const relation of graph.relations) {
        if (relation.sourceTable === from && relation.targetTable === to) {
          relation.warnings.push(warning);
        }
      }
    }
  }
}

function checkTableHygiene(graph: SchemaGraph, L: LinterText) {
  const connected = new Set<string>();
  for (const relation of graph.relations) {
    connected.add(relation.sourceTable);
    if (!relation.dangling) connected.add(relation.targetTable);
  }

  for (const table of graph.tables) {
    if (!table.columns.some((c: Column) => c.isPrimaryKey)) {
      const warning: SchemaWarning = {
        id: `no-pk:${table.id}`,
        kind: "no-primary-key",
        severity: "warning",
        title: L.noPrimaryKey.title,
        message: L.noPrimaryKey.message(table.name),
        suggestion: L.noPrimaryKey.suggestion,
        fix: `ALTER TABLE ${quoteIdent(table.name)} ADD PRIMARY KEY (${quoteIdent(
          table.columns[0]?.name ?? "id",
        )});`,
        tableIds: [table.id],
      };
      graph.warnings.push(warning);
      table.warnings.push(warning);
    }

    if (!connected.has(table.id) && graph.tables.length > 1) {
      const warning: SchemaWarning = {
        id: `orphan:${table.id}`,
        kind: "orphan-table",
        severity: "info",
        title: L.orphanTable.title,
        message: L.orphanTable.message(table.name),
        suggestion: L.orphanTable.suggestion,
        tableIds: [table.id],
      };
      graph.warnings.push(warning);
      table.warnings.push(warning);
    }
  }
}

function severityRank(severity: WarningSeverity): number {
  return severity === "error" ? 2 : severity === "warning" ? 1 : 0;
}

/**
 * Runs every check and returns the same graph instance with warnings attached.
 * Implicit foreign keys discovered during linting are added to `relations` so
 * the 3D scene can draw them as dashed "suggested" edges.
 *
 * Re-runnable on the same graph (e.g. to re-lint in another `locale`): implicit
 * relations from a previous run are dropped first so they aren't duplicated.
 */
export function lintSchema(graph: SchemaGraph, locale: Locale = "en"): SchemaGraph {
  const L = getLinterText(locale);

  graph.relations = graph.relations.filter((relation) => relation.kind !== "implicit");
  graph.warnings = [];
  for (const table of graph.tables) table.warnings = [];
  for (const relation of graph.relations) {
    relation.warnings = [];
    relation.health = "ok";
  }

  const tablesById = new Map(graph.tables.map((t) => [t.id, t]));

  checkDanglingReferences(graph, tablesById, L);
  checkTypeMismatches(graph, tablesById, L);
  checkMissingIndexes(graph, tablesById, L);

  const implicit = checkImplicitForeignKeys(graph, tablesById, L);
  for (const { relation, warning } of implicit) {
    relation.warnings.push(warning);
    graph.warnings.push(warning);
    tablesById.get(relation.sourceTable)?.warnings.push(warning);
    graph.relations.push(relation);
  }

  // Cycles run last so suggested relations are taken into account.
  checkCircularDependencies(graph, tablesById, L);
  checkTableHygiene(graph, L);

  for (const relation of graph.relations) {
    let health: Relation["health"] = relation.kind === "implicit" ? "warning" : "ok";
    for (const warning of relation.warnings) {
      if (warning.severity === "error") health = "error";
      else if (warning.severity === "warning" && health !== "error") health = "warning";
    }
    relation.health = health;
  }

  graph.warnings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  return graph;
}

/**
 * `mutedIds` lets a caller exclude warnings the user has silenced from the
 * score and counts, without removing them from the graph itself.
 */
export function summarizeHealth(graph: SchemaGraph, mutedIds?: Set<string>): HealthSummary {
  const warnings = mutedIds ? graph.warnings.filter((w) => !mutedIds.has(w.id)) : graph.warnings;
  const summary = { errors: 0, warnings: 0, info: 0, score: 100 };
  for (const warning of warnings) {
    if (warning.severity === "error") summary.errors += 1;
    else if (warning.severity === "warning") summary.warnings += 1;
    else summary.info += 1;
  }

  // Normalise the penalty by schema size so a large schema is not punished for
  // simply having more surface area.
  const surface = Math.max(graph.tables.length + graph.relations.length, 1);
  const penalty = warnings.reduce((total, w) => total + SEVERITY_WEIGHT[w.severity], 0);
  summary.score = Math.max(0, Math.round(100 - (penalty / surface) * 14));
  return summary;
}

export function tableHealth(table: Table): "ok" | "warning" | "error" {
  let health: "ok" | "warning" | "error" = "ok";
  for (const warning of table.warnings) {
    if (warning.severity === "error") return "error";
    if (warning.severity === "warning") health = "warning";
  }
  return health;
}
