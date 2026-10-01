import type { TypeFamily } from "@/lib/types";

/**
 * SQL type names are wildly dialect-specific, so the linter compares coarse
 * families rather than literal spellings: `INT` and `INTEGER` are compatible,
 * `INT` and `UUID` are not.
 */
const FAMILY_PATTERNS: Array<[TypeFamily, RegExp]> = [
  ["uuid", /^(uuid|guid|uniqueidentifier)$/],
  ["boolean", /^(bool|boolean|bit)$/],
  [
    "integer",
    /^(tinyint|smallint|mediumint|int|integer|bigint|int2|int4|int8|serial|bigserial|smallserial|serial2|serial4|serial8|year)$/,
  ],
  [
    "decimal",
    /^(decimal|numeric|number|float|double|doubleprecision|double_precision|real|money|smallmoney|float4|float8|dec|fixed)$/,
  ],
  [
    "datetime",
    /^(date|datetime|datetime2|timestamp|timestamptz|timestampwithtimezone|timestampwithouttimezone|time|timetz|smalldatetime|datetimeoffset|interval)$/,
  ],
  ["json", /^(json|jsonb)$/],
  [
    "binary",
    /^(blob|bytea|binary|varbinary|longblob|mediumblob|tinyblob|image|raw)$/,
  ],
  [
    "text",
    /^(char|nchar|character|varchar|varchar2|nvarchar|charactervarying|character_varying|text|ntext|tinytext|mediumtext|longtext|clob|string|citext|enum|set|xml)$/,
  ],
];

export interface ParsedType {
  rawType: string;
  family: TypeFamily;
  length?: number;
}

/**
 * Turns a raw declared type into a family + declared length.
 * `VARCHAR(255)` -> { family: "text", length: 255 }
 * `NUMERIC(10, 2)` -> { family: "decimal", length: 10 }
 */
export function parseColumnType(raw: string): ParsedType {
  const rawType = raw.trim().replace(/\s+/g, " ");
  if (!rawType) return { rawType: "", family: "unknown" };

  const lengthMatch = rawType.match(/\(\s*(\d+)\s*(?:,\s*\d+\s*)?\)/);
  const length = lengthMatch ? Number(lengthMatch[1]) : undefined;

  // Drop the precision clause, any array suffix and collapse to one word.
  const base = rawType
    .replace(/\([^)]*\)/g, "")
    .replace(/\[\s*\]/g, "")
    .replace(/\b(unsigned|signed|zerofill|precision|varying|with time zone|without time zone)\b/gi, (m) =>
      // `double precision` / `character varying` / `timestamp with time zone`
      // should stay glued to their head word so the patterns below can match.
      m.replace(/\s+/g, ""),
    )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  for (const [family, pattern] of FAMILY_PATTERNS) {
    if (pattern.test(base)) return { rawType, family, length };
  }

  // Fall back to substring sniffing for exotic dialect spellings.
  if (base.includes("int")) return { rawType, family: "integer", length };
  if (base.includes("char") || base.includes("text")) return { rawType, family: "text", length };
  if (base.includes("date") || base.includes("time")) return { rawType, family: "datetime", length };
  if (base.includes("float") || base.includes("double") || base.includes("num"))
    return { rawType, family: "decimal", length };

  return { rawType, family: "unknown", length };
}

/**
 * SQLite stores declared types verbatim but applies affinity rules, so an
 * INTEGER FK pointing at a NUMERIC PK is harmless. Families that are safely
 * interchangeable are declared compatible here.
 */
const COMPATIBLE: Array<[TypeFamily, TypeFamily]> = [
  ["integer", "decimal"],
  ["text", "uuid"],
  ["integer", "boolean"],
];

export function areTypesCompatible(a: TypeFamily, b: TypeFamily): boolean {
  if (a === b) return true;
  if (a === "unknown" || b === "unknown") return true;
  return COMPATIBLE.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a),
  );
}

/** Strict equality is a stronger signal than family compatibility. */
export function isExactTypeMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "").replace(/unsigned|zerofill/g, "");
  return norm(a) === norm(b);
}

const FAMILY_LABEL: Record<TypeFamily, string> = {
  integer: "integer",
  decimal: "numeric",
  text: "text",
  uuid: "UUID",
  boolean: "boolean",
  datetime: "date/time",
  binary: "binary",
  json: "JSON",
  unknown: "unknown",
};

export function familyLabel(family: TypeFamily): string {
  return FAMILY_LABEL[family];
}
