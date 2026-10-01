import { finalizeGraph, makeTable } from "@/lib/schema/finalize";
import { parseColumnType } from "@/lib/schema/types-util";
import type { Column, Relation, SchemaGraph, Table } from "@/lib/types";

/**
 * Accepts the common hand-written / exported JSON schema shapes rather than one
 * rigid format:
 *
 *   A. { "tables": [ { "name": "users", "columns": [ { "name": "id", "type": "INT",
 *                      "primaryKey": true, "references": "orders.id" } ] } ] }
 *   B. { "users": { "id": "INTEGER PRIMARY KEY", "email": "VARCHAR(255)" } }
 *   C. [ { "name": "users", "columns": [...] }, ... ]
 *
 * Plus an optional top-level "relations" / "foreignKeys" array in any shape.
 */

type Json = unknown;

function asRecord(value: Json): Record<string, Json> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json>)
    : null;
}

function pick(record: Record<string, Json>, keys: string[]): Json {
  for (const key of keys) {
    const match = Object.keys(record).find((k) => k.toLowerCase() === key.toLowerCase());
    if (match !== undefined && record[match] !== undefined && record[match] !== null) {
      return record[match];
    }
  }
  return undefined;
}

function str(value: Json): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function bool(value: Json): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (/^(true|yes|1)$/i.test(value)) return true;
    if (/^(false|no|0)$/i.test(value)) return false;
  }
  if (typeof value === "number") return value !== 0;
  return undefined;
}

interface RefTarget {
  table: string;
  column: string;
}

/** Reads `"users.id"`, `"users"` or `{ table, column }` into a target. */
function readReference(value: Json): RefTarget | null {
  if (typeof value === "string") {
    const [table, column = ""] = value.split(".");
    return table ? { table: table.trim(), column: column.trim() } : null;
  }
  const record = asRecord(value);
  if (!record) return null;
  const table = str(pick(record, ["table", "tableName", "to", "target", "model", "entity"]));
  if (!table) return null;
  const column = str(pick(record, ["column", "columnName", "field", "key", "to"])) ?? "";
  // `to` may itself be "users.id".
  if (table.includes(".") && !column) {
    const [t, c = ""] = table.split(".");
    return { table: t, column: c };
  }
  return { table, column };
}

function columnFromRecord(record: Record<string, Json>, fallbackName?: string): Column | null {
  const name = str(pick(record, ["name", "column", "columnName", "field"])) ?? fallbackName;
  if (!name) return null;

  const rawType =
    str(pick(record, ["type", "dataType", "columnType", "sqlType", "dbType"])) ?? "TEXT";
  const parsed = parseColumnType(rawType);

  const primaryKey = bool(pick(record, ["primaryKey", "pk", "isPrimaryKey", "primary"])) ?? false;
  const notNull = bool(pick(record, ["notNull", "required"]));
  const nullable = bool(pick(record, ["nullable", "isNullable", "optional"]));

  return {
    name,
    rawType: parsed.rawType,
    family: parsed.family,
    length: parsed.length,
    isPrimaryKey: primaryKey,
    isNullable: primaryKey ? false : (nullable ?? (notNull === undefined ? true : !notNull)),
    isUnique: (bool(pick(record, ["unique", "isUnique"])) ?? false) || primaryKey,
    isAutoIncrement:
      bool(pick(record, ["autoIncrement", "autoincrement", "identity", "serial"])) ?? false,
    defaultValue: str(pick(record, ["default", "defaultValue"])),
    isForeignKey: false,
    isIndexed: bool(pick(record, ["indexed", "isIndexed", "index"])) ?? false,
  };
}

/** Parses a terse `"INTEGER PRIMARY KEY NOT NULL"` type string (shape B). */
function columnFromTypeString(name: string, declaration: string): Column {
  const primaryKey = /\bprimary\s+key\b/i.test(declaration);
  const rawType = declaration
    .replace(/\bprimary\s+key\b/gi, "")
    .replace(/\bnot\s+null\b/gi, "")
    .replace(/\b(unique|autoincrement|auto_increment)\b/gi, "")
    .replace(/\breferences\s+[\w".]+(\s*\([^)]*\))?/gi, "")
    .trim();
  const parsed = parseColumnType(rawType || "TEXT");

  return {
    name,
    rawType: parsed.rawType,
    family: parsed.family,
    length: parsed.length,
    isPrimaryKey: primaryKey,
    isNullable: !primaryKey && !/\bnot\s+null\b/i.test(declaration),
    isUnique: primaryKey || /\bunique\b/i.test(declaration),
    isAutoIncrement: /\b(autoincrement|auto_increment)\b/i.test(declaration),
    isForeignKey: false,
    isIndexed: false,
  };
}

function readIndexes(record: Record<string, Json>, table: Table) {
  const raw = pick(record, ["indexes", "index", "keys"]);
  if (!Array.isArray(raw)) return;
  for (const entry of raw) {
    const indexRecord = asRecord(entry);
    if (!indexRecord) {
      const column = str(entry);
      if (column) {
        table.indexes.push({ name: `idx_${column}`, columns: [column], isUnique: false, isImplicit: false });
      }
      continue;
    }
    const columnsRaw = pick(indexRecord, ["columns", "fields", "keys", "column"]);
    const columns = Array.isArray(columnsRaw)
      ? columnsRaw.map((c) => str(c) ?? "").filter(Boolean)
      : [str(columnsRaw) ?? ""].filter(Boolean);
    if (columns.length === 0) continue;
    table.indexes.push({
      name: str(pick(indexRecord, ["name"])) ?? `idx_${columns.join("_")}`,
      columns,
      isUnique: bool(pick(indexRecord, ["unique", "isUnique"])) ?? false,
      isImplicit: false,
    });
  }
}

function makeRelation(
  sourceTable: string,
  sourceColumn: string,
  target: RefTarget,
  extra?: Record<string, Json>,
): Relation {
  return {
    id: `${sourceTable}.${sourceColumn}->${target.table}.${target.column}`,
    sourceTable: sourceTable.toLowerCase(),
    sourceColumn,
    targetTable: target.table.toLowerCase(),
    targetColumn: target.column,
    kind: "explicit",
    onDelete: extra ? str(pick(extra, ["onDelete", "on_delete"])) : undefined,
    onUpdate: extra ? str(pick(extra, ["onUpdate", "on_update"])) : undefined,
    warnings: [],
    health: "ok",
  };
}

function readTable(entry: Json, fallbackName?: string): { table: Table; relations: Relation[] } | null {
  const record = asRecord(entry);
  if (!record) return null;

  const name = str(pick(record, ["name", "table", "tableName"])) ?? fallbackName;
  if (!name) return null;

  const table = makeTable(name);
  const relations: Relation[] = [];

  const columnsRaw = pick(record, ["columns", "fields", "properties", "attributes"]);

  const addColumn = (column: Column | null, source?: Record<string, Json>) => {
    if (!column) return;
    table.columns.push(column);
    if (!source) return;
    const reference = readReference(
      pick(source, ["references", "reference", "ref", "foreignKey", "fk", "relation"]),
    );
    if (reference) relations.push(makeRelation(table.id, column.name, reference, source));
  };

  if (Array.isArray(columnsRaw)) {
    for (const columnEntry of columnsRaw) {
      const columnRecord = asRecord(columnEntry);
      if (columnRecord) addColumn(columnFromRecord(columnRecord), columnRecord);
      else if (typeof columnEntry === "string") {
        // "id INTEGER PRIMARY KEY"
        const [columnName, ...rest] = columnEntry.trim().split(/\s+/);
        addColumn(columnFromTypeString(columnName, rest.join(" ")));
      }
    }
  } else {
    const columnsRecord = asRecord(columnsRaw);
    if (columnsRecord) {
      for (const [columnName, value] of Object.entries(columnsRecord)) {
        const columnRecord = asRecord(value);
        if (columnRecord) addColumn(columnFromRecord(columnRecord, columnName), columnRecord);
        else if (typeof value === "string") addColumn(columnFromTypeString(columnName, value));
      }
    }
  }

  readIndexes(record, table);

  // Table-level foreign key list.
  const tableForeignKeys = pick(record, ["foreignKeys", "relations", "references"]);
  if (Array.isArray(tableForeignKeys)) {
    for (const fkEntry of tableForeignKeys) {
      const fkRecord = asRecord(fkEntry);
      if (!fkRecord) continue;
      const sourceColumn =
        str(pick(fkRecord, ["column", "from", "sourceColumn", "field"]))?.split(".").pop() ?? "";
      const target = readReference(
        pick(fkRecord, ["references", "to", "target", "table"]) ?? fkRecord,
      );
      if (sourceColumn && target) relations.push(makeRelation(table.id, sourceColumn, target, fkRecord));
    }
  }

  const primaryKeyRaw = pick(record, ["primaryKey", "pk"]);
  const primaryKeys = Array.isArray(primaryKeyRaw)
    ? primaryKeyRaw.map((v) => str(v) ?? "")
    : [str(primaryKeyRaw) ?? ""];
  for (const key of primaryKeys.filter(Boolean)) {
    const column = table.columns.find((c) => c.name.toLowerCase() === key.toLowerCase());
    if (column) {
      column.isPrimaryKey = true;
      column.isNullable = false;
      column.isUnique = true;
    }
  }

  return table.columns.length > 0 ? { table, relations } : null;
}

function readRootRelations(root: Record<string, Json>): Relation[] {
  const raw = pick(root, ["relations", "foreignKeys", "references", "edges", "links"]);
  if (!Array.isArray(raw)) return [];

  const relations: Relation[] = [];
  for (const entry of raw) {
    const record = asRecord(entry);
    if (!record) continue;

    const from = pick(record, ["from", "source", "child", "sourceTable"]);
    const fromRef = readReference(from);
    const sourceTable =
      fromRef?.table ?? str(pick(record, ["sourceTable", "fromTable", "table"])) ?? "";
    const sourceColumn =
      fromRef?.column ||
      str(pick(record, ["sourceColumn", "fromColumn", "column", "fromField"])) ||
      "";

    const to = pick(record, ["to", "target", "parent", "targetTable", "references"]);
    const toRef = readReference(to);
    const targetTable = toRef?.table ?? str(pick(record, ["targetTable", "toTable"])) ?? "";
    const targetColumn =
      toRef?.column || str(pick(record, ["targetColumn", "toColumn", "toField"])) || "";

    if (!sourceTable || !sourceColumn || !targetTable) continue;
    relations.push(
      makeRelation(sourceTable, sourceColumn, { table: targetTable, column: targetColumn }, record),
    );
  }
  return relations;
}

export function parseJsonSchema(input: string | Json, name = "JSON schema"): SchemaGraph {
  let root: Json;
  if (typeof input === "string") {
    try {
      root = JSON.parse(input);
    } catch (error) {
      throw new Error(
        `Invalid JSON: ${error instanceof Error ? error.message : "could not be parsed"}`,
      );
    }
  } else {
    root = input;
  }

  const tables: Table[] = [];
  const relations: Relation[] = [];
  const notes: string[] = [];

  const collect = (entry: Json, fallbackName?: string) => {
    const parsed = readTable(entry, fallbackName);
    if (!parsed) return false;
    tables.push(parsed.table);
    relations.push(...parsed.relations);
    return true;
  };

  if (Array.isArray(root)) {
    for (const entry of root) collect(entry);
  } else {
    const record = asRecord(root);
    if (!record) throw new Error("Expected a JSON object or array describing tables.");

    const tablesRaw = pick(record, ["tables", "models", "entities"]);
    if (Array.isArray(tablesRaw)) {
      for (const entry of tablesRaw) collect(entry);
    } else if (asRecord(tablesRaw)) {
      for (const [tableName, entry] of Object.entries(asRecord(tablesRaw)!)) {
        collect(entry, tableName) || collect({ name: tableName, columns: entry }, tableName);
      }
    } else {
      // Shape B: the root object itself maps table name -> columns.
      for (const [tableName, entry] of Object.entries(record)) {
        if (["relations", "foreignKeys", "references", "edges", "links", "name", "$schema"].includes(tableName)) {
          continue;
        }
        if (!collect(entry, tableName)) collect({ name: tableName, columns: entry }, tableName);
      }
    }

    relations.push(...readRootRelations(record));
    const graphName = str(pick(record, ["name", "database", "schemaName"]));
    if (graphName) name = graphName;
  }

  if (tables.length === 0) {
    throw new Error(
      'No tables found. Expected shapes like { "tables": [ { "name": "users", "columns": [...] } ] }.',
    );
  }

  return finalizeGraph({ name, source: "json", tables, relations, parseNotes: notes });
}
