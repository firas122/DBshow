"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  Crosshair,
  Download,
  Eye,
  EyeOff,
  Info,
  ShieldCheck,
  X,
} from "lucide-react";

import { useT } from "@/lib/i18n/useT";
import { buildHealthReportMarkdown, downloadTextFile } from "@/lib/report";
import { SEVERITY_CLASSES } from "@/lib/theme";
import { summarizeHealth } from "@/lib/validators/schemaLinter";
import { useSchemaStore } from "@/state/useSchemaStore";
import type { SchemaWarning, WarningSeverity } from "@/lib/types";

const SEVERITY_ICON = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

type Filter = "all" | WarningSeverity | "muted";

function CopyButton({ value, label }: { value: string; label?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async (event) => {
        event.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
      className="flex items-center gap-1 rounded-sm border border-hairline/20 bg-white/5 px-1.5 py-1 text-[10px] font-medium text-slate-400 transition hover:border-marigold/40 hover:text-marigold-light"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? t.warningsDrawer.copied : (label ?? t.warningsDrawer.copy)}
    </button>
  );
}

function WarningCard({ warning }: { warning: SchemaWarning }) {
  const t = useT();
  const activeWarningId = useSchemaStore((state) => state.activeWarningId);
  const setActiveWarning = useSchemaStore((state) => state.setActiveWarning);
  const focusTable = useSchemaStore((state) => state.focusTable);
  const highlightRelation = useSchemaStore((state) => state.highlightRelation);
  const mutedWarningIds = useSchemaStore((state) => state.mutedWarningIds);
  const toggleMuteWarning = useSchemaStore((state) => state.toggleMuteWarning);
  const ref = useRef<HTMLDivElement>(null);

  const expanded = activeWarningId === warning.id;
  const muted = mutedWarningIds.includes(warning.id);
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
      className={`overflow-hidden rounded-sm border transition ${muted ? "opacity-50" : ""} ${
        expanded ? `${classes.border} ${classes.bg}` : "border-hairline/15 bg-white/[0.02] hover:bg-white/[0.05]"
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setActiveWarning(expanded ? null : warning.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setActiveWarning(expanded ? null : warning.id);
          }
        }}
        className="flex w-full cursor-pointer items-start gap-2.5 px-3 py-2.5 text-left"
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
              {t.kindLabel[warning.kind]}
            </span>
            {muted && (
              <span className="shrink-0 rounded bg-white/10 px-1.5 py-px text-[10px] font-medium text-slate-400">
                {t.warningsDrawer.mutedBadge}
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate font-mono text-[11px] text-slate-500">
            {warning.tableIds.join(" · ")}
            {warning.columnName ? ` · ${warning.columnName}` : ""}
          </span>
        </span>
        <button
          type="button"
          title={muted ? t.warningsDrawer.unmuteTooltip : t.warningsDrawer.muteTooltip}
          onClick={(event) => {
            event.stopPropagation();
            toggleMuteWarning(warning.id);
          }}
          className="mt-0.5 shrink-0 rounded p-1 text-slate-500 transition hover:bg-white/10 hover:text-slate-200"
        >
          {muted ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
        <ChevronRight
          className={`mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        />
      </div>

      {expanded && (
        <div className="animate-rise-in space-y-3 border-t border-hairline/15 px-3 py-3">
          <p className="text-xs leading-relaxed text-slate-300">{warning.message}</p>

          <div className="rounded-sm border border-hairline/15 bg-ink/60 px-2.5 py-2">
            <p className="mb-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              {t.warningsDrawer.whyItMatters}
            </p>
            <p className="text-xs leading-relaxed text-slate-400">{warning.suggestion}</p>
          </div>

          {warning.fix && (
            <div className="rounded-sm border border-hairline/15 bg-ink/60">
              <div className="flex items-center justify-between border-b border-hairline/15 px-2.5 py-1.5">
                <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                  {t.warningsDrawer.suggestedFix}
                </span>
                <CopyButton value={warning.fix} />
              </div>
              <pre className="scrollbar-thin overflow-x-auto px-2.5 py-2 font-mono text-[11px] leading-relaxed whitespace-pre text-marigold-light/90">
                {warning.fix}
              </pre>
            </div>
          )}

          <button
            type="button"
            onClick={reveal}
            className="flex items-center gap-1.5 rounded-sm border border-marigold/30 bg-marigold/10 px-2.5 py-1.5 text-[11px] font-medium text-marigold-light transition hover:bg-marigold/20"
          >
            <Crosshair className="h-3.5 w-3.5" />
            {t.warningsDrawer.showIn3d}
          </button>
        </div>
      )}
    </div>
  );
}

export default function WarningsDrawer() {
  const t = useT();
  const locale = useSchemaStore((state) => state.locale);
  const graph = useSchemaStore((state) => state.graph);
  const drawer = useSchemaStore((state) => state.drawer);
  const closeDrawer = useSchemaStore((state) => state.closeDrawer);
  const mutedWarningIds = useSchemaStore((state) => state.mutedWarningIds);
  const [filter, setFilter] = useState<Filter>("all");

  const mutedSet = useMemo(() => new Set(mutedWarningIds), [mutedWarningIds]);
  // Tab counts stay raw (muting doesn't remove a warning from the list, just
  // from the ticker and the score below), but the score itself excludes them.
  const rawSummary = useMemo(() => (graph ? summarizeHealth(graph) : null), [graph]);
  const summary = useMemo(() => (graph ? summarizeHealth(graph, mutedSet) : null), [graph, mutedSet]);
  const warnings = useMemo(() => {
    if (!graph) return [];
    if (filter === "muted") return graph.warnings.filter((w) => mutedSet.has(w.id));
    return graph.warnings.filter((w) => filter === "all" || w.severity === filter);
  }, [graph, filter, mutedSet]);

  if (drawer !== "health" || !graph || !summary || !rawSummary) return null;

  const scoreTone =
    summary.score >= 85 ? "text-stamp-added" : summary.score >= 60 ? "text-stamp-warning" : "text-stamp-error";

  const filters: Array<{ id: Filter; label: string; count: number }> = [
    { id: "all", label: t.warningsDrawer.filters.all, count: graph.warnings.length },
    { id: "error", label: t.warningsDrawer.filters.errors, count: rawSummary.errors },
    { id: "warning", label: t.warningsDrawer.filters.warnings, count: rawSummary.warnings },
    { id: "info", label: t.warningsDrawer.filters.notes, count: rawSummary.info },
    { id: "muted", label: t.warningsDrawer.filters.muted, count: mutedWarningIds.length },
  ];

  const fixableCount = warnings.filter((w) => w.fix).length;
  const copyAllFixes = () => warnings.filter((w) => w.fix).map((w) => w.fix).join("\n\n");
  const exportReport = () => {
    const filename = `${graph.name.replace(/[^a-z0-9_-]+/gi, "_").toLowerCase()}-health-report.md`;
    downloadTextFile(filename, buildHealthReportMarkdown(graph, mutedSet, locale));
  };

  return (
    <aside className="animate-sheet-in panel pointer-events-auto absolute top-0 right-0 bottom-0 z-30 flex w-full max-w-[26rem] flex-col border-l">
      <header className="flex items-start justify-between gap-3 border-b border-hairline/15 px-4 py-3.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <ShieldCheck className="h-4 w-4 text-marigold-light" />
            {t.warningsDrawer.title}
          </h2>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {graph.name} · {t.titleBlock.tablesRelations(graph.tables.length, graph.relations.length)}
          </p>
        </div>
        <button
          type="button"
          onClick={closeDrawer}
          aria-label={t.warningsDrawer.closeAria}
          className="rounded-sm p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="border-b border-hairline/15 px-4 py-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              {t.warningsDrawer.schemaHealth}
            </p>
            <p className={`font-mono text-3xl font-semibold tabular-nums ${scoreTone}`}>
              {summary.score}
              <span className="ml-1 text-sm font-normal text-slate-500">/ 100</span>
            </p>
          </div>
          <div className="flex gap-3 text-right text-xs">
            <div>
              <p className="font-semibold text-stamp-error tabular-nums">{summary.errors}</p>
              <p className="text-[10px] text-slate-500">{t.warningsDrawer.errors}</p>
            </div>
            <div>
              <p className="font-semibold text-stamp-warning tabular-nums">{summary.warnings}</p>
              <p className="text-[10px] text-slate-500">{t.warningsDrawer.warnings}</p>
            </div>
            <div>
              <p className="font-semibold text-stamp-info tabular-nums">{summary.info}</p>
              <p className="text-[10px] text-slate-500">{t.warningsDrawer.notes}</p>
            </div>
          </div>
        </div>

        <div className="mt-3 flex gap-1">
          {filters.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setFilter(entry.id)}
              className={`flex-1 rounded-sm px-2 py-1.5 text-[11px] font-medium transition ${
                filter === entry.id
                  ? "bg-marigold/15 text-marigold-light shadow-[inset_0_0_0_1px_rgba(217,154,63,0.3)]"
                  : "text-slate-400 hover:bg-white/5"
              }`}
            >
              {entry.label}
              <span className="ml-1 tabular-nums opacity-60">{entry.count}</span>
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-1.5">
          <button
            type="button"
            disabled={fixableCount === 0}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(copyAllFixes());
              } catch {
                /* clipboard unavailable — silently skip */
              }
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-hairline/20 bg-white/5 px-2 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-marigold/40 hover:text-marigold-light disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Copy className="h-3.5 w-3.5" />
            {t.warningsDrawer.copyFixes(fixableCount)}
          </button>
          <button
            type="button"
            onClick={exportReport}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-hairline/20 bg-white/5 px-2 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-marigold/40 hover:text-marigold-light"
          >
            <Download className="h-3.5 w-3.5" />
            {t.warningsDrawer.exportReport}
          </button>
        </div>
      </div>

      <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {warnings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldCheck className="mb-3 h-8 w-8 text-stamp-added/60" />
            <p className="text-sm font-medium text-slate-300">
              {graph.warnings.length === 0 ? t.warningsDrawer.emptyNoIssues : t.warningsDrawer.emptyFilter}
            </p>
            <p className="mt-1 max-w-[16rem] text-xs text-slate-500">
              {graph.warnings.length === 0 ? t.warningsDrawer.emptyNoIssuesSub : t.warningsDrawer.emptyFilterSub}
            </p>
          </div>
        ) : (
          warnings.map((warning) => <WarningCard key={warning.id} warning={warning} />)
        )}

        {graph.parseNotes.length > 0 && (
          <div className="mt-4 rounded-sm border border-hairline/15 bg-white/[0.02] px-3 py-2.5">
            <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              {t.warningsDrawer.parserNotes}
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
