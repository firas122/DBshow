import { parseJsonSchema } from "@/lib/parsers/jsonParser";
import { parseSql } from "@/lib/parsers/sqlParser";
import { parseSqlite } from "@/lib/parsers/sqliteParser";
import { lintSchema } from "@/lib/validators/schemaLinter";
import type { SchemaGraph } from "@/lib/types";

export const ACCEPTED_EXTENSIONS = [".sql", ".ddl", ".sqlite", ".sqlite3", ".db", ".json", ".txt"];

const SQLITE_MAGIC = "SQLite format 3";

function hasSqliteMagic(buffer: ArrayBuffer): boolean {
  const header = new Uint8Array(buffer.slice(0, SQLITE_MAGIC.length));
  return new TextDecoder().decode(header) === SQLITE_MAGIC;
}

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "") || fileName;
}

/** Sniffs raw text: JSON if it opens with a brace/bracket, otherwise SQL DDL. */
export function parseTextSchema(content: string, name = "Pasted schema"): SchemaGraph {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Nothing to parse — the input is empty.");
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return lintSchema(parseJsonSchema(trimmed, name));
  }
  return lintSchema(parseSql(trimmed, name));
}

export async function parseFile(file: File): Promise<SchemaGraph> {
  const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  const name = baseName(file.name);

  if ([".sqlite", ".sqlite3", ".db"].includes(extension)) {
    return lintSchema(await parseSqlite(await file.arrayBuffer(), name));
  }
  if (extension === ".json") {
    return lintSchema(parseJsonSchema(await file.text(), name));
  }
  if ([".sql", ".ddl", ".txt"].includes(extension)) {
    return lintSchema(parseSql(await file.text(), name));
  }

  // Unknown extension: fall back to content sniffing.
  const buffer = await file.arrayBuffer();
  if (hasSqliteMagic(buffer)) {
    return lintSchema(await parseSqlite(buffer, name));
  }
  return parseTextSchema(new TextDecoder().decode(buffer), name);
}

const CONNECTION_SCHEMES = /^(postgres|postgresql|mysql|mariadb|mongodb|mssql|sqlserver|redis):\/\//i;

/**
 * Loads a schema from a URL. The bytes are proxied through our own route
 * handler because arbitrary origins will not send CORS headers.
 */
export async function parseFromUrl(rawUrl: string): Promise<SchemaGraph> {
  const url = rawUrl.trim();
  if (!url) throw new Error("Enter a URL first.");

  if (CONNECTION_SCHEMES.test(url)) {
    throw new Error(
      "Live database connection strings cannot be opened from the browser. Export the schema first (pg_dump --schema-only, mysqldump --no-data, or sqlite3 .schema) and load that file instead.",
    );
  }
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Only http(s) URLs are supported.");
  }

  const response = await fetch(`/api/fetch-schema?url=${encodeURIComponent(url)}`);
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error ?? `Could not fetch that URL (HTTP ${response.status}).`);
  }

  const buffer = await response.arrayBuffer();
  const name = baseName(decodeURIComponent(new URL(url).pathname.split("/").pop() || "Remote schema"));

  if (hasSqliteMagic(buffer)) {
    return lintSchema(await parseSqlite(buffer, name));
  }
  return parseTextSchema(new TextDecoder().decode(buffer), name);
}
