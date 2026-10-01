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

function checkDanglingReferences(graph: SchemaGraph, tablesById: Map<string, Table>) {
  for (const relation of graph.relations) {
    if (!relation.dangling) continue;

    const sourceTable = tablesById.get(relation.sourceTable);
    const targetTable = tablesById.get(relation.targetTable);
    const missingTable = !targetTable;

    const target = `${relation.targetTable}.${relation.targetColumn || "?"}`;
    attach(
      graph,
      {
        id: `dangling:${relation.id}`,
        kind: "dangling-reference",
        severity: "error",
        title: "Dangling foreign key reference",
        message: missingTable
          ? `${relation.sourceTable}.${relation.sourceColumn} references table "${relation.targetTable}", which is not defined in this schema.`
          : `${relation.sourceTable}.${relation.sourceColumn} references column "${target}", which does not exist on "${relation.targetTable}".`,
        suggestion: missingTable
          ? `Add the missing CREATE TABLE for "${relation.targetTable}", or drop the constraint if the table was intentionally removed.`
          : `Point the constraint at an existing column on "${relation.targetTable}" — most likely its primary key.`,
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

function checkTypeMismatches(graph: SchemaGraph, tablesById: Map<string, Table>) {
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
          title: "Foreign key type mismatch",
          message: `${sourceTable.name}.${sourceColumn.name} is ${sourceColumn.rawType} (${familyLabel(
            sourceColumn.family,
          )}) but references ${targetTable.name}.${targetColumn.name}, which is ${targetColumn.rawType} (${familyLabel(
            targetColumn.family,
          )}).`,
          suggestion:
            "Mismatched families force an implicit cast on every join, which silently disables index usage and can fail outright on stricter engines. Align both sides on the parent's type.",
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
          title: "Foreign key is narrower than its parent",
          message: `${sourceTable.name}.${sourceColumn.name} holds ${sourceColumn.length} characters but ${targetTable.name}.${targetColumn.name} allows ${targetColumn.length}.`,
          suggestion: `Widen the child column to ${targetColumn.rawType} so long parent keys cannot be truncated.`,
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

function checkMissingIndexes(graph: SchemaGraph, tablesById: Map<string, Table>) {
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
        title: "Unindexed foreign key",
        message: `${table.name}.${column.name} is a foreign key with no supporting index.`,
        suggestion:
          "Joins and parent-side deletes will fall back to a full scan of this table. Add an index whose leading column is the foreign key.",
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
        title: "Suggested relation — missing foreign key",
        message: `${table.name}.${column.name} looks like a reference to ${target.name}.${targetColumn.name}${
          typesAgree ? "" : " (though the column types differ)"
        }, but no FOREIGN KEY constraint declares it.`,
        suggestion:
          "Without the constraint the database cannot stop orphaned rows, and tools that read the schema will not see this relationship. Declare it explicitly if the link is real.",
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

function checkCircularDependencies(graph: SchemaGraph, tablesById: Map<string, Table>) {
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
      title: isSelfReference ? "Self-referencing table" : "Circular dependency",
      message: isSelfReference
        ? `${names[0]} references itself, forming a hierarchy.`
        : `Tables form a dependency cycle: ${path}.`,
      suggestion: isSelfReference
        ? "Fine for trees and hierarchies — just make sure the column is nullable so root rows can be inserted, and that recursive queries are depth-limited."
        : breakable
          ? "Rows cannot be inserted in any single order without a deferrable constraint. At least one key on the cycle is nullable, so insert that side as NULL first and update it afterwards. Watch for cascade deletes looping."
          : "Every key on this cycle is NOT NULL, so no insertion order satisfies all constraints. Make one of them nullable, mark it DEFERRABLE INITIALLY DEFERRED, or break the cycle with a join table.",
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

function checkTableHygiene(graph: SchemaGraph) {
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
        title: "Table has no primary key",
        message: `${table.name} declares no PRIMARY KEY, so rows cannot be addressed uniquely.`,
        suggestion:
          "Replication, upserts and most ORMs need a stable row identity. Add a surrogate key or promote an existing unique column.",
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
        title: "Isolated table",
        message: `${table.name} has no incoming or outgoing relationships.`,
        suggestion:
          "Expected for lookup, config or audit tables. Otherwise its links are probably enforced in application code rather than in the schema.",
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
 */
export function lintSchema(graph: SchemaGraph): SchemaGraph {
  graph.warnings = [];
  for (const table of graph.tables) table.warnings = [];
  for (const relation of graph.relations) {
    relation.warnings = [];
    relation.health = "ok";
  }

  const tablesById = new Map(graph.tables.map((t) => [t.id, t]));

  checkDanglingReferences(graph, tablesById);
  checkTypeMismatches(graph, tablesById);
  checkMissingIndexes(graph, tablesById);

  const implicit = checkImplicitForeignKeys(graph, tablesById);
  for (const { relation, warning } of implicit) {
    relation.warnings.push(warning);
    graph.warnings.push(warning);
    tablesById.get(relation.sourceTable)?.warnings.push(warning);
    graph.relations.push(relation);
  }

  // Cycles run last so suggested relations are taken into account.
  checkCircularDependencies(graph, tablesById);
  checkTableHygiene(graph);

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

export function summarizeHealth(graph: SchemaGraph): HealthSummary {
  const summary = { errors: 0, warnings: 0, info: 0, score: 100 };
  for (const warning of graph.warnings) {
    if (warning.severity === "error") summary.errors += 1;
    else if (warning.severity === "warning") summary.warnings += 1;
    else summary.info += 1;
  }

  // Normalise the penalty by schema size so a large schema is not punished for
  // simply having more surface area.
  const surface = Math.max(graph.tables.length + graph.relations.length, 1);
  const penalty = graph.warnings.reduce((total, w) => total + SEVERITY_WEIGHT[w.severity], 0);
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
