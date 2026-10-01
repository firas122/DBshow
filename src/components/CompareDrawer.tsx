"use client";

import { useRef, useState } from "react";
import { AlertTriangle, FileCode2, GitCompare, History, Loader2, UploadCloud, X } from "lucide-react";

import { useT } from "@/lib/i18n/useT";
import { parseFile, parseTextSchema } from "@/lib/parsers";
import { useSchemaStore } from "@/state/useSchemaStore";
import type { SchemaGraph } from "@/lib/types";

export default function CompareDrawer() {
  const t = useT();
  const locale = useSchemaStore((state) => state.locale);
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
      setError(err instanceof Error ? err.message : t.compareDrawer.readError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="animate-sheet-in panel pointer-events-auto absolute top-0 right-0 bottom-0 z-30 flex w-full max-w-[26rem] flex-col border-l">
      <header className="flex items-center justify-between border-b border-hairline/15 px-4 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <GitCompare className="h-4 w-4 text-stamp-modified" />
          {t.compareDrawer.title}
        </h2>
        <button
          type="button"
          onClick={closeDrawer}
          aria-label={t.compareDrawer.closeAria}
          className="rounded-sm p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <p className="text-xs leading-relaxed text-slate-400">
          {t.compareDrawer.description(graph?.name ?? "")}
        </p>

        {compareBaseline && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              runDiff(async () => parseTextSchema(compareBaseline.sql, compareBaseline.name, locale))
            }
            className="flex w-full items-center gap-3 rounded-sm border border-stamp-modified/25 bg-stamp-modified/[0.07] px-4 py-3 text-left transition hover:border-stamp-modified/50 hover:bg-stamp-modified/[0.12] disabled:opacity-60"
          >
            <div className="rounded-sm border border-stamp-modified/30 bg-stamp-modified/10 p-2">
              <History className="h-4 w-4 text-stamp-modified" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-stamp-modified">{t.compareDrawer.bundledBaseline}</p>
              <p className="truncate text-xs text-stamp-modified/70">{compareBaseline.name}</p>
            </div>
          </button>
        )}

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-hairline/20" />
          <span className="text-[11px] font-medium tracking-wider text-slate-500 uppercase">
            {t.compareDrawer.orBringOwn}
          </span>
          <div className="h-px flex-1 bg-hairline/20" />
        </div>

        <div
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
          }}
          className="flex cursor-pointer flex-col items-center justify-center rounded-sm border-2 border-dashed border-hairline/25 bg-white/[0.02] px-6 py-8 text-center transition hover:border-stamp-modified/50 hover:bg-stamp-modified/5"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".sql,.ddl,.sqlite,.sqlite3,.db,.json,.txt"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) runDiff(() => parseFile(file, locale));
            }}
          />
          <div className="mb-3 rounded-sm border border-stamp-modified/30 bg-stamp-modified/10 p-3">
            {busy ? (
              <Loader2 className="h-6 w-6 animate-spin text-stamp-modified" />
            ) : (
              <UploadCloud className="h-6 w-6 text-stamp-modified" />
            )}
          </div>
          <p className="text-sm font-medium text-slate-200">
            {busy ? t.compareDrawer.reading : t.compareDrawer.uploadPrompt}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <FileCode2 className="h-3.5 w-3.5" />
            {t.compareDrawer.orPaste}
          </div>
          <textarea
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            spellCheck={false}
            placeholder="CREATE TABLE …"
            className="scrollbar-thin h-32 w-full resize-none rounded-sm border border-hairline/20 bg-ink/70 p-3 font-mono text-xs leading-relaxed text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-stamp-modified/60"
          />
          <button
            type="button"
            disabled={busy || pasted.trim().length === 0}
            onClick={() => runDiff(async () => parseTextSchema(pasted, t.defaultNames.baseline, locale))}
            className="w-full rounded-sm bg-stamp-modified/90 px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-stamp-modified disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {busy ? t.compareDrawer.comparing : t.compareDrawer.compare}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-sm border border-stamp-error/30 bg-stamp-error/10 px-3.5 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-stamp-error" />
            <p className="text-xs leading-relaxed text-slate-300">{error}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
