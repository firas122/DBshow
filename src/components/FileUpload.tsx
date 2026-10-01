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

import { useT } from "@/lib/i18n/useT";
import { ACCEPTED_EXTENSIONS } from "@/lib/parsers";
import { JSON_SAMPLE_HINT } from "@/lib/samples/ecommerce";
import { SAMPLES } from "@/lib/samples";
import { useSchemaLoader } from "@/state/useSchemaLoader";
import { useSchemaStore } from "@/state/useSchemaStore";

type Tab = "file" | "paste" | "url";

interface FileUploadProps {
  /** `hero` is the full-screen empty state; `panel` is the in-app drawer. */
  variant?: "hero" | "panel";
  onLoaded?: () => void;
}

export default function FileUpload({ variant = "hero", onLoaded }: FileUploadProps) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("file");
  const [dragging, setDragging] = useState(false);
  const [pasted, setPasted] = useState("");
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const status = useSchemaStore((state) => state.status);
  const error = useSchemaStore((state) => state.error);
  const { loadFile, loadSample, loadText, loadUrl } = useSchemaLoader();
  const busy = status === "loading";

  const TABS: Array<{ id: Tab; label: string; icon: typeof UploadCloud }> = [
    { id: "file", label: t.upload.tabs.file, icon: UploadCloud },
    { id: "paste", label: t.upload.tabs.paste, icon: FileCode2 },
    { id: "url", label: t.upload.tabs.url, icon: Link2 },
  ];

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
      <div className="mb-4 flex gap-1 rounded-sm border border-hairline/20 bg-white/[0.02] p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-sm px-3 py-2 text-sm font-medium transition ${
              tab === id
                ? "bg-marigold/15 text-marigold-light shadow-[inset_0_0_0_1px_rgba(217,154,63,0.35)]"
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
          className={`flex cursor-pointer flex-col items-center justify-center rounded-sm border-2 border-dashed px-6 text-center transition ${
            isHero ? "py-12" : "py-8"
          } ${
            dragging
              ? "border-marigold bg-marigold/10"
              : "border-hairline/25 bg-white/[0.02] hover:border-marigold/50 hover:bg-marigold/5"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(",")}
            className="hidden"
            onChange={(event) => handleFiles(event.target.files)}
          />
          <div className="mb-3 rounded-sm border border-marigold/30 bg-marigold/10 p-3">
            {busy ? (
              <Loader2 className="h-6 w-6 animate-spin text-marigold-light" />
            ) : (
              <UploadCloud className="h-6 w-6 text-marigold-light" />
            )}
          </div>
          <p className="text-sm font-medium text-slate-200">
            {busy ? t.upload.file.parsing : t.upload.file.dropPrompt}
          </p>
          <p className="mt-1.5 text-xs text-slate-400">{t.upload.file.hint}</p>
        </div>
      )}

      {tab === "paste" && (
        <div className="space-y-3">
          <textarea
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            spellCheck={false}
            placeholder={`CREATE TABLE users (\n  id INT PRIMARY KEY,\n  email VARCHAR(255) UNIQUE\n);\n\n${t.upload.paste.jsonSeparator}\n\n${JSON_SAMPLE_HINT}`}
            className={`scrollbar-thin w-full resize-none rounded-sm border border-hairline/20 bg-ink/70 p-3 font-mono text-xs leading-relaxed text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-marigold/60 ${
              isHero ? "h-56" : "h-44"
            }`}
          />
          <button
            type="button"
            disabled={busy || pasted.trim().length === 0}
            onClick={async () => finish(await loadText(pasted))}
            className="w-full rounded-sm bg-marigold/90 px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-marigold-light disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {busy ? t.upload.paste.parsing : t.upload.paste.submit}
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
            placeholder={t.upload.url.placeholder}
            className="w-full rounded-sm border border-hairline/20 bg-ink/70 px-3.5 py-2.5 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-marigold/60"
          />
          <p className="text-xs leading-relaxed text-slate-500">{t.upload.url.description}</p>
          <button
            type="button"
            disabled={busy || url.trim().length === 0}
            onClick={async () => finish(await loadUrl(url))}
            className="w-full rounded-sm bg-marigold/90 px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-marigold-light disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {busy ? t.upload.url.fetching : t.upload.url.submit}
          </button>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-hairline/20" />
        <span className="text-[11px] font-medium tracking-wider text-slate-500 uppercase">{t.upload.divider}</span>
        <div className="h-px flex-1 bg-hairline/20" />
      </div>

      <div className="mt-4 space-y-2">
        {SAMPLES.map((sample) => (
          <button
            key={sample.key}
            type="button"
            disabled={busy}
            onClick={async () => finish(await loadSample(sample.key))}
            className="group flex w-full items-center gap-3 rounded-sm border border-stamp-info/25 bg-stamp-info/[0.06] px-4 py-3 text-left transition hover:border-stamp-info/50 hover:bg-stamp-info/[0.1] disabled:opacity-60"
          >
            <div className="rounded-sm border border-stamp-info/30 bg-stamp-info/10 p-2">
              <Database className="h-4 w-4 text-stamp-info" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-200">
                {t.samples[sample.key]?.label ?? sample.label}
                <Sparkles className="h-3.5 w-3.5 text-stamp-info opacity-70" />
              </p>
              <p className="truncate text-xs text-slate-500">
                {t.samples[sample.key]?.description ?? sample.description}
              </p>
            </div>
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2.5 rounded-sm border border-stamp-error/30 bg-stamp-error/10 px-3.5 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-stamp-error" />
          <p className="text-xs leading-relaxed text-slate-300">{error}</p>
        </div>
      )}
    </div>
  );
}
