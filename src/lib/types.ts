/**
 * Canonical schema model. Every parser (SQL DDL, SQLite binary, JSON) normalises
 * into a SchemaGraph; the linter, the layout engine and the 3D scene only ever
 * read this shape.
 */

export type WarningSeverity = "error" | "warning" | "info";

export type WarningKind =
  | "type-mismatch"
  | "implicit-fk"
  | "missing-index"
  | "circular-dependency"
  | "dangling-reference"
  | "no-primary-key"
  | "orphan-table";

export interface SchemaWarning {
  id: string;
  kind: WarningKind;
  severity: WarningSeverity;
  title: string;
  /** Human readable description of exactly what was detected. */
  message: string;
  /** Actionable remediation, usually including a DDL snippet. */
  suggestion: string;
  /** DDL the user can copy to fix the issue, when one can be generated. */
  fix?: string;
  /** Tables implicated — first entry is the primary subject. */
  tableIds: string[];
  columnName?: string;
  relationId?: string;
}

/** Coarse bucket used to compare a FK column against the PK it references. */
export type TypeFamily =
  | "integer"
  | "decimal"
  | "text"
  | "uuid"
  | "boolean"
  | "datetime"
  | "binary"
  | "json"
  | "unknown";

export interface Column {
  name: string;
  /** Type exactly as written in the source schema, e.g. `VARCHAR(255)`. */
  rawType: string;
  family: TypeFamily;
  /** Declared length/precision when present, e.g. 255 for VARCHAR(255). */
  length?: number;
  isPrimaryKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
  isAutoIncrement: boolean;
  defaultValue?: string;
  /** True when this column is the source side of at least one relation. */
  isForeignKey: boolean;
  /** True when covered by an index whose first column is this one. */
  isIndexed: boolean;
}

export interface TableIndex {
  name: string;
  columns: string[];
  isUnique: boolean;
  /** Implicit indexes are the ones engines create for PK/UNIQUE constraints. */
  isImplicit: boolean;
}

export interface Table {
  /** Normalised lookup key: lower-cased table name. */
  id: string;
  name: string;
  columns: Column[];
  indexes: TableIndex[];
  warnings: SchemaWarning[];
  /** Populated by the layout engine: dependency depth from a root table. */
  depth?: number;
}

export type RelationKind = "explicit" | "implicit";
export type HealthStatus = "ok" | "warning" | "error";

export interface Relation {
  id: string;
  /** Table holding the foreign key (the child). */
  sourceTable: string;
  sourceColumn: string;
  /** Referenced table (the parent). */
  targetTable: string;
  targetColumn: string;
  kind: RelationKind;
  onDelete?: string;
  onUpdate?: string;
  warnings: SchemaWarning[];
  health: HealthStatus;
  /** Set when the target table or column could not be resolved. */
  dangling?: boolean;
}

export type SchemaSource = "sql" | "sqlite" | "json" | "sample";

export interface SchemaGraph {
  name: string;
  source: SchemaSource;
  tables: Table[];
  relations: Relation[];
  /** Every warning in the graph, including those attached to tables/relations. */
  warnings: SchemaWarning[];
  /** Non-fatal notes from the parser (unsupported statements, etc.). */
  parseNotes: string[];
}

export interface HealthSummary {
  errors: number;
  warnings: number;
  info: number;
  score: number;
}

export const EMPTY_GRAPH: SchemaGraph = {
  name: "Untitled schema",
  source: "sql",
  tables: [],
  relations: [],
  warnings: [],
  parseNotes: [],
};
