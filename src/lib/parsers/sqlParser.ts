import { finalizeGraph, makeTable } from "@/lib/schema/finalize";
import { parseColumnType } from "@/lib/schema/types-util";
import type { Column, Relation, SchemaGraph, Table, TableIndex } from "@/lib/types";

/**
 * Dialect-tolerant DDL reader. It deliberately works on a lightly tokenised
 * character stream rather than a full grammar: real-world dumps (mysqldump,
 * pg_dump, sqlite .schema, Rails/Prisma output) mix dialects freely, and a
 * strict grammar rejects the whole file over one unsupported clause.
 *
 * Handles CREATE TABLE (inline + table-level constraints), CREATE INDEX and
 * ALTER TABLE ... ADD CONSTRAINT, and records anything it skips in parseNotes.
 */

const IDENT = String.raw`(?:"[^"]*"|\`[^\`]*\`|\[[^\]]*\]|[A-Za-z_][\w$]*)`;
const QUALIFIED_IDENT = String.raw`(?:${IDENT}\s*\.\s*)*${IDENT}`;

/** Strips quoting and any schema qualifier: `"public"."users"` -> `users`. */
export function unquoteIdent(value: string): string {
  const trimmed = value.trim();
  const segments = splitTopLevel(trimmed, ".");
  const last = (segments[segments.length - 1] ?? trimmed).trim();
  if (
    (last.startsWith('"') && last.endsWith('"')) ||
    (last.startsWith("`") && last.endsWith("`"))
  ) {
    return last.slice(1, -1);
  }
  if (last.startsWith("[") && last.endsWith("]")) return last.slice(1, -1);
  return last;
}

/** Removes `--`, `#` and block comments without touching string literals. */
export function stripComments(sql: string): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === "'" || ch === '"' || ch === "`") {
      const quote = ch;
      out += ch;
      i += 1;
      while (i < sql.length) {
        if (sql[i] === "\\" && quote === "'") {
          out += sql[i] + (sql[i + 1] ?? "");
          i += 2;
          continue;
        }
        // Doubled quote is an escaped quote, not a terminator.
        if (sql[i] === quote && sql[i + 1] === quote) {
          out += quote + quote;
          i += 2;
          continue;
        }
        out += sql[i];
        if (sql[i] === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    if (ch === "-" && next === "-") {
      while (i < sql.length && sql[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "#") {
      while (i < sql.length && sql[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }

    out += ch;
    i += 1;
  }
  return out;
}

/**
 * Splits on a separator that appears at paren depth 0 and outside quotes —
 * used for statement lists, column definition lists and index column lists.
 */
export function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  let quote: string | null = null;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (quote) {
      current += ch;
      if (ch === "\\" && quote === "'") {
        current += text[i + 1] ?? "";
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "(" || ch === "[") depth += 1;
    if (ch === ")" || ch === "]") depth -= 1;

    if (depth === 0 && ch === separator) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts.filter((p) => p.trim().length > 0);
}

/** Returns the body between the paren at `openIndex` and its match. */
function readBalanced(text: string, openIndex: number): { body: string; end: number } | null {
  if (text[openIndex] !== "(") return null;
  let depth = 0;
  let quote: string | null = null;

  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\" && quote === "'") {
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")") {
      depth -= 1;
      if (depth === 0) return { body: text.slice(openIndex + 1, i), end: i };
    }
  }
  return null;
}

function parseColumnList(body: string): string[] {
  return splitTopLevel(body, ",")
    .map((part) =>
      // Drop ordering/length modifiers: `name(10) DESC` -> `name`
      unquoteIdent(part.trim().replace(/\s*\(\s*\d+\s*\)\s*$/, "").replace(/\s+(asc|desc)\s*$/i, "")),
    )
    .filter(Boolean);
}

const REFERENTIAL_ACTION = String.raw`(cascade|restrict|set\s+null|set\s+default|no\s+action)`;

function readReferentialActions(text: string): { onDelete?: string; onUpdate?: string } {
  const onDelete = text.match(new RegExp(String.raw`on\s+delete\s+${REFERENTIAL_ACTION}`, "i"));
  const onUpdate = text.match(new RegExp(String.raw`on\s+update\s+${REFERENTIAL_ACTION}`, "i"));
  return {
    onDelete: onDelete?.[1].replace(/\s+/g, " ").toUpperCase(),
    onUpdate: onUpdate?.[1].replace(/\s+/g, " ").toUpperCase(),
  };
}

/** Words that continue a type rather than starting a constraint clause. */
const TYPE_CONTINUATION = new Set([
  "UNSIGNED",
  "SIGNED",
  "ZEROFILL",
  "PRECISION",
  "VARYING",
  "WITH",
  "WITHOUT",
  "TIME",
  "ZONE",
  "LOCAL",
]);

interface Token {
  text: string;
  isGroup: boolean;
}

function tokenizeDefinition(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "(") {
      const balanced = readBalanced(text, i);
      if (!balanced) break;
      tokens.push({ text: `(${balanced.body})`, isGroup: true });
      i = balanced.end + 1;
      continue;
    }
    if (ch === '"' || ch === "`" || ch === "[") {
      const closing = ch === "[" ? "]" : ch;
      const end = text.indexOf(closing, i + 1);
      if (end === -1) break;
      tokens.push({ text: text.slice(i, end + 1), isGroup: false });
      i = end + 1;
      continue;
    }
    if (ch === ",") {
      tokens.push({ text: ",", isGroup: false });
      i += 1;
      continue;
    }
    let j = i;
    while (j < text.length && !/[\s(,]/.test(text[j]) && !['"', "`", "["].includes(text[j])) j += 1;
    tokens.push({ text: text.slice(i, j), isGroup: false });
    i = j;
  }
  return tokens;
}

interface ParsedColumnDef {
  column: Column;
  reference?: { table: string; column: string; onDelete?: string; onUpdate?: string };
}

function parseColumnDefinition(definition: string): ParsedColumnDef | null {
  const tokens = tokenizeDefinition(definition);
  if (tokens.length === 0) return null;

  const name = unquoteIdent(tokens[0].text);
  if (!name) return null;

  // Accumulate the type: the head word, an optional precision group, and any
  // continuation keywords (`DOUBLE PRECISION`, `TIMESTAMP WITH TIME ZONE`).
  const typeTokens: Token[] = [];
  let i = 1;
  let consumedGroup = false;

  if (i < tokens.length && !tokens[i].isGroup) {
    typeTokens.push(tokens[i]);
    i += 1;
  }
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.isGroup && !consumedGroup && typeTokens.length > 0) {
      typeTokens.push(token);
      consumedGroup = true;
      i += 1;
      continue;
    }
    if (!token.isGroup && TYPE_CONTINUATION.has(token.text.toUpperCase())) {
      typeTokens.push(token);
      i += 1;
      continue;
    }
    if (!token.isGroup && token.text === "[]") {
      typeTokens.push(token);
      i += 1;
      continue;
    }
    break;
  }

  // Precision groups bind tightly (`VARCHAR(255)`), keywords do not
  // (`DOUBLE PRECISION`).
  const typeText = typeTokens.reduce(
    (acc, token) => acc + (token.isGroup || acc === "" ? "" : " ") + token.text,
    "",
  );

  const rest = tokens
    .slice(i)
    .map((t) => t.text)
    .join(" ");

  const parsedType = parseColumnType(typeText);
  const isPrimaryKey = /\bprimary\s+key\b/i.test(rest);
  const notNull = /\bnot\s+null\b/i.test(rest);
  const isUnique = /\bunique\b/i.test(rest);
  const isAutoIncrement =
    /\b(auto_increment|autoincrement|identity)\b/i.test(rest) ||
    /\bgenerated\s+(always|by\s+default)\s+as\s+identity\b/i.test(rest) ||
    /^(serial|bigserial|smallserial|serial2|serial4|serial8)$/i.test(parsedType.rawType.trim());

  const defaultMatch = rest.match(
    /\bdefault\s+('(?:[^']|'')*'|"(?:[^"]|"")*"|[\w.$]+\s*\([^)]*\)|[\w.$'+-]+)/i,
  );

  const column: Column = {
    name,
    rawType: parsedType.rawType || "UNKNOWN",
    family: parsedType.family,
    length: parsedType.length,
    isPrimaryKey,
    isNullable: !notNull && !isPrimaryKey,
    isUnique: isUnique || isPrimaryKey,
    isAutoIncrement,
    defaultValue: defaultMatch?.[1],
    isForeignKey: false,
    isIndexed: false,
  };

  const refMatch = rest.match(
    new RegExp(String.raw`\breferences\s+(${QUALIFIED_IDENT})\s*(?:\(\s*(${IDENT})\s*\))?`, "i"),
  );

  if (!refMatch) return { column };

  const actions = readReferentialActions(rest);
  return {
    column,
    reference: {
      table: unquoteIdent(refMatch[1]),
      column: refMatch[2] ? unquoteIdent(refMatch[2]) : "",
      ...actions,
    },
  };
}

interface TableConstraintResult {
  primaryKeyColumns?: string[];
  index?: TableIndex;
  relations?: Array<{
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
    onDelete?: string;
    onUpdate?: string;
  }>;
}

function parseTableConstraint(rawConstraint: string): TableConstraintResult | null {
  // `CONSTRAINT fk_name FOREIGN KEY (...)` -> drop the naming prefix.
  let constraint = rawConstraint.trim();
  let constraintName = "";
  const named = constraint.match(new RegExp(String.raw`^constraint\s+(${IDENT})\s+`, "i"));
  if (named) {
    constraintName = unquoteIdent(named[1]);
    constraint = constraint.slice(named[0].length).trim();
  }

  const fk = constraint.match(
    new RegExp(
      String.raw`^foreign\s+key\s*(?:${IDENT}\s*)?\(([^)]*)\)\s*references\s+(${QUALIFIED_IDENT})\s*(?:\(([^)]*)\))?`,
      "i",
    ),
  );
  if (fk) {
    const sourceColumns = parseColumnList(fk[1]);
    const targetColumns = fk[3] ? parseColumnList(fk[3]) : [];
    const actions = readReferentialActions(constraint);
    return {
      relations: sourceColumns.map((sourceColumn, index) => ({
        sourceColumn,
        targetTable: unquoteIdent(fk[2]),
        targetColumn: targetColumns[index] ?? "",
        ...actions,
      })),
    };
  }

  const pk = constraint.match(/^primary\s+key\s*(?:clustered\s*)?\(([^)]*)\)/i);
  if (pk) {
    const columns = parseColumnList(pk[1]);
    return {
      primaryKeyColumns: columns,
      index: {
        name: constraintName || "PRIMARY",
        columns,
        isUnique: true,
        isImplicit: true,
      },
    };
  }

  const unique = constraint.match(
    new RegExp(String.raw`^unique\s*(?:key|index)?\s*(${IDENT})?\s*\(([^)]*)\)`, "i"),
  );
  if (unique) {
    return {
      index: {
        name: constraintName || (unique[1] ? unquoteIdent(unique[1]) : "unique"),
        columns: parseColumnList(unique[2]),
        isUnique: true,
        isImplicit: true,
      },
    };
  }

  const key = constraint.match(
    new RegExp(String.raw`^(?:key|index)\s+(${IDENT})?\s*\(([^)]*)\)`, "i"),
  );
  if (key) {
    return {
      index: {
        name: key[1] ? unquoteIdent(key[1]) : "index",
        columns: parseColumnList(key[2]),
        isUnique: false,
        isImplicit: false,
      },
    };
  }

  return null;
}

interface ParseState {
  tables: Map<string, Table>;
  relations: Relation[];
  notes: string[];
}

function relationFrom(
  sourceTable: string,
  sourceColumn: string,
  targetTable: string,
  targetColumn: string,
  actions: { onDelete?: string; onUpdate?: string },
): Relation {
  return {
    id: `${sourceTable}.${sourceColumn}->${targetTable}.${targetColumn}`,
    sourceTable: sourceTable.toLowerCase(),
    sourceColumn,
    targetTable: targetTable.toLowerCase(),
    targetColumn,
    kind: "explicit",
    onDelete: actions.onDelete,
    onUpdate: actions.onUpdate,
    warnings: [],
    health: "ok",
  };
}

function handleCreateTable(statement: string, state: ParseState): boolean {
  const header = statement.match(
    new RegExp(
      String.raw`^create\s+(?:temporary\s+|temp\s+|global\s+|local\s+|unlogged\s+)*table\s+(?:if\s+not\s+exists\s+)?(${QUALIFIED_IDENT})`,
      "i",
    ),
  );
  if (!header) return false;

  const openIndex = statement.indexOf("(", header[0].length);
  if (openIndex === -1) return false;
  const balanced = readBalanced(statement, openIndex);
  if (!balanced) return false;

  const tableName = unquoteIdent(header[1]);
  const table = state.tables.get(tableName.toLowerCase()) ?? makeTable(tableName);
  state.tables.set(table.id, table);

  const parts = splitTopLevel(balanced.body, ",");
  const pendingPrimaryKeys: string[] = [];

  for (const part of parts) {
    const definition = part.trim();
    if (!definition) continue;

    const constraintResult = /^(constraint|primary\s+key|foreign\s+key|unique|key|index|check|exclude|fulltext|spatial)\b/i.test(
      definition,
    )
      ? parseTableConstraint(definition)
      : null;

    if (/^(check|exclude|fulltext|spatial)\b/i.test(definition)) continue;

    if (constraintResult) {
      if (constraintResult.primaryKeyColumns) pendingPrimaryKeys.push(...constraintResult.primaryKeyColumns);
      if (constraintResult.index) table.indexes.push(constraintResult.index);
      for (const relation of constraintResult.relations ?? []) {
        state.relations.push(
          relationFrom(table.id, relation.sourceColumn, relation.targetTable, relation.targetColumn, relation),
        );
      }
      continue;
    }

    if (/^(constraint|primary\s+key|foreign\s+key|unique|key|index)\b/i.test(definition)) {
      state.notes.push(`Unrecognised constraint on ${table.name}: ${definition.slice(0, 80)}`);
      continue;
    }

    const parsed = parseColumnDefinition(definition);
    if (!parsed) continue;

    const existing = table.columns.findIndex(
      (c) => c.name.toLowerCase() === parsed.column.name.toLowerCase(),
    );
    if (existing >= 0) table.columns[existing] = parsed.column;
    else table.columns.push(parsed.column);

    if (parsed.column.isPrimaryKey) {
      table.indexes.push({
        name: "PRIMARY",
        columns: [parsed.column.name],
        isUnique: true,
        isImplicit: true,
      });
    }
    if (parsed.column.isUnique && !parsed.column.isPrimaryKey) {
      table.indexes.push({
        name: `unique_${parsed.column.name}`,
        columns: [parsed.column.name],
        isUnique: true,
        isImplicit: true,
      });
    }

    if (parsed.reference) {
      state.relations.push(
        relationFrom(
          table.id,
          parsed.column.name,
          parsed.reference.table,
          parsed.reference.column,
          parsed.reference,
        ),
      );
    }
  }

  for (const columnName of pendingPrimaryKeys) {
    const column = table.columns.find((c) => c.name.toLowerCase() === columnName.toLowerCase());
    if (column) {
      column.isPrimaryKey = true;
      column.isNullable = false;
      column.isUnique = true;
    }
  }

  return true;
}

function handleCreateIndex(statement: string, state: ParseState): boolean {
  const match = statement.match(
    new RegExp(
      String.raw`^create\s+(unique\s+)?(?:fulltext\s+|spatial\s+|clustered\s+|nonclustered\s+)?index\s+(?:if\s+not\s+exists\s+)?(${QUALIFIED_IDENT})?\s*on\s+(${QUALIFIED_IDENT})\s*(?:using\s+\w+\s*)?`,
      "i",
    ),
  );
  if (!match) return false;

  const openIndex = statement.indexOf("(", match[0].length - 1);
  if (openIndex === -1) return false;
  const balanced = readBalanced(statement, openIndex);
  if (!balanced) return false;

  const tableId = unquoteIdent(match[3]).toLowerCase();
  const table = state.tables.get(tableId);
  if (!table) {
    state.notes.push(`Index on unknown table "${unquoteIdent(match[3])}" ignored.`);
    return true;
  }

  table.indexes.push({
    name: match[2] ? unquoteIdent(match[2]) : `index_${table.indexes.length + 1}`,
    columns: parseColumnList(balanced.body),
    isUnique: Boolean(match[1]),
    isImplicit: false,
  });
  return true;
}

function handleAlterTable(statement: string, state: ParseState): boolean {
  const header = statement.match(
    new RegExp(String.raw`^alter\s+table\s+(?:only\s+)?(${QUALIFIED_IDENT})\s+(.*)$`, "is"),
  );
  if (!header) return false;

  const table = state.tables.get(unquoteIdent(header[1]).toLowerCase());
  if (!table) {
    state.notes.push(`ALTER TABLE on unknown table "${unquoteIdent(header[1])}" ignored.`);
    return true;
  }

  for (const clause of splitTopLevel(header[2], ",")) {
    const body = clause.trim().replace(/^add\s+(column\s+)?/i, "");
    const result = parseTableConstraint(body);
    if (!result) continue;

    if (result.primaryKeyColumns) {
      for (const columnName of result.primaryKeyColumns) {
        const column = table.columns.find((c) => c.name.toLowerCase() === columnName.toLowerCase());
        if (column) {
          column.isPrimaryKey = true;
          column.isNullable = false;
          column.isUnique = true;
        }
      }
    }
    if (result.index) table.indexes.push(result.index);
    for (const relation of result.relations ?? []) {
      state.relations.push(
        relationFrom(table.id, relation.sourceColumn, relation.targetTable, relation.targetColumn, relation),
      );
    }
  }
  return true;
}

export function parseSql(sql: string, name = "SQL schema"): SchemaGraph {
  const state: ParseState = { tables: new Map(), relations: [], notes: [] };
  const statements = splitTopLevel(stripComments(sql), ";");

  // CREATE TABLE first so that later CREATE INDEX / ALTER TABLE statements can
  // always resolve their target, regardless of dump ordering.
  const creates: string[] = [];
  const rest: string[] = [];
  for (const raw of statements) {
    const statement = raw.trim();
    if (!statement) continue;
    if (/^create\s+(?:temporary\s+|temp\s+|global\s+|local\s+|unlogged\s+)*table\b/i.test(statement)) {
      creates.push(statement);
    } else {
      rest.push(statement);
    }
  }

  for (const statement of creates) handleCreateTable(statement, state);

  for (const statement of rest) {
    if (handleCreateIndex(statement, state)) continue;
    if (handleAlterTable(statement, state)) continue;
    if (/^(insert|update|delete|set|begin|commit|rollback|pragma|use|drop|comment|grant|revoke|create\s+(view|trigger|sequence|schema|database|function|extension|type|procedure))\b/i.test(statement)) {
      continue;
    }
    state.notes.push(`Skipped unsupported statement: ${statement.slice(0, 80)}`);
  }

  if (state.tables.size === 0) {
    throw new Error(
      "No CREATE TABLE statements were found. Paste a DDL script that defines at least one table.",
    );
  }

  return finalizeGraph({
    name,
    source: "sql",
    tables: [...state.tables.values()],
    relations: state.relations,
    parseNotes: state.notes,
  });
}
