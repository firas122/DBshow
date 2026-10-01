"use client";

import {
  ArrowRight,
  Edit3,
  GitCompare,
  Minus,
  Plus,
  X,
} from "lucide-react";

import { useT } from "@/lib/i18n/useT";
import { DIFF_CLASSES } from "@/lib/theme";
import { useSchemaStore } from "@/state/useSchemaStore";
import type { RelationDiffEntry, TableDiffEntry } from "@/lib/diff/schemaDiff";

const STATUS_ICON = { added: Plus, removed: Minus, modified: Edit3 } as const;

function TableRow({ entry }: { entry: TableDiffEntry }) {
  const focusTable = useSchemaStore((state) => state.focusTable);
  const classes = DIFF_CLASSES[entry.status];
  const Icon = STATUS_ICON[entry.status];

  return (
    <button
      type="button"
      onClick={() => focusTable(entry.tableId)}
      className={`flex w-full items-start gap-2.5 rounded-sm border-l-2 px-3 py-2 text-left transition hover:bg-white/[0.04] ${classes.border} bg-white/[0.02]`}
    >
      <Icon className={`mt-px h-3.5 w-3.5 shrink-0 ${classes.text}`} />
      <span className="min-w-0 flex-1">
        <span className="truncate font-mono text-[13px] font-medium text-slate-100">{entry.name}</span>
        {entry.status === "modified" && (
          <span className="mt-1 block space-y-0.5 font-mono text-[11px] text-slate-500">
            {entry.addedColumns.map((name) => (
              <span key={`add:${name}`} className="block text-stamp-added/80">
                + {name}
              </span>
            ))}
            {entry.removedColumns.map((name) => (
              <span key={`rm:${name}`} className="block text-stamp-removed/80">
                − {name}
              </span>
            ))}
            {entry.changedColumns.map((change) => (
              <span key={`chg:${change.name}`} className="block text-stamp-modified/80">
                ~ {change.name}: {change.before} → {change.after}
              </span>
            ))}
          </span>
        )}
      </span>
    </button>
  );
}

function RelationRow({ entry }: { entry: RelationDiffEntry }) {
  const classes = DIFF_CLASSES[entry.status];
  const Icon = STATUS_ICON[entry.status];

  return (
    <div className={`flex items-center gap-2 rounded-sm border-l-2 px-3 py-2 ${classes.border} bg-white/[0.02]`}>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${classes.text}`} />
      <span className="truncate font-mono text-[12px] text-slate-300">{entry.label}</span>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
        {title} ({count})
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export default function DiffDrawer() {
  const t = useT();
  const drawer = useSchemaStore((state) => state.drawer);
  const compare = useSchemaStore((state) => state.compare);
  const closeDrawer = useSchemaStore((state) => state.closeDrawer);
  const exitCompare = useSchemaStore((state) => state.exitCompare);
  const openCompare = useSchemaStore((state) => state.openCompare);

  if (drawer !== "diff" || !compare) return null;
  const { diff } = compare;

  const addedTables = diff.tables.filter((t) => t.status === "added");
  const removedTables = diff.tables.filter((t) => t.status === "removed");
  const modifiedTables = diff.tables.filter((t) => t.status === "modified");
  const addedRelations = diff.relations.filter((r) => r.status === "added");
  const removedRelations = diff.relations.filter((r) => r.status === "removed");

  const totalChanges =
    addedTables.length +
    removedTables.length +
    modifiedTables.length +
    addedRelations.length +
    removedRelations.length;

  return (
    <aside className="animate-sheet-in panel pointer-events-auto absolute top-0 right-0 bottom-0 z-30 flex w-full max-w-[26rem] flex-col border-l">
      <header className="border-b border-hairline/15 px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.15em] text-stamp-modified uppercase">
            <GitCompare className="h-3.5 w-3.5" />
            {t.diffDrawer.title}
          </h2>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label={t.diffDrawer.closeAria}
            className="shrink-0 rounded-sm p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 flex min-w-0 items-center gap-1.5 truncate font-mono text-xs text-slate-400">
          <span className="truncate">{diff.baselineName}</span>
          <ArrowRight className="h-3 w-3 shrink-0 text-slate-600" />
          <span className="truncate text-slate-200">{diff.currentName}</span>
        </p>
      </header>

      <div className="grid grid-cols-5 divide-x divide-hairline/15 border-b border-hairline/15 text-center">
        {[
          { value: diff.summary.tablesAdded, label: t.diffDrawer.stats.tablesAdded, tone: "text-stamp-added" },
          { value: diff.summary.tablesRemoved, label: t.diffDrawer.stats.tablesRemoved, tone: "text-stamp-removed" },
          { value: diff.summary.tablesModified, label: t.diffDrawer.stats.modified, tone: "text-stamp-modified" },
          { value: diff.summary.relationsAdded, label: t.diffDrawer.stats.relsAdded, tone: "text-stamp-added" },
          { value: diff.summary.relationsRemoved, label: t.diffDrawer.stats.relsRemoved, tone: "text-stamp-removed" },
        ].map((cell) => (
          <div key={cell.label} className="px-1.5 py-3">
            <p className={`font-mono text-lg font-semibold tabular-nums ${cell.tone}`}>{cell.value}</p>
            <p className="text-[10px] text-slate-500">{cell.label}</p>
          </div>
        ))}
      </div>

      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {totalChanges === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-slate-300">{t.diffDrawer.emptyTitle}</p>
            <p className="mt-1 max-w-[16rem] text-xs text-slate-500">{t.diffDrawer.emptySub}</p>
          </div>
        ) : (
          <>
            <Section title={t.diffDrawer.sections.addedTables} count={addedTables.length}>
              {addedTables.map((entry) => (
                <TableRow key={entry.tableId} entry={entry} />
              ))}
            </Section>
            <Section title={t.diffDrawer.sections.removedTables} count={removedTables.length}>
              {removedTables.map((entry) => (
                <TableRow key={entry.tableId} entry={entry} />
              ))}
            </Section>
            <Section title={t.diffDrawer.sections.modifiedTables} count={modifiedTables.length}>
              {modifiedTables.map((entry) => (
                <TableRow key={entry.tableId} entry={entry} />
              ))}
            </Section>
            <Section title={t.diffDrawer.sections.relationsAdded} count={addedRelations.length}>
              {addedRelations.map((entry) => (
                <RelationRow key={entry.relationId} entry={entry} />
              ))}
            </Section>
            <Section title={t.diffDrawer.sections.relationsRemoved} count={removedRelations.length}>
              {removedRelations.map((entry) => (
                <RelationRow key={entry.relationId} entry={entry} />
              ))}
            </Section>
          </>
        )}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-hairline/15 px-4 py-3">
        <button
          type="button"
          onClick={openCompare}
          className="text-[11px] font-medium text-slate-400 transition hover:text-slate-200"
        >
          {t.diffDrawer.changeBaseline}
        </button>
        <button
          type="button"
          onClick={exitCompare}
          className="rounded-sm border border-hairline/20 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-stamp-modified/40 hover:text-stamp-modified"
        >
          {t.diffDrawer.exitComparison}
        </button>
      </footer>
    </aside>
  );
}
