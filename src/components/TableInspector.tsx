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

import { useT } from "@/lib/i18n/useT";
import { SEVERITY_CLASSES } from "@/lib/theme";
import { useSchemaStore, findTable, relationsForTable } from "@/state/useSchemaStore";
import type { Relation } from "@/lib/types";

const SEVERITY_ICON = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

function RelationRow({ relation, direction }: { relation: Relation; direction: "out" | "in" }) {
  const t = useT();
  const focusTable = useSchemaStore((state) => state.focusTable);
  const highlightRelation = useSchemaStore((state) => state.highlightRelation);
  const hoverRelation = useSchemaStore((state) => state.hoverRelation);

  const otherTable = direction === "out" ? relation.targetTable : relation.sourceTable;
  const Icon = direction === "out" ? ArrowUpRight : ArrowDownLeft;

  const tone =
    relation.health === "error"
      ? "text-stamp-error"
      : relation.health === "warning"
        ? "text-stamp-warning"
        : "text-[#22d3ee]";

  return (
    <button
      type="button"
      onMouseEnter={() => hoverRelation(relation.id)}
      onMouseLeave={() => hoverRelation(null)}
      onClick={() => {
        highlightRelation(relation.id);
        focusTable(otherTable);
      }}
      className="flex w-full items-center gap-2 rounded-sm border border-hairline/15 bg-white/[0.02] px-2.5 py-2 text-left transition hover:border-marigold/30 hover:bg-marigold/5"
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
        <span className="shrink-0 rounded-sm bg-stamp-warning/15 px-1 py-px text-[9px] font-medium text-stamp-warning">
          {t.inspector.badges.suggested}
        </span>
      )}
      {relation.dangling && (
        <span className="shrink-0 rounded-sm bg-stamp-error/15 px-1 py-px text-[9px] font-medium text-stamp-error">
          {t.inspector.badges.dangling}
        </span>
      )}
    </button>
  );
}

export default function TableInspector() {
  const t = useT();
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
    <aside className="animate-sheet-in panel pointer-events-auto absolute top-0 right-0 bottom-0 z-30 flex w-full max-w-[24rem] flex-col border-l">
      <header className="flex items-start justify-between gap-3 border-b border-hairline/15 px-4 py-3.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Table2 className="h-4 w-4 text-marigold-light" />
            <span className="truncate font-mono">{table.name}</span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {t.inspector.summary(table.columns.length, links.outgoing.length, links.incoming.length)}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => focusTable(table.id)}
            aria-label={t.inspector.focusAria}
            className="rounded-sm p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-marigold-light"
          >
            <Crosshair className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label={t.inspector.closeAria}
            className="rounded-sm p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {table.warnings.length > 0 && (
          <section className="border-b border-hairline/15 px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              {t.inspector.sections.warnings}
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
                    className={`flex w-full items-start gap-2 rounded-sm border px-2.5 py-2 text-left transition hover:brightness-125 ${classes.border} ${classes.bg}`}
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

        <section className="border-b border-hairline/15 px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
            {t.inspector.sections.columns}
          </p>
          <div className="space-y-0.5">
            {table.columns.map((column) => (
              <div
                key={column.name}
                className="flex items-center gap-2 rounded-sm px-1.5 py-1.5 transition hover:bg-white/5"
              >
                <span className="w-4 shrink-0">
                  {column.isPrimaryKey ? (
                    <KeyRound className="h-3.5 w-3.5 text-[#fbbf24]" />
                  ) : column.isForeignKey ? (
                    <Link2 className="h-3.5 w-3.5 text-[#22d3ee]" />
                  ) : (
                    <span className="ml-1 block h-1 w-1 rounded-full bg-slate-600" />
                  )}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate font-mono text-[12px] ${
                    column.isPrimaryKey
                      ? "font-semibold text-[#fbbf24]"
                      : column.isForeignKey
                        ? "text-[#67e0f2]"
                        : "text-slate-300"
                  }`}
                >
                  {column.name}
                </span>
                {column.isForeignKey && !column.isIndexed && (
                  <span
                    title={t.inspector.badges.noIndex}
                    className="shrink-0 rounded-sm bg-stamp-warning/15 px-1 py-px text-[9px] font-medium text-stamp-warning"
                  >
                    {t.inspector.badges.noIndex}
                  </span>
                )}
                {!column.isNullable && (
                  <span className="shrink-0 text-[9px] font-medium tracking-wide text-slate-500">
                    {t.inspector.badges.notNull}
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
          <section className="border-b border-hairline/15 px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              {t.inspector.sections.relationships}
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
              {t.inspector.sections.indexes}
            </p>
            <div className="space-y-1">
              {explicitIndexes.map((index) => (
                <div
                  key={index.name}
                  className="flex items-center gap-2 rounded-sm border border-hairline/15 bg-white/[0.02] px-2.5 py-1.5"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-300">
                    {index.name}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    ({index.columns.join(", ")})
                  </span>
                  {index.isUnique && (
                    <span className="rounded-sm bg-[#22d3ee]/15 px-1 py-px text-[9px] font-medium text-[#67e0f2]">
                      {t.inspector.badges.unique}
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
