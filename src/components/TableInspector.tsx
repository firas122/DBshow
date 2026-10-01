"use client";

import { useMemo } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Crosshair,
  Info,
  KeyRound,
  Link2,
  Table2,
  X,
  Zap,
} from "lucide-react";

import { SEVERITY_CLASSES } from "@/lib/theme";
import { useSchemaStore, findTable, relationsForTable } from "@/state/useSchemaStore";
import type { Relation } from "@/lib/types";

const SEVERITY_ICON = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

function RelationRow({ relation, direction }: { relation: Relation; direction: "out" | "in" }) {
  const focusTable = useSchemaStore((state) => state.focusTable);
  const highlightRelation = useSchemaStore((state) => state.highlightRelation);
  const hoverRelation = useSchemaStore((state) => state.hoverRelation);

  const otherTable = direction === "out" ? relation.targetTable : relation.sourceTable;
  const Icon = direction === "out" ? ArrowUpRight : ArrowDownLeft;

  const tone =
    relation.health === "error"
      ? "text-rose-300"
      : relation.health === "warning"
        ? "text-amber-300"
        : "text-cyan-300";

  return (
    <button
      type="button"
      onMouseEnter={() => hoverRelation(relation.id)}
      onMouseLeave={() => hoverRelation(null)}
      onClick={() => {
        highlightRelation(relation.id);
        focusTable(otherTable);
      }}
      className="flex w-full items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-2 text-left transition hover:border-cyan-400/30 hover:bg-cyan-400/5"
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${tone}`} />
      <span className="min-w-0 flex-1 font-mono text-[11px] text-slate-300">
        <span className="text-slate-400">
          {relation.sourceTable}.{relation.sourceColumn}
        </span>
        <span className="mx-1 text-slate-600">→</span>
        <span className="text-slate-200">
          {relation.targetTable}.{relation.targetColumn || "?"}
        </span>
      </span>
      {relation.kind === "implicit" && (
        <span className="shrink-0 rounded bg-amber-500/15 px-1 py-px text-[9px] font-medium text-amber-300">
          suggested
        </span>
      )}
      {relation.dangling && (
        <span className="shrink-0 rounded bg-rose-500/15 px-1 py-px text-[9px] font-medium text-rose-300">
          dangling
        </span>
      )}
    </button>
  );
}

export default function TableInspector() {
  const graph = useSchemaStore((state) => state.graph);
  const drawer = useSchemaStore((state) => state.drawer);
  const selectedTableId = useSchemaStore((state) => state.selectedTableId);
  const closeDrawer = useSchemaStore((state) => state.closeDrawer);
  const focusTable = useSchemaStore((state) => state.focusTable);
  const openHealth = useSchemaStore((state) => state.openHealth);

  const table = useMemo(() => findTable(graph, selectedTableId), [graph, selectedTableId]);
  const links = useMemo(
    () => (graph && table ? relationsForTable(graph, table.id) : { outgoing: [], incoming: [] }),
    [graph, table],
  );

  if (drawer !== "inspector" || !table) return null;

  const explicitIndexes = table.indexes.filter((index) => !index.isImplicit);

  return (
    <aside className="animate-drawer-in glass pointer-events-auto absolute top-0 right-0 bottom-0 z-30 flex w-full max-w-[24rem] flex-col border-l">
      <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Table2 className="h-4 w-4 text-cyan-300" />
            <span className="truncate font-mono">{table.name}</span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {table.columns.length} columns · {links.outgoing.length} out · {links.incoming.length} in
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => focusTable(table.id)}
            aria-label="Focus camera on table"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-cyan-300"
          >
            <Crosshair className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close inspector"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {table.warnings.length > 0 && (
          <section className="border-b border-white/10 px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              Warnings
            </p>
            <div className="space-y-1.5">
              {table.warnings.map((warning) => {
                const classes = SEVERITY_CLASSES[warning.severity];
                const Icon = SEVERITY_ICON[warning.severity];
                return (
                  <button
                    key={warning.id}
                    type="button"
                    onClick={() => openHealth(warning.id)}
                    className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition hover:brightness-125 ${classes.border} ${classes.bg}`}
                  >
                    <Icon className={`mt-px h-3.5 w-3.5 shrink-0 ${classes.text}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[11px] font-semibold ${classes.text}`}>
                        {warning.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">
                        {warning.message}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="border-b border-white/10 px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
            Columns
          </p>
          <div className="space-y-0.5">
            {table.columns.map((column) => (
              <div
                key={column.name}
                className="flex items-center gap-2 rounded-md px-1.5 py-1.5 transition hover:bg-white/5"
              >
                <span className="w-4 shrink-0">
                  {column.isPrimaryKey ? (
                    <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                  ) : column.isForeignKey ? (
                    <Link2 className="h-3.5 w-3.5 text-cyan-400" />
                  ) : (
                    <span className="ml-1 block h-1 w-1 rounded-full bg-slate-600" />
                  )}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate font-mono text-[12px] ${
                    column.isPrimaryKey
                      ? "font-semibold text-amber-200"
                      : column.isForeignKey
                        ? "text-cyan-200"
                        : "text-slate-300"
                  }`}
                >
                  {column.name}
                </span>
                {column.isForeignKey && !column.isIndexed && (
                  <span
                    title="Foreign key without a supporting index"
                    className="shrink-0 rounded bg-amber-500/15 px-1 py-px text-[9px] font-medium text-amber-300"
                  >
                    no idx
                  </span>
                )}
                {!column.isNullable && (
                  <span className="shrink-0 text-[9px] font-medium tracking-wide text-slate-500">
                    NOT NULL
                  </span>
                )}
                <span className="shrink-0 font-mono text-[10px] text-slate-500">
                  {column.rawType}
                </span>
              </div>
            ))}
          </div>
        </section>

        {(links.outgoing.length > 0 || links.incoming.length > 0) && (
          <section className="border-b border-white/10 px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              Relationships
            </p>
            <div className="space-y-1.5">
              {links.outgoing.map((relation) => (
                <RelationRow key={relation.id} relation={relation} direction="out" />
              ))}
              {links.incoming.map((relation) => (
                <RelationRow key={relation.id} relation={relation} direction="in" />
              ))}
            </div>
          </section>
        )}

        {explicitIndexes.length > 0 && (
          <section className="px-4 py-3">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              <Zap className="h-3 w-3" />
              Indexes
            </p>
            <div className="space-y-1">
              {explicitIndexes.map((index) => (
                <div
                  key={index.name}
                  className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-300">
                    {index.name}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    ({index.columns.join(", ")})
                  </span>
                  {index.isUnique && (
                    <span className="rounded bg-cyan-500/15 px-1 py-px text-[9px] font-medium text-cyan-300">
                      unique
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
