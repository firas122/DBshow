"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  Crosshair,
  Info,
  ShieldCheck,
  X,
} from "lucide-react";

import { SEVERITY_CLASSES, SEVERITY_LABEL } from "@/lib/theme";
import { summarizeHealth } from "@/lib/validators/schemaLinter";
import { useSchemaStore } from "@/state/useSchemaStore";
import type { SchemaWarning, WarningKind, WarningSeverity } from "@/lib/types";

const KIND_LABEL: Record<WarningKind, string> = {
  "type-mismatch": "Type mismatch",
  "implicit-fk": "Suggested relation",
  "missing-index": "Missing index",
  "circular-dependency": "Circular dependency",
  "dangling-reference": "Dangling reference",
  "no-primary-key": "No primary key",
  "orphan-table": "Isolated table",
};

const SEVERITY_ICON = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

type Filter = "all" | WarningSeverity;

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
      className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-[10px] font-medium text-slate-400 transition hover:border-cyan-400/40 hover:text-cyan-300"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function WarningCard({ warning }: { warning: SchemaWarning }) {
  const activeWarningId = useSchemaStore((state) => state.activeWarningId);
  const setActiveWarning = useSchemaStore((state) => state.setActiveWarning);
  const focusTable = useSchemaStore((state) => state.focusTable);
  const highlightRelation = useSchemaStore((state) => state.highlightRelation);
  const ref = useRef<HTMLDivElement>(null);

  const expanded = activeWarningId === warning.id;
  const classes = SEVERITY_CLASSES[warning.severity];
  const Icon = SEVERITY_ICON[warning.severity];

  useEffect(() => {
    if (expanded) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [expanded]);

  const reveal = () => {
    focusTable(warning.tableIds[0]);
    highlightRelation(warning.relationId ?? null);
  };

  return (
    <div
      ref={ref}
      className={`overflow-hidden rounded-xl border transition ${
        expanded ? `${classes.border} ${classes.bg}` : "border-white/8 bg-white/[0.02] hover:bg-white/[0.05]"
      }`}
    >
      <button
        type="button"
        onClick={() => setActiveWarning(expanded ? null : warning.id)}
        className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left"
      >
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${classes.text}`} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[13px] font-semibold text-slate-100">
              {warning.title}
            </span>
            <span
              className={`shrink-0 rounded px-1.5 py-px text-[10px] font-medium ${classes.bg} ${classes.text}`}
            >
              {KIND_LABEL[warning.kind]}
            </span>
          </span>
          <span className="mt-0.5 block truncate font-mono text-[11px] text-slate-500">
            {warning.tableIds.join(" · ")}
            {warning.columnName ? ` · ${warning.columnName}` : ""}
          </span>
        </span>
        <ChevronRight
          className={`mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        />
      </button>

      {expanded && (
        <div className="animate-rise-in space-y-3 border-t border-white/8 px-3 py-3">
          <p className="text-xs leading-relaxed text-slate-300">{warning.message}</p>

          <div className="rounded-lg border border-white/8 bg-slate-950/50 px-2.5 py-2">
            <p className="mb-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              Why it matters
            </p>
            <p className="text-xs leading-relaxed text-slate-400">{warning.suggestion}</p>
          </div>

          {warning.fix && (
            <div className="rounded-lg border border-white/8 bg-slate-950/50">
              <div className="flex items-center justify-between border-b border-white/8 px-2.5 py-1.5">
                <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                  Suggested fix
                </span>
                <CopyButton value={warning.fix} />
              </div>
              <pre className="scrollbar-thin overflow-x-auto px-2.5 py-2 font-mono text-[11px] leading-relaxed whitespace-pre text-cyan-200/90">
                {warning.fix}
              </pre>
            </div>
          )}

          <button
            type="button"
            onClick={reveal}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1.5 text-[11px] font-medium text-cyan-200 transition hover:bg-cyan-400/20"
          >
            <Crosshair className="h-3.5 w-3.5" />
            Show in 3D
          </button>
        </div>
      )}
    </div>
  );
}

export default function WarningsDrawer() {
  const graph = useSchemaStore((state) => state.graph);
  const drawer = useSchemaStore((state) => state.drawer);
  const closeDrawer = useSchemaStore((state) => state.closeDrawer);
  const [filter, setFilter] = useState<Filter>("all");

  const summary = useMemo(() => (graph ? summarizeHealth(graph) : null), [graph]);
  const warnings = useMemo(
    () => (graph ? graph.warnings.filter((w) => filter === "all" || w.severity === filter) : []),
    [graph, filter],
  );

  if (drawer !== "health" || !graph || !summary) return null;

  const scoreTone =
    summary.score >= 85 ? "text-emerald-300" : summary.score >= 60 ? "text-amber-300" : "text-rose-300";

  const filters: Array<{ id: Filter; label: string; count: number }> = [
    { id: "all", label: "All", count: graph.warnings.length },
    { id: "error", label: "Errors", count: summary.errors },
    { id: "warning", label: "Warnings", count: summary.warnings },
    { id: "info", label: "Notes", count: summary.info },
  ];

  return (
    <aside className="animate-drawer-in glass pointer-events-auto absolute top-0 right-0 bottom-0 z-30 flex w-full max-w-[26rem] flex-col border-l">
      <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <ShieldCheck className="h-4 w-4 text-cyan-300" />
            Relations Health &amp; Warnings
          </h2>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {graph.name} · {graph.tables.length} tables · {graph.relations.length} relations
          </p>
        </div>
        <button
          type="button"
          onClick={closeDrawer}
          aria-label="Close health report"
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              Schema health
            </p>
            <p className={`text-3xl font-semibold tabular-nums ${scoreTone}`}>
              {summary.score}
              <span className="ml-1 text-sm font-normal text-slate-500">/ 100</span>
            </p>
          </div>
          <div className="flex gap-3 text-right text-xs">
            <div>
              <p className="font-semibold text-rose-300 tabular-nums">{summary.errors}</p>
              <p className="text-[10px] text-slate-500">errors</p>
            </div>
            <div>
              <p className="font-semibold text-amber-300 tabular-nums">{summary.warnings}</p>
              <p className="text-[10px] text-slate-500">warnings</p>
            </div>
            <div>
              <p className="font-semibold text-sky-300 tabular-nums">{summary.info}</p>
              <p className="text-[10px] text-slate-500">notes</p>
            </div>
          </div>
        </div>

        <div className="mt-3 flex gap-1">
          {filters.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setFilter(entry.id)}
              className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
                filter === entry.id
                  ? "bg-cyan-400/15 text-cyan-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.3)]"
                  : "text-slate-400 hover:bg-white/5"
              }`}
            >
              {entry.label}
              <span className="ml-1 tabular-nums opacity-60">{entry.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {warnings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldCheck className="mb-3 h-8 w-8 text-emerald-400/60" />
            <p className="text-sm font-medium text-slate-300">
              {graph.warnings.length === 0 ? "No issues detected" : "Nothing in this filter"}
            </p>
            <p className="mt-1 max-w-[16rem] text-xs text-slate-500">
              {graph.warnings.length === 0
                ? "Every foreign key resolves, matches its parent's type and is indexed."
                : "Try a different severity filter."}
            </p>
          </div>
        ) : (
          warnings.map((warning) => <WarningCard key={warning.id} warning={warning} />)
        )}

        {graph.parseNotes.length > 0 && (
          <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
            <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              Parser notes
            </p>
            <ul className="space-y-1">
              {graph.parseNotes.map((note) => (
                <li key={note} className="font-mono text-[11px] leading-relaxed text-slate-500">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}
