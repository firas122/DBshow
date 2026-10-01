import { finalizeGraph, makeTable } from "@/lib/schema/finalize";
import { parseColumnType } from "@/lib/schema/types-util";
import type { Column, Relation, SchemaGraph, Table, TableIndex } from "@/lib/types";

/**
 * Reads a real SQLite binary in the browser via sql.js (WebAssembly).
 *
 * sql.js is loaded from /public with a script tag instead of being bundled: its
 * emscripten glue references node builtins, which the bundler would otherwise
 * try (and fail) to resolve for the browser target.
 */

type SqlValue = string | number | Uint8Array | null;

interface QueryResult {
  columns: string[];
  values: SqlValue[][];
}

interface SqlDatabase {
  exec(sql: string): QueryResult[];
  close(): void;
}

interface SqlJsStatic {
  Database: new (data: Uint8Array) => SqlDatabase;
}

declare global {
  interface Window {
    initSqlJs?: (config: { locateFile: (file: string) => string }) => Promise<SqlJsStatic>;
  }
}

const SQL_JS_SCRIPT = "/sql-wasm/sql-wasm.js";
let sqlJsPromise: Promise<SqlJsStatic> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") resolve();
      else {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
      }
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
    document.head.appendChild(script);
  });
}

export function loadSqlJs(): Promise<SqlJsStatic> {
  if (sqlJsPromise) return sqlJsPromise;
  sqlJsPromise = (async () => {
    if (typeof window === "undefined") throw new Error("SQLite parsing is browser-only.");
    if (!window.initSqlJs) await loadScript(SQL_JS_SCRIPT);
    if (!window.initSqlJs) {
      throw new Error(
        "sql.js failed to load. Run `node scripts/copy-sql-wasm.mjs` to restore public/sql-wasm/.",
      );
    }
    return window.initSqlJs({ locateFile: (file) => `/sql-wasm/${file}` });
  })();
  return sqlJsPromise;
}

function rows(result: QueryResult[] | undefined): Record<string, SqlValue>[] {
  const first = result?.[0];
  if (!first) return [];
  return first.values.map((value) => {
    const row: Record<string, SqlValue> = {};
    first.columns.forEach((column, index) => {
      row[column] = value[index];
    });
    return row;
  });
}

function text(value: SqlValue): string {
  return value === null || value === undefined ? "" : String(value);
}

function escapeLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

export async function parseSqlite(
  buffer: ArrayBuffer,
  name = "SQLite database",
): Promise<SchemaGraph> {
  const SQL = await loadSqlJs();
  const db = new SQL.Database(new Uint8Array(buffer));

  try {
    const tables: Table[] = [];
    const relations: Relation[] = [];
    const notes: string[] = [];

    const tableRows = rows(
      db.exec(
        `SELECT name FROM sqlite_master
         WHERE type = 'table'
           AND name NOT LIKE 'sqlite_%'
           AND name NOT LIKE '_litestream%'
         ORDER BY name;`,
      ),
    );

    if (tableRows.length === 0) {
      throw new Error("This SQLite file contains no user tables.");
    }

    for (const tableRow of tableRows) {
      const tableName = text(tableRow.name);
      const table = makeTable(tableName);
      const literal = escapeLiteral(tableName);

      const columnRows = rows(db.exec(`PRAGMA table_info('${literal}');`));
      for (const columnRow of columnRows) {
        const parsedType = parseColumnType(text(columnRow.type));
        const isPrimaryKey = Number(columnRow.pk ?? 0) > 0;
        const column: Column = {
          name: text(columnRow.name),
          rawType: parsedType.rawType || "BLOB",
          family: parsedType.family,
          length: parsedType.length,
          isPrimaryKey,
          isNullable: Number(columnRow.notnull ?? 0) === 0 && !isPrimaryKey,
          isUnique: isPrimaryKey,
          isAutoIncrement: false,
          defaultValue: columnRow.dflt_value === null ? undefined : text(columnRow.dflt_value),
          isForeignKey: false,
          isIndexed: false,
        };
        table.columns.push(column);
      }

      // AUTOINCREMENT is not exposed by PRAGMA, so read it off the stored DDL.
      const ddl = rows(
        db.exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${literal}';`),
      )[0];
      const ddlText = text(ddl?.sql);
      if (/autoincrement/i.test(ddlText)) {
        const pk = table.columns.find((c) => c.isPrimaryKey);
        if (pk) pk.isAutoIncrement = true;
      }

      const indexRows = rows(db.exec(`PRAGMA index_list('${literal}');`));
      for (const indexRow of indexRows) {
        const indexName = text(indexRow.name);
        const indexColumns = rows(db.exec(`PRAGMA index_info('${escapeLiteral(indexName)}');`))
          .sort((a, b) => Number(a.seqno) - Number(b.seqno))
          .map((row) => text(row.name))
          .filter(Boolean);

        const index: TableIndex = {
          name: indexName,
          columns: indexColumns,
          isUnique: Number(indexRow.unique ?? 0) === 1,
          // origin: 'c' = CREATE INDEX, 'u' = UNIQUE constraint, 'pk' = PK.
          isImplicit: text(indexRow.origin) !== "c",
        };
        table.indexes.push(index);
        if (index.isUnique && index.columns.length === 1) {
          const column = table.columns.find((c) => c.name === index.columns[0]);
          if (column) column.isUnique = true;
        }
      }

      const foreignKeys = rows(db.exec(`PRAGMA foreign_key_list('${literal}');`));
      for (const fk of foreignKeys) {
        relations.push({
          id: `${table.id}.${text(fk.from)}->${text(fk.table)}.${text(fk.to)}`,
          sourceTable: table.id,
          sourceColumn: text(fk.from),
          targetTable: text(fk.table).toLowerCase(),
          targetColumn: text(fk.to),
          kind: "explicit",
          onDelete: text(fk.on_delete) || undefined,
          onUpdate: text(fk.on_update) || undefined,
          warnings: [],
          health: "ok",
        });
      }

      tables.push(table);
    }

    const viewCount = rows(
      db.exec(`SELECT count(*) AS n FROM sqlite_master WHERE type = 'view';`),
    )[0];
    if (Number(viewCount?.n ?? 0) > 0) {
      notes.push(`${viewCount.n} view(s) were skipped — only tables are visualised.`);
    }

    return finalizeGraph({ name, source: "sqlite", tables, relations, parseNotes: notes });
  } finally {
    db.close();
  }
}
