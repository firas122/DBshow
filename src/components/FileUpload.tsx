"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import {
  AlertTriangle,
  Database,
  FileCode2,
  Link2,
  Loader2,
  Sparkles,
  UploadCloud,
} from "lucide-react";

import { ACCEPTED_EXTENSIONS } from "@/lib/parsers";
import { JSON_SAMPLE_HINT } from "@/lib/samples/ecommerce";
import { useSchemaLoader } from "@/state/useSchemaLoader";
import { useSchemaStore } from "@/state/useSchemaStore";

type Tab = "file" | "paste" | "url";

const TABS: Array<{ id: Tab; label: string; icon: typeof UploadCloud }> = [
  { id: "file", label: "Upload", icon: UploadCloud },
  { id: "paste", label: "Paste", icon: FileCode2 },
  { id: "url", label: "Link", icon: Link2 },
];

interface FileUploadProps {
  /** `hero` is the full-screen empty state; `panel` is the in-app drawer. */
  variant?: "hero" | "panel";
  onLoaded?: () => void;
}

export default function FileUpload({ variant = "hero", onLoaded }: FileUploadProps) {
  const [tab, setTab] = useState<Tab>("file");
  const [dragging, setDragging] = useState(false);
  const [pasted, setPasted] = useState("");
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const status = useSchemaStore((state) => state.status);
  const error = useSchemaStore((state) => state.error);
  const { loadFile, loadSample, loadText, loadUrl } = useSchemaLoader();
  const busy = status === "loading";

  const finish = useCallback(
    async (ok: boolean) => {
      if (ok) onLoaded?.();
    },
    [onLoaded],
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      await finish(await loadFile(file));
    },
    [finish, loadFile],
  );

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      await handleFiles(event.dataTransfer.files);
    },
    [handleFiles],
  );

  const isHero = variant === "hero";

  return (
    <div className={isHero ? "w-full max-w-2xl" : "w-full"}>
      <div className="mb-4 flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === id
                ? "bg-cyan-400/15 text-cyan-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)]"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "file" && (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 text-center transition ${
            isHero ? "py-12" : "py-8"
          } ${
            dragging
              ? "border-cyan-400 bg-cyan-400/10"
              : "border-white/15 bg-white/[0.03] hover:border-cyan-400/50 hover:bg-cyan-400/5"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(",")}
            className="hidden"
            onChange={(event) => handleFiles(event.target.files)}
          />
          <div className="mb-3 rounded-full border border-cyan-400/30 bg-cyan-400/10 p-3">
            {busy ? (
              <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
            ) : (
              <UploadCloud className="h-6 w-6 text-cyan-300" />
            )}
          </div>
          <p className="text-sm font-medium text-slate-200">
            {busy ? "Parsing schema…" : "Drop a schema file, or click to browse"}
          </p>
          <p className="mt-1.5 text-xs text-slate-400">
            .sql · .ddl · .sqlite · .sqlite3 · .db · .json — parsed entirely in your browser
          </p>
        </div>
      )}

      {tab === "paste" && (
        <div className="space-y-3">
          <textarea
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            spellCheck={false}
            placeholder={`CREATE TABLE users (\n  id INT PRIMARY KEY,\n  email VARCHAR(255) UNIQUE\n);\n\n— or JSON —\n\n${JSON_SAMPLE_HINT}`}
            className={`scrollbar-thin w-full resize-none rounded-xl border border-white/10 bg-slate-950/70 p-3 font-mono text-xs leading-relaxed text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 ${
              isHero ? "h-56" : "h-44"
            }`}
          />
          <button
            type="button"
            disabled={busy || pasted.trim().length === 0}
            onClick={async () => finish(await loadText(pasted))}
            className="w-full rounded-xl bg-cyan-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {busy ? "Parsing…" : "Visualise schema"}
          </button>
        </div>
      )}

      {tab === "url" && (
        <div className="space-y-3">
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={async (event) => {
              if (event.key === "Enter" && url.trim()) finish(await loadUrl(url));
            }}
            placeholder="https://example.com/schema.sql"
            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-2.5 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60"
          />
          <p className="text-xs leading-relaxed text-slate-500">
            Points at a hosted <span className="font-mono text-slate-400">.sql</span>,{" "}
            <span className="font-mono text-slate-400">.json</span> or{" "}
            <span className="font-mono text-slate-400">.sqlite</span> file. Live connection strings
            (<span className="font-mono text-slate-400">postgres://…</span>) cannot be opened from a
            browser — export the schema first.
          </p>
          <button
            type="button"
            disabled={busy || url.trim().length === 0}
            onClick={async () => finish(await loadUrl(url))}
            className="w-full rounded-xl bg-cyan-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {busy ? "Fetching…" : "Fetch & visualise"}
          </button>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-[11px] font-medium tracking-wider text-slate-500 uppercase">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={async () => finish(await loadSample())}
        className="group mt-4 flex w-full items-center gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3 text-left transition hover:border-amber-400/50 hover:bg-amber-400/[0.12] disabled:opacity-60"
      >
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-2">
          <Database className="h-4 w-4 text-amber-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-200">
            Load E-Commerce Sample DB
            <Sparkles className="h-3.5 w-3.5 opacity-70" />
          </p>
          <p className="truncate text-xs text-amber-200/60">
            13 tables with intentional schema warnings to exercise the linter
          </p>
        </div>
      </button>

      {error && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <p className="text-xs leading-relaxed text-rose-200">{error}</p>
        </div>
      )}
    </div>
  );
}
