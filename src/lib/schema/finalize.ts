import type { Relation, SchemaGraph, SchemaSource, Table } from "@/lib/types";

export interface RawGraph {
  name: string;
  source: SchemaSource;
  tables: Table[];
  relations: Relation[];
  parseNotes?: string[];
}

/**
 * Resolves cross-table references once parsing is done: links FK columns to the
 * PK they point at, flags unresolvable targets, and derives the `isForeignKey` /
 * `isIndexed` column flags the linter and the 3D scene rely on.
 */
export function finalizeGraph(raw: RawGraph): SchemaGraph {
  const tables = [...raw.tables].sort((a, b) => a.name.localeCompare(b.name));
  const byId = new Map(tables.map((t) => [t.id, t]));

  // Index coverage: a column counts as indexed when it leads an index, is a
  // single-column primary key, or carries a UNIQUE constraint.
  for (const table of tables) {
    for (const column of table.columns) {
      column.isIndexed = false;
      column.isForeignKey = false;
    }
    // Composite PKs only index-cover their leading column, matching how
    // B-tree prefixes actually work.
    const leadingPk = table.columns.find((c) => c.isPrimaryKey);
    if (leadingPk) leadingPk.isIndexed = true;
    for (const column of table.columns) {
      if (column.isUnique) column.isIndexed = true;
    }
    for (const index of table.indexes) {
      const first = index.columns[0];
      if (!first) continue;
      const column = table.columns.find(
        (c) => c.name.toLowerCase() === first.toLowerCase(),
      );
      if (column) column.isIndexed = true;
    }
  }

  const seen = new Set<string>();
  const relations: Relation[] = [];

  for (const relation of raw.relations) {
    const sourceTable = byId.get(relation.sourceTable);
    const targetTable = byId.get(relation.targetTable);

    // An FK written without an explicit target column implicitly targets the
    // referenced table's primary key.
    let targetColumn = relation.targetColumn;
    if (!targetColumn && targetTable) {
      targetColumn = targetTable.columns.find((c) => c.isPrimaryKey)?.name ?? "";
    }

    const sourceColumn = sourceTable?.columns.find(
      (c) => c.name.toLowerCase() === relation.sourceColumn.toLowerCase(),
    );
    const resolvedTarget = targetTable?.columns.find(
      (c) => c.name.toLowerCase() === targetColumn.toLowerCase(),
    );

    const next: Relation = {
      ...relation,
      targetColumn: resolvedTarget?.name ?? targetColumn,
      sourceColumn: sourceColumn?.name ?? relation.sourceColumn,
      dangling: !targetTable || !resolvedTarget || !sourceColumn,
    };

    next.id = `${next.sourceTable}.${next.sourceColumn.toLowerCase()}->${next.targetTable}.${next.targetColumn.toLowerCase()}:${next.kind}`;
    if (seen.has(next.id)) continue;
    seen.add(next.id);

    if (sourceColumn) sourceColumn.isForeignKey = true;
    relations.push(next);
  }

  return {
    name: raw.name,
    source: raw.source,
    tables,
    relations,
    warnings: [],
    parseNotes: raw.parseNotes ?? [],
  };
}

export function makeTable(name: string): Table {
  return {
    id: name.toLowerCase(),
    name,
    columns: [],
    indexes: [],
    warnings: [],
  };
}
