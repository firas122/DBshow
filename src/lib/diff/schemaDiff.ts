import type { Relation, SchemaGraph, Table } from "@/lib/types";

export interface ColumnChange {
  name: string;
  before: string;
  after: string;
}

export interface TableDiffEntry {
  tableId: string;
  name: string;
  status: "added" | "removed" | "modified";
  addedColumns: string[];
  removedColumns: string[];
  changedColumns: ColumnChange[];
}

export interface RelationDiffEntry {
  relationId: string;
  label: string;
  status: "added" | "removed";
}

export interface SchemaDiff {
  baselineName: string;
  currentName: string;
  tables: TableDiffEntry[];
  relations: RelationDiffEntry[];
  summary: {
    tablesAdded: number;
    tablesRemoved: number;
    tablesModified: number;
    relationsAdded: number;
    relationsRemoved: number;
  };
}

function relationKey(relation: Relation): string {
  return `${relation.sourceTable}.${relation.sourceColumn}->${relation.targetTable}.${relation.targetColumn}`;
}

function columnSignature(table: Table): Map<string, string> {
  const map = new Map<string, string>();
  for (const column of table.columns) map.set(column.name.toLowerCase(), column.rawType);
  return map;
}

function relationLabel(relation: Relation): string {
  return `${relation.sourceTable}.${relation.sourceColumn} → ${relation.targetTable}.${relation.targetColumn}`;
}

/**
 * Compares two SchemaGraphs and returns both a structured diff (for the Diff
 * drawer) and a "view graph" — the union of both schemas, tagged with
 * `diffStatus` on each table/relation — that the 3D scene can render directly
 * through its normal rendering path.
 */
export function diffSchemas(
  baseline: SchemaGraph,
  current: SchemaGraph,
): { diff: SchemaDiff; viewGraph: SchemaGraph } {
  const baselineTables = new Map(baseline.tables.map((table) => [table.id, table]));
  const currentTables = new Map(current.tables.map((table) => [table.id, table]));

  const tableEntries: TableDiffEntry[] = [];
  const viewTables: Table[] = [];

  const allTableIds = new Set([...baselineTables.keys(), ...currentTables.keys()]);
  for (const id of allTableIds) {
    const before = baselineTables.get(id);
    const after = currentTables.get(id);

    if (after && !before) {
      tableEntries.push({
        tableId: id,
        name: after.name,
        status: "added",
        addedColumns: [],
        removedColumns: [],
        changedColumns: [],
      });
      viewTables.push({ ...after, diffStatus: "added" });
      continue;
    }

    if (before && !after) {
      tableEntries.push({
        tableId: id,
        name: before.name,
        status: "removed",
        addedColumns: [],
        removedColumns: [],
        changedColumns: [],
      });
      viewTables.push({ ...before, warnings: [], diffStatus: "removed" });
      continue;
    }

    if (before && after) {
      const beforeColumns = columnSignature(before);
      const afterColumns = columnSignature(after);
      const addedColumns = [...afterColumns.keys()].filter((name) => !beforeColumns.has(name));
      const removedColumns = [...beforeColumns.keys()].filter((name) => !afterColumns.has(name));
      const changedColumns: ColumnChange[] = [];
      for (const [name, afterType] of afterColumns) {
        const beforeType = beforeColumns.get(name);
        if (beforeType && beforeType !== afterType) {
          changedColumns.push({ name, before: beforeType, after: afterType });
        }
      }

      const modified = addedColumns.length > 0 || removedColumns.length > 0 || changedColumns.length > 0;
      if (modified) {
        tableEntries.push({
          tableId: id,
          name: after.name,
          status: "modified",
          addedColumns,
          removedColumns,
          changedColumns,
        });
        viewTables.push({ ...after, diffStatus: "modified" });
      } else {
        viewTables.push(after);
      }
    }
  }

  const baselineRelations = new Map(
    baseline.relations.filter((r) => !r.dangling).map((r) => [relationKey(r), r]),
  );
  const currentRelations = new Map(
    current.relations.filter((r) => !r.dangling).map((r) => [relationKey(r), r]),
  );

  const relationEntries: RelationDiffEntry[] = [];
  const viewRelations: Relation[] = current.relations.map((relation) => {
    if (!relation.dangling && !baselineRelations.has(relationKey(relation))) {
      relationEntries.push({
        relationId: relation.id,
        label: relationLabel(relation),
        status: "added",
      });
      return { ...relation, diffStatus: "added" };
    }
    return relation;
  });

  for (const [key, relation] of baselineRelations) {
    if (!currentRelations.has(key)) {
      relationEntries.push({
        relationId: relation.id,
        label: relationLabel(relation),
        status: "removed",
      });
      viewRelations.push({
        ...relation,
        id: `removed:${relation.id}`,
        warnings: [],
        diffStatus: "removed",
      });
    }
  }

  const summary = {
    tablesAdded: tableEntries.filter((t) => t.status === "added").length,
    tablesRemoved: tableEntries.filter((t) => t.status === "removed").length,
    tablesModified: tableEntries.filter((t) => t.status === "modified").length,
    relationsAdded: relationEntries.filter((r) => r.status === "added").length,
    relationsRemoved: relationEntries.filter((r) => r.status === "removed").length,
  };

  const diff: SchemaDiff = {
    baselineName: baseline.name,
    currentName: current.name,
    tables: tableEntries.sort((a, b) => a.name.localeCompare(b.name)),
    relations: relationEntries,
    summary,
  };

  const viewGraph: SchemaGraph = {
    name: `${current.name} vs ${baseline.name}`,
    source: current.source,
    tables: viewTables,
    relations: viewRelations,
    warnings: current.warnings,
    parseNotes: [],
  };

  return { diff, viewGraph };
}
