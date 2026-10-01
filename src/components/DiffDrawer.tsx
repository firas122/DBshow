"use client";

import {
  ArrowRight,
  Edit3,
  GitCompare,
  Minus,
  Plus,
  X,
} from "lucide-react";

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
      className={`w-full rounded-lg border px-3 py-2 text-left transition hover:bg-white/[0.04] ${classes.border} bg-white/[0.02]`}
    >
      <span className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${classes.text}`} />
        <span className="truncate text-[13px] font-medium text-slate-100">{entry.name}</span>
      </span>
      {entry.status === "modified" && (
        <span className="mt-1 ml-5 block space-y-0.5 font-mono text-[11px] text-slate-500">
          {entry.addedColumns.map((name) => (
            <span key={`add:${name}`} className="block text-emerald-300/80">
              + {name}
            </span>
          ))}
          {entry.removedColumns.map((name) => (
            <span key={`rm:${name}`} className="block text-rose-300/80">
              − {name}
            </span>
          ))}
          {entry.changedColumns.map((change) => (
            <span key={`chg:${change.name}`} className="block text-violet-300/80">
              ~ {change.name}: {change.before} → {change.after}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

function RelationRow({ entry }: { entry: RelationDiffEntry }) {
  const classes = DIFF_CLASSES[entry.status];
  const Icon = STATUS_ICON[entry.status];

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${classes.border} bg-white/[0.02]`}>
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
    <aside className="animate-drawer-in glass pointer-events-auto absolute top-0 right-0 bottom-0 z-30 flex w-full max-w-[26rem] flex-col border-l">
      <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <GitCompare className="h-4 w-4 text-violet-300" />
            Schema diff
          </h2>
          <p className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-xs text-slate-400">
            <span className="truncate">{diff.baselineName}</span>
            <ArrowRight className="h-3 w-3 shrink-0" />
            <span className="truncate">{diff.currentName}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={closeDrawer}
          aria-label="Close diff"
          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="grid grid-cols-5 gap-1.5 border-b border-white/10 px-4 py-3 text-center">
        <div>
          <p className="text-lg font-semibold text-emerald-300 tabular-nums">{diff.summary.tablesAdded}</p>
          <p className="text-[10px] text-slate-500">tables +</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-rose-300 tabular-nums">{diff.summary.tablesRemoved}</p>
          <p className="text-[10px] text-slate-500">tables −</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-violet-300 tabular-nums">{diff.summary.tablesModified}</p>
          <p className="text-[10px] text-slate-500">modified</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-emerald-300 tabular-nums">{diff.summary.relationsAdded}</p>
          <p className="text-[10px] text-slate-500">rels +</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-rose-300 tabular-nums">{diff.summary.relationsRemoved}</p>
          <p className="text-[10px] text-slate-500">rels −</p>
        </div>
      </div>

      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {totalChanges === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-slate-300">No structural changes</p>
            <p className="mt-1 max-w-[16rem] text-xs text-slate-500">
              Every table, column and relation matches between the two schemas.
            </p>
          </div>
        ) : (
          <>
            <Section title="Added tables" count={addedTables.length}>
              {addedTables.map((entry) => (
                <TableRow key={entry.tableId} entry={entry} />
              ))}
            </Section>
            <Section title="Removed tables" count={removedTables.length}>
              {removedTables.map((entry) => (
                <TableRow key={entry.tableId} entry={entry} />
              ))}
            </Section>
            <Section title="Modified tables" count={modifiedTables.length}>
              {modifiedTables.map((entry) => (
                <TableRow key={entry.tableId} entry={entry} />
              ))}
            </Section>
            <Section title="Relations added" count={addedRelations.length}>
              {addedRelations.map((entry) => (
                <RelationRow key={entry.relationId} entry={entry} />
              ))}
            </Section>
            <Section title="Relations removed" count={removedRelations.length}>
              {removedRelations.map((entry) => (
                <RelationRow key={entry.relationId} entry={entry} />
              ))}
            </Section>
          </>
        )}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={openCompare}
          className="text-[11px] font-medium text-slate-400 transition hover:text-slate-200"
        >
          Change baseline
        </button>
        <button
          type="button"
          onClick={exitCompare}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-violet-400/40 hover:text-violet-200"
        >
          Exit comparison
        </button>
      </footer>
    </aside>
  );
}
