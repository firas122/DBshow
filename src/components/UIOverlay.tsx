"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Boxes,
  Check,
  Columns3,
  CornerDownLeft,
  GitCompare,
  Globe,
  Grid3x3,
  Languages,
  Layers,
  Link2,
  Loader2,
  Maximize,
  Orbit,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

import CompareDrawer from "@/components/CompareDrawer";
import DiffDrawer from "@/components/DiffDrawer";
import FileUpload from "@/components/FileUpload";
import IssueTicker from "@/components/IssueTicker";
import TableInspector from "@/components/TableInspector";
import WarningsDrawer from "@/components/WarningsDrawer";
import { LAYOUT_LABELS, type LayoutMode } from "@/lib/graph/layouts";
import { LOCALE_LABEL, otherLocale } from "@/lib/i18n/locale";
import { useT } from "@/lib/i18n/useT";
import { summarizeHealth } from "@/lib/validators/schemaLinter";
import { searchSchema, useSchemaStore } from "@/state/useSchemaStore";

const MUTE_STORAGE_KEY = "dbshow:mutedWarnings";
const LOCALE_STORAGE_KEY = "dbshow:locale";

const LAYOUT_ICONS: Record<LayoutMode, typeof Orbit> = {
  force: Orbit,
  sphere: Globe,
  grid: Layers,
};

function DockButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex items-center justify-center rounded-sm border p-2 transition ${
        active
          ? "border-marigold/50 bg-marigold/15 text-marigold-light"
          : "border-transparent text-slate-400 hover:border-hairline/25 hover:bg-white/[0.04] hover:text-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function DockDivider() {
  return <div className="my-1 h-px w-full bg-hairline/15" />;
}

function LocaleToggle({ variant = "dock" }: { variant?: "dock" | "hero" }) {
  const t = useT();
  const locale = useSchemaStore((state) => state.locale);
  const setLocale = useSchemaStore((state) => state.setLocale);
  const next = otherLocale(locale);

  if (variant === "hero") {
    return (
      <button
        type="button"
        onClick={() => setLocale(next)}
        title={t.localeToggle.switchTo(LOCALE_LABEL[next])}
        aria-label={t.localeToggle.switchTo(LOCALE_LABEL[next])}
        className="rounded-sm border border-hairline/20 bg-white/[0.02] px-2 py-1 font-mono text-[11px] font-medium text-slate-400 transition hover:border-marigold/40 hover:text-marigold-light"
      >
        {LOCALE_LABEL[next]}
      </button>
    );
  }

  return (
    <DockButton label={t.localeToggle.switchTo(LOCALE_LABEL[next])} onClick={() => setLocale(next)}>
      <Languages className="h-4 w-4" />
    </DockButton>
  );
}

function CommandPalette() {
  const t = useT();
  const graph = useSchemaStore((state) => state.graph);
  const search = useSchemaStore((state) => state.search);
  const setSearch = useSchemaStore((state) => state.setSearch);
  const focusTable = useSchemaStore((state) => state.focusTable);
  const selectTable = useSchemaStore((state) => state.selectTable);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const hits = useMemo(() => searchSchema(graph, search), [graph, search]);

  const openPalette = () => {
    setCursor(0);
    setOpen(true);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (event.key === "/" && !typing) {
        event.preventDefault();
        openPalette();
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setSearch("");
    }
  }, [open, setSearch]);

  const go = (tableId: string) => {
    focusTable(tableId);
    selectTable(tableId);
    setOpen(false);
  };

  if (!graph) return null;

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        title={t.dock.search}
        aria-label={t.dock.searchAria}
        className="flex items-center justify-center rounded-sm border border-transparent p-2 text-slate-400 transition hover:border-hairline/25 hover:bg-white/[0.04] hover:text-slate-100"
      >
        <Search className="h-4 w-4" />
      </button>

      {open &&
        createPortal(
          <div
            className="pointer-events-auto fixed inset-0 z-40 flex justify-center bg-ink/70 pt-[14vh]"
            onClick={() => setOpen(false)}
          >
            <div
              className="animate-rise-in panel h-fit w-full max-w-md rounded-sm border shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-2.5 border-b border-hairline/15 px-3.5 py-2.5">
                <Search className="h-3.5 w-3.5 shrink-0 text-marigold-light" />
                <input
                  ref={inputRef}
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCursor(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setCursor((c) => Math.min(c + 1, hits.length - 1));
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setCursor((c) => Math.max(c - 1, 0));
                    } else if (event.key === "Enter" && hits[cursor]) {
                      go(hits[cursor].tableId);
                    }
                  }}
                  placeholder={t.palette.placeholder}
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-200 outline-none placeholder:text-slate-500"
                />
                <kbd className="shrink-0 rounded-sm border border-hairline/25 px-1 font-mono text-[10px] text-slate-500">
                  esc
                </kbd>
              </div>

              {hits.length > 0 && (
                <div className="scrollbar-thin max-h-72 overflow-y-auto p-1">
                  {hits.map((hit, index) => (
                    <button
                      key={`${hit.tableId}.${hit.columnName ?? ""}`}
                      type="button"
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => go(hit.tableId)}
                      className={`flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left transition ${
                        index === cursor ? "bg-marigold/10" : "hover:bg-white/[0.04]"
                      }`}
                    >
                      {hit.columnName ? (
                        <Columns3 className="h-3.5 w-3.5 shrink-0 text-[#22d3ee]/70" />
                      ) : (
                        <Boxes className="h-3.5 w-3.5 shrink-0 text-[#fbbf24]/70" />
                      )}
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-slate-200">
                        {hit.tableName}
                        {hit.columnName && <span className="text-slate-500">.{hit.columnName}</span>}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-slate-500">{hit.detail}</span>
                      {index === cursor && (
                        <CornerDownLeft className="h-3 w-3 shrink-0 text-marigold-light" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {search && hits.length === 0 && (
                <p className="px-3.5 py-4 text-center text-[12px] text-slate-500">{t.palette.noMatches(search)}</p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function TitleBlock() {
  const t = useT();
  const graph = useSchemaStore((state) => state.graph);
  const openHealth = useSchemaStore((state) => state.openHealth);
  const mutedWarningIds = useSchemaStore((state) => state.mutedWarningIds);
  const mutedSet = useMemo(() => new Set(mutedWarningIds), [mutedWarningIds]);
  const summary = useMemo(() => (graph ? summarizeHealth(graph, mutedSet) : null), [graph, mutedSet]);

  if (!graph || !summary) return null;
  const issueCount = summary.errors + summary.warnings;
  const scoreTone =
    summary.score >= 85 ? "text-stamp-added" : summary.score >= 60 ? "text-stamp-warning" : "text-stamp-error";

  const legendItems = [
    { color: "#fbbf24", label: t.titleBlock.legend.pk },
    { color: "#22d3ee", label: t.titleBlock.legend.fk },
    { color: "#f59e0b", label: t.titleBlock.legend.suggested },
    { color: "#fb7185", label: t.titleBlock.legend.error },
  ];

  return (
    <div className="corner-ticks panel pointer-events-auto w-60 rounded-sm border px-3.5 py-3 sm:w-64">
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-hairline/15 pb-2">
        <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] text-marigold-light uppercase">
          <Boxes className="h-3 w-3" />
          DBShow
        </span>
        <span className="font-mono text-[9px] tracking-wide text-slate-500 uppercase">
          {t.sourceLabel[graph.source] ?? graph.source}
        </span>
      </div>

      <p className="truncate font-mono text-[13px] font-semibold text-slate-100">{graph.name}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        {t.titleBlock.tablesRelations(graph.tables.length, graph.relations.length)}
      </p>

      <button
        type="button"
        onClick={() => openHealth(null)}
        className="mt-2.5 flex w-full items-center justify-between rounded-sm border border-hairline/20 bg-white/[0.02] px-2.5 py-1.5 transition hover:border-marigold/40 hover:bg-marigold/[0.06]"
      >
        <span className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-slate-400 uppercase">
          <ShieldAlert className="h-3 w-3" />
          {t.titleBlock.health}
        </span>
        <span className="flex items-baseline gap-1">
          <span className={`font-mono text-sm font-semibold tabular-nums ${scoreTone}`}>{summary.score}</span>
          <span className="font-mono text-[10px] text-slate-500">/100</span>
          {issueCount > 0 && (
            <span className="ml-1 font-mono text-[10px] text-slate-500 tabular-nums">({issueCount})</span>
          )}
        </span>
      </button>

      <div className="mt-2.5 hidden grid-cols-2 gap-x-3 gap-y-1 border-t border-hairline/15 pt-2 sm:grid">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="h-[2px] w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolDock() {
  const t = useT();
  const layout = useSchemaStore((state) => state.layout);
  const setLayout = useSchemaStore((state) => state.setLayout);
  const reflow = useSchemaStore((state) => state.reflow);
  const resetView = useSchemaStore((state) => state.resetView);
  const openHealth = useSchemaStore((state) => state.openHealth);
  const openImport = useSchemaStore((state) => state.openImport);
  const openDiff = useSchemaStore((state) => state.openDiff);
  const compare = useSchemaStore((state) => state.compare);
  const showParticles = useSchemaStore((state) => state.showParticles);
  const toggleParticles = useSchemaStore((state) => state.toggleParticles);
  const showEdgeLabels = useSchemaStore((state) => state.showEdgeLabels);
  const toggleEdgeLabels = useSchemaStore((state) => state.toggleEdgeLabels);
  const autoRotate = useSchemaStore((state) => state.autoRotate);
  const toggleAutoRotate = useSchemaStore((state) => state.toggleAutoRotate);
  const [copied, setCopied] = useState(false);

  return (
    <div className="panel pointer-events-auto flex flex-col items-center gap-0.5 rounded-sm border p-1">
      <DockButton label={t.dock.load} onClick={openImport}>
        <Upload className="h-4 w-4" />
      </DockButton>
      <CommandPalette />

      <DockDivider />

      {(Object.keys(LAYOUT_LABELS) as LayoutMode[]).map((mode) => {
        const Icon = LAYOUT_ICONS[mode];
        return (
          <DockButton
            key={mode}
            label={t.dock.layoutTitle(t.layout[mode])}
            active={layout === mode}
            onClick={() => setLayout(mode)}
          >
            <Icon className="h-4 w-4" />
          </DockButton>
        );
      })}
      <DockButton label={t.dock.reflow} onClick={reflow}>
        <Grid3x3 className="h-4 w-4" />
      </DockButton>
      <DockButton label={t.dock.frameAll} onClick={resetView}>
        <Maximize className="h-4 w-4" />
      </DockButton>

      <DockDivider />

      <DockButton label={t.dock.particles} active={showParticles} onClick={toggleParticles}>
        <Sparkles className="h-4 w-4" />
      </DockButton>
      <DockButton label={t.dock.edgeLabels} active={showEdgeLabels} onClick={toggleEdgeLabels}>
        <Link2 className="h-4 w-4" />
      </DockButton>
      <DockButton label={t.dock.autoRotate} active={autoRotate} onClick={toggleAutoRotate}>
        <Orbit className="h-4 w-4" />
      </DockButton>

      <DockDivider />

      <DockButton label={compare ? t.dock.viewDiff : t.dock.compare} active={compare !== null} onClick={openDiff}>
        <GitCompare className="h-4 w-4" />
      </DockButton>
      <DockButton
        label={t.dock.copyLink}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? <Check className="h-4 w-4 text-stamp-added" /> : <Share2 className="h-4 w-4" />}
      </DockButton>
      <DockButton label={t.dock.health} onClick={() => openHealth(null)}>
        <ShieldAlert className="h-4 w-4" />
      </DockButton>

      <DockDivider />

      <LocaleToggle />
    </div>
  );
}

function ImportDrawer() {
  const t = useT();
  const drawer = useSchemaStore((state) => state.drawer);
  const closeDrawer = useSchemaStore((state) => state.closeDrawer);
  if (drawer !== "import") return null;

  return (
    <aside className="animate-sheet-in panel pointer-events-auto absolute top-0 right-0 bottom-0 z-30 flex w-full max-w-[26rem] flex-col border-l">
      <header className="flex items-center justify-between border-b border-hairline/15 px-4 py-3.5">
        <h2 className="flex items-center gap-2 font-mono text-[13px] font-semibold tracking-wide text-slate-100 uppercase">
          <Upload className="h-4 w-4 text-marigold-light" />
          {t.importDrawer.title}
        </h2>
        <button
          type="button"
          onClick={closeDrawer}
          aria-label={t.importDrawer.closeAria}
          className="rounded-sm p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-4">
        <FileUpload variant="panel" onLoaded={closeDrawer} />
      </div>
    </aside>
  );
}

function Hero() {
  const t = useT();
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex overflow-y-auto bg-ink/90 px-6 py-10">
      <div className="fixed top-4 right-4 z-10">
        <LocaleToggle variant="hero" />
      </div>
      <div className="animate-rise-in m-auto w-full max-w-2xl">
        <div className="mb-7 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-sm border border-marigold/25 bg-marigold/10 px-3 py-1 text-[11px] font-medium text-marigold-light">
            <Sparkles className="h-3 w-3" />
            {t.hero.badge}
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-50">
            {t.hero.titlePrefix}
            <span className="text-marigold-light">{t.hero.titleEmphasis}</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">{t.hero.subtitle}</p>
        </div>
        <FileUpload variant="hero" />
      </div>
    </div>
  );
}

export default function UIOverlay() {
  const t = useT();
  const graph = useSchemaStore((state) => state.graph);
  const status = useSchemaStore((state) => state.status);
  const closeDrawer = useSchemaStore((state) => state.closeDrawer);
  const compare = useSchemaStore((state) => state.compare);
  const openDiff = useSchemaStore((state) => state.openDiff);
  const exitCompare = useSchemaStore((state) => state.exitCompare);
  const selectedTableId = useSchemaStore((state) => state.selectedTableId);
  const focusTable = useSchemaStore((state) => state.focusTable);
  const selectTable = useSchemaStore((state) => state.selectTable);
  const shareParams = useSchemaStore((state) => state.shareParams);
  const mutedWarningIds = useSchemaStore((state) => state.mutedWarningIds);
  const setMutedWarningIds = useSchemaStore((state) => state.setMutedWarningIds);
  const setLocale = useSchemaStore((state) => state.setLocale);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDrawer]);

  // Hydrate muted warnings + locale from storage once on mount, then mirror
  // further changes back. The write-back is a direct store subscription
  // rather than a React effect keyed on the selected state: a subscription
  // fires synchronously on each real store mutation (including the hydration
  // call below), so it can never observe this render's pre-hydration value —
  // an effect keyed on `[mutedWarningIds]`/`[locale]` would, racing against
  // the async state update and writing the stale default back over whatever
  // was just read from storage.
  useEffect(() => {
    const unsubscribe = useSchemaStore.subscribe((state, prevState) => {
      if (state.mutedWarningIds !== prevState.mutedWarningIds) {
        try {
          localStorage.setItem(MUTE_STORAGE_KEY, JSON.stringify(state.mutedWarningIds));
        } catch {
          /* ignore unwritable storage */
        }
      }
      if (state.locale !== prevState.locale) {
        try {
          localStorage.setItem(LOCALE_STORAGE_KEY, state.locale);
        } catch {
          /* ignore unwritable storage */
        }
      }
    });

    try {
      const raw = localStorage.getItem(MUTE_STORAGE_KEY);
      if (raw) setMutedWarningIds(JSON.parse(raw));
    } catch {
      /* ignore unreadable storage */
    }
    try {
      const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (storedLocale === "en" || storedLocale === "fr") setLocale(storedLocale);
    } catch {
      /* ignore unreadable storage */
    }

    return unsubscribe;
  }, [setMutedWarningIds, setLocale]);

  // A ?table=… param re-focuses the same table once its schema has loaded.
  // This must run — and set the ref below — before the URL-sync effect that
  // follows, or that effect would strip the param before it's ever read.
  const appliedTableParam = useRef(false);
  useEffect(() => {
    if (!graph || appliedTableParam.current) return;
    appliedTableParam.current = true;
    const tableId = new URLSearchParams(window.location.search).get("table");
    if (tableId && graph.tables.some((table) => table.id === tableId)) {
      focusTable(tableId);
      selectTable(tableId);
    }
  }, [graph, focusTable, selectTable]);

  // Keep the address bar reproducing the loaded schema + focused table, so a
  // copied link reopens the same view.
  useEffect(() => {
    if (!graph || !appliedTableParam.current) return;
    const params = new URLSearchParams();
    if (shareParams?.kind === "sample") params.set("sample", shareParams.key);
    else if (shareParams?.kind === "url") params.set("url", shareParams.url);
    if (selectedTableId) params.set("table", selectedTableId);
    const query = params.toString();
    const next = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", next);
  }, [graph, shareParams, selectedTableId]);

  if (!graph) return <Hero />;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {compare && (
        <div className="panel pointer-events-auto absolute top-4 left-[17rem] z-20 hidden items-center gap-3 rounded-sm border border-stamp-modified/25 px-3 py-2 text-[11px] sm:flex">
          <GitCompare className="h-3.5 w-3.5 shrink-0 text-stamp-modified" />
          <span className="flex min-w-0 items-center gap-1.5 truncate text-stamp-modified">
            <strong className="font-semibold">{compare.diff.baselineName}</strong>
            <span>→</span>
            <strong className="font-semibold">{compare.diff.currentName}</strong>
          </span>
          <button
            type="button"
            onClick={openDiff}
            className="shrink-0 font-medium text-stamp-modified underline-offset-2 hover:underline"
          >
            {t.compareBanner.viewDiff}
          </button>
          <button
            type="button"
            onClick={exitCompare}
            className="shrink-0 font-medium text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
          >
            {t.compareBanner.exit}
          </button>
        </div>
      )}

      <div className="absolute top-4 left-4">
        <TitleBlock />
      </div>

      <div className="absolute top-1/2 left-4 -translate-y-1/2">
        <ToolDock />
      </div>

      <div className="panel pointer-events-auto absolute right-4 bottom-16 hidden rounded-sm border px-3 py-2 text-[11px] text-slate-500 lg:block">
        {t.keyboardHint.orbit} · {t.keyboardHint.zoom} · {t.keyboardHint.focus} · {t.keyboardHint.pressPrefix}{" "}
        <kbd className="rounded-sm border border-hairline/25 px-1 font-mono text-slate-400">/</kbd>{" "}
        {t.keyboardHint.search}
      </div>

      <IssueTicker />

      {status === "loading" && (
        <div className="panel pointer-events-auto absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 rounded-sm border px-4 py-3">
          <Loader2 className="h-4 w-4 animate-spin text-marigold-light" />
          <span className="text-sm text-slate-300">{t.loading}</span>
        </div>
      )}

      <WarningsDrawer />
      <TableInspector />
      <ImportDrawer />
      <CompareDrawer />
      <DiffDrawer />
    </div>
  );
}
