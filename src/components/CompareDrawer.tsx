"use client";

import { useRef, useState } from "react";
import { AlertTriangle, FileCode2, GitCompare, History, Loader2, UploadCloud, X } from "lucide-react";

import { parseFile, parseTextSchema } from "@/lib/parsers";
import { useSchemaStore } from "@/state/useSchemaStore";
import type { SchemaGraph } from "@/lib/types";

export default function CompareDrawer() {
  const drawer = useSchemaStore((state) => state.drawer);
  const closeDrawer = useSchemaStore((state) => state.closeDrawer);
  const compareBaseline = useSchemaStore((state) => state.compareBaseline);
  const startCompare = useSchemaStore((state) => state.startCompare);
  const graph = useSchemaStore((state) => state.graph);

  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (drawer !== "compare") return null;

  const runDiff = async (task: () => Promise<SchemaGraph>) => {
    setBusy(true);
    setError(null);
    try {
      const baseline = await task();
      startCompare(baseline);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that schema.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="animate-drawer-in glass pointer-events-auto absolute top-0 right-0 bottom-0 z-30 flex w-full max-w-[26rem] flex-col border-l">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <GitCompare className="h-4 w-4 text-violet-300" />
          Compare schemas
        </h2>
        <button
          type="button"
          onClick={closeDrawer}
          aria-label="Close compare"
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <p className="text-xs leading-relaxed text-slate-400">
          Pick an earlier version of <span className="font-medium text-slate-200">{graph?.name}</span>{" "}
          to diff against what&apos;s loaded now. Added, removed and modified tables &amp; relations
          get tinted in the 3D view — green for added, violet for modified, rose (dashed) for removed.
        </p>

        {compareBaseline && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              runDiff(async () => parseTextSchema(compareBaseline.sql, compareBaseline.name))
            }
            className="flex w-full items-center gap-3 rounded-xl border border-violet-400/25 bg-violet-400/[0.07] px-4 py-3 text-left transition hover:border-violet-400/50 hover:bg-violet-400/[0.12] disabled:opacity-60"
          >
            <div className="rounded-lg border border-violet-400/30 bg-violet-400/10 p-2">
              <History className="h-4 w-4 text-violet-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-violet-200">Bundled baseline</p>
              <p className="truncate text-xs text-violet-200/60">{compareBaseline.name}</p>
            </div>
          </button>
        )}

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[11px] font-medium tracking-wider text-slate-500 uppercase">
            or bring your own
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
          }}
          className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.03] px-6 py-8 text-center transition hover:border-violet-400/50 hover:bg-violet-400/5"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".sql,.ddl,.sqlite,.sqlite3,.db,.json,.txt"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) runDiff(() => parseFile(file));
            }}
          />
          <div className="mb-3 rounded-full border border-violet-400/30 bg-violet-400/10 p-3">
            {busy ? (
              <Loader2 className="h-6 w-6 animate-spin text-violet-300" />
            ) : (
              <UploadCloud className="h-6 w-6 text-violet-300" />
            )}
          </div>
          <p className="text-sm font-medium text-slate-200">
            {busy ? "Reading…" : "Upload the earlier schema file"}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <FileCode2 className="h-3.5 w-3.5" />
            …or paste it
          </div>
          <textarea
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            spellCheck={false}
            placeholder="CREATE TABLE …"
            className="scrollbar-thin h-32 w-full resize-none rounded-xl border border-white/10 bg-slate-950/70 p-3 font-mono text-xs leading-relaxed text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-violet-400/60"
          />
          <button
            type="button"
            disabled={busy || pasted.trim().length === 0}
            onClick={() => runDiff(async () => parseTextSchema(pasted, "Baseline schema"))}
            className="w-full rounded-xl bg-violet-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {busy ? "Comparing…" : "Compare"}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <p className="text-xs leading-relaxed text-rose-200">{error}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
