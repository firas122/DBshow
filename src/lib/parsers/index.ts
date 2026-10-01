import type { Locale } from "@/lib/i18n/locale";
import { UI_STRINGS } from "@/lib/i18n/ui";
import { parseJsonSchema } from "@/lib/parsers/jsonParser";
import { parseSql } from "@/lib/parsers/sqlParser";
import { parseSqlite } from "@/lib/parsers/sqliteParser";
import { lintSchema } from "@/lib/validators/schemaLinter";
import type { SchemaGraph } from "@/lib/types";

export const ACCEPTED_EXTENSIONS = [".sql", ".ddl", ".sqlite", ".sqlite3", ".db", ".json", ".txt"];

const SQLITE_MAGIC = "SQLite format 3";

const PARSE_ERRORS: Record<Locale, { empty: string; noUrl: string; liveConnection: string; httpOnly: string; fetchFailed: (status: number) => string }> = {
  en: {
    empty: "Nothing to parse — the input is empty.",
    noUrl: "Enter a URL first.",
    liveConnection:
      "Live database connection strings cannot be opened from the browser. Export the schema first (pg_dump --schema-only, mysqldump --no-data, or sqlite3 .schema) and load that file instead.",
    httpOnly: "Only http(s) URLs are supported.",
    fetchFailed: (status) => `Could not fetch that URL (HTTP ${status}).`,
  },
  fr: {
    empty: "Rien à analyser — le contenu est vide.",
    noUrl: "Saisissez d'abord une URL.",
    liveConnection:
      "Les chaînes de connexion à une base de données en direct ne peuvent pas être ouvertes depuis le navigateur. Exportez d'abord le schéma (pg_dump --schema-only, mysqldump --no-data, ou sqlite3 .schema) puis chargez ce fichier.",
    httpOnly: "Seules les URL http(s) sont prises en charge.",
    fetchFailed: (status) => `Impossible de récupérer cette URL (HTTP ${status}).`,
  },
};

function hasSqliteMagic(buffer: ArrayBuffer): boolean {
  const header = new Uint8Array(buffer.slice(0, SQLITE_MAGIC.length));
  return new TextDecoder().decode(header) === SQLITE_MAGIC;
}

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "") || fileName;
}

/** Sniffs raw text: JSON if it opens with a brace/bracket, otherwise SQL DDL. */
export function parseTextSchema(content: string, name?: string, locale: Locale = "en"): SchemaGraph {
  const resolvedName = name ?? UI_STRINGS[locale].defaultNames.pasted;
  const trimmed = content.trim();
  if (!trimmed) throw new Error(PARSE_ERRORS[locale].empty);
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return lintSchema(parseJsonSchema(trimmed, resolvedName), locale);
  }
  return lintSchema(parseSql(trimmed, resolvedName), locale);
}

export async function parseFile(file: File, locale: Locale = "en"): Promise<SchemaGraph> {
  const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  const name = baseName(file.name);

  if ([".sqlite", ".sqlite3", ".db"].includes(extension)) {
    return lintSchema(await parseSqlite(await file.arrayBuffer(), name), locale);
  }
  if (extension === ".json") {
    return lintSchema(parseJsonSchema(await file.text(), name), locale);
  }
  if ([".sql", ".ddl", ".txt"].includes(extension)) {
    return lintSchema(parseSql(await file.text(), name), locale);
  }

  // Unknown extension: fall back to content sniffing.
  const buffer = await file.arrayBuffer();
  if (hasSqliteMagic(buffer)) {
    return lintSchema(await parseSqlite(buffer, name), locale);
  }
  return parseTextSchema(new TextDecoder().decode(buffer), name, locale);
}

const CONNECTION_SCHEMES = /^(postgres|postgresql|mysql|mariadb|mongodb|mssql|sqlserver|redis):\/\//i;

/**
 * Loads a schema from a URL. The bytes are proxied through our own route
 * handler because arbitrary origins will not send CORS headers.
 */
export async function parseFromUrl(rawUrl: string, locale: Locale = "en"): Promise<SchemaGraph> {
  const url = rawUrl.trim();
  if (!url) throw new Error(PARSE_ERRORS[locale].noUrl);

  if (CONNECTION_SCHEMES.test(url)) {
    throw new Error(PARSE_ERRORS[locale].liveConnection);
  }
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(PARSE_ERRORS[locale].httpOnly);
  }

  const response = await fetch(`/api/fetch-schema?url=${encodeURIComponent(url)}`);
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error ?? PARSE_ERRORS[locale].fetchFailed(response.status));
  }

  const buffer = await response.arrayBuffer();
  const name = baseName(
    decodeURIComponent(new URL(url).pathname.split("/").pop() || UI_STRINGS[locale].defaultNames.remote),
  );

  if (hasSqliteMagic(buffer)) {
    return lintSchema(await parseSqlite(buffer, name), locale);
  }
  return parseTextSchema(new TextDecoder().decode(buffer), name, locale);
}
