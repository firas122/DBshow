"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  Columns3,
  Globe,
  Grid3x3,
  KeyRound,
  Layers,
  Link2,
  Loader2,
  Maximize,
  Orbit,
  Search,
  ShieldAlert,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

import FileUpload from "@/components/FileUpload";
import IssueTicker from "@/components/IssueTicker";
import TableInspector from "@/components/TableInspector";
import WarningsDrawer from "@/components/WarningsDrawer";
import { LAYOUT_LABELS, type LayoutMode } from "@/lib/graph/layouts";
import { summarizeHealth } from "@/lib/validators/schemaLinter";
import { searchSchema, useSchemaStore } from "@/state/useSchemaStore";

const LAYOUT_ICONS: Record<LayoutMode, typeof Orbit> = {
  force: Orbit,
  sphere: Globe,
  grid: Layers,
};

const SOURCE_LABEL: Record<string, string> = {
  sql: "SQL DDL",
  sqlite: "SQLite",
  json: "JSON",
  sample: "Sample",
};

function IconButton({
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
      className={`rounded-lg border p-2 transition ${
        active
          ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-200"
          : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function SearchBox() {
  const graph = useSchemaStore((state) => state.graph);
  const search = useSchemaStore((state) => state.search);
  const setSearch = useSchemaStore((state) => state.setSearch);
  const focusTable = useSchemaStore((state) => state.focusTable);
  const selectTable = useSchemaStore((state) => state.selectTable);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hits = useMemo(() => searchSchema(graph, search), [graph, search]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (event.key === "/" && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = (tableId: string) => {
    focusTable(tableId);
    selectTable(tableId);
    setOpen(false);
  };

  return (
    <div className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
      <input
        ref={inputRef}
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 140)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && hits[0]) go(hits[0].tableId);
        }}
        placeholder="Search tables & columns…"
        className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pr-8 pl-9 text-[13px] text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:bg-slate-950/70"
      />
      {search && (
        <button
          type="button"
          onClick={() => setSearch("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-slate-500 hover:text-slate-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && hits.length > 0 && (
        <div className="glass scrollbar-thin animate-rise-in absolute top-full right-0 left-0 mt-1.5 max-h-72 overflow-y-auto rounded-xl border p-1 shadow-2xl">
          {hits.map((hit) => (
            <button
              key={`${hit.tableId}.${hit.columnName ?? ""}`}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => go(hit.tableId)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-cyan-400/10"
            >
              {hit.columnName ? (
                <Columns3 className="h-3.5 w-3.5 shrink-0 text-cyan-400/70" />
              ) : (
                <Boxes className="h-3.5 w-3.5 shrink-0 text-amber-400/70" />
              )}
              <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-slate-200">
                {hit.tableName}
                {hit.columnName && <span className="text-slate-500">.{hit.columnName}</span>}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-slate-500">{hit.detail}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Legend() {
  const graph = useSchemaStore((state) => state.graph);
  if (!graph) return null;

  const items = [
    { color: "#fbbf24", label: "Primary key", icon: KeyRound },
    { color: "#22d3ee", label: "Healthy foreign key", icon: Link2 },
    { color: "#f59e0b", label: "Suspect / suggested", icon: ShieldAlert },
    { color: "#fb7185", label: "Error", icon: ShieldAlert },
  ];

  return (
    <div className="glass pointer-events-auto hidden rounded-xl border px-3 py-2.5 md:block">
      <p className="mb-2 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
        Legend
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-[11px] text-slate-400">
            <span
              className="h-0.5 w-5 rounded-full"
              style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}` }}
            />
            {item.label}
          </li>
        ))}
        <li className="flex items-center gap-2 text-[11px] text-slate-400">
          <span
            className="h-0.5 w-5 rounded-full"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to right, #f59e0b 0 4px, transparent 4px 7px)",
            }}
          />
          Dashed = no FK constraint
        </li>
      </ul>
    </div>
  );
}

function ImportDrawer() {
  const drawer = useSchemaStore((state) => state.drawer);
  const closeDrawer = useSchemaStore((state) => state.closeDrawer);
  if (drawer !== "import") return null;

  return (
    <aside className="animate-drawer-in glass pointer-events-auto absolute top-0 right-0 bottom-0 z-30 flex w-full max-w-[26rem] flex-col border-l">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Upload className="h-4 w-4 text-cyan-300" />
          Load another schema
        </h2>
        <button
          type="button"
          onClick={closeDrawer}
          aria-label="Close importer"
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
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
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-[#04060d]/80 px-6 py-10 backdrop-blur-sm">
      <div className="animate-rise-in w-full max-w-2xl">
        <div className="mb-7 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium text-cyan-200">
            <Sparkles className="h-3 w-3" />
            Parsed in your browser — nothing is uploaded
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-50">
            See your database in{" "}
            <span className="bg-gradient-to-r from-cyan-300 to-amber-300 bg-clip-text text-transparent">
              three dimensions
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
            Drop a SQL dump, a SQLite file or a JSON schema. DBShow maps every table and foreign key
            into an animated 3D diagram, then flags the relationships that look wrong.
          </p>
        </div>
        <FileUpload variant="hero" />
      </div>
    </div>
  );
}

export default function UIOverlay() {
  const graph = useSchemaStore((state) => state.graph);
  const status = useSchemaStore((state) => state.status);
  const layout = useSchemaStore((state) => state.layout);
  const setLayout = useSchemaStore((state) => state.setLayout);
  const reflow = useSchemaStore((state) => state.reflow);
  const resetView = useSchemaStore((state) => state.resetView);
  const openHealth = useSchemaStore((state) => state.openHealth);
  const openImport = useSchemaStore((state) => state.openImport);
  const closeDrawer = useSchemaStore((state) => state.closeDrawer);
  const showParticles = useSchemaStore((state) => state.showParticles);
  const toggleParticles = useSchemaStore((state) => state.toggleParticles);
  const showEdgeLabels = useSchemaStore((state) => state.showEdgeLabels);
  const toggleEdgeLabels = useSchemaStore((state) => state.toggleEdgeLabels);
  const autoRotate = useSchemaStore((state) => state.autoRotate);
  const toggleAutoRotate = useSchemaStore((state) => state.toggleAutoRotate);

  const summary = useMemo(() => (graph ? summarizeHealth(graph) : null), [graph]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDrawer]);

  if (!graph) return <Hero />;

  const issueCount = (summary?.errors ?? 0) + (summary?.warnings ?? 0);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <header className="glass pointer-events-auto absolute top-0 right-0 left-0 flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-1.5">
            <Boxes className="h-4 w-4 text-cyan-300" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] leading-tight font-semibold text-slate-100">
              {graph.name}
            </p>
            <p className="truncate text-[11px] leading-tight text-slate-500">
              {SOURCE_LABEL[graph.source] ?? graph.source} · {graph.tables.length} tables ·{" "}
              {graph.relations.length} relations
            </p>
          </div>
        </div>

        <div className="order-3 w-full md:order-none md:ml-4 md:w-auto md:flex-1">
          <SearchBox />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
            {(Object.keys(LAYOUT_LABELS) as LayoutMode[]).map((mode) => {
              const Icon = LAYOUT_ICONS[mode];
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setLayout(mode)}
                  title={`${LAYOUT_LABELS[mode]} layout`}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition ${
                    layout === mode
                      ? "bg-cyan-400/15 text-cyan-200"
                      : "text-slate-400 hover:text-slate-100"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">{LAYOUT_LABELS[mode]}</span>
                </button>
              );
            })}
          </div>

          <IconButton label="Re-run layout" onClick={reflow}>
            <Grid3x3 className="h-4 w-4" />
          </IconButton>
          <IconButton label="Frame all tables" onClick={resetView}>
            <Maximize className="h-4 w-4" />
          </IconButton>
          <IconButton label="Data flow particles" active={showParticles} onClick={toggleParticles}>
            <Sparkles className="h-4 w-4" />
          </IconButton>
          <IconButton label="Edge labels" active={showEdgeLabels} onClick={toggleEdgeLabels}>
            <Link2 className="h-4 w-4" />
          </IconButton>
          <IconButton label="Auto-rotate" active={autoRotate} onClick={toggleAutoRotate}>
            <Orbit className="h-4 w-4" />
          </IconButton>

          <button
            type="button"
            onClick={() => openHealth(null)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[12px] font-medium transition ${
              (summary?.errors ?? 0) > 0
                ? "border-rose-400/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
                : issueCount > 0
                  ? "border-amber-400/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
                  : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            <span className="hidden sm:inline">Health</span>
            {issueCount > 0 && <span className="tabular-nums">{issueCount}</span>}
          </button>

          <button
            type="button"
            onClick={openImport}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-[12px] font-medium text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-200"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Load</span>
          </button>
        </div>
      </header>

      <div className="absolute bottom-16 left-4">
        <Legend />
      </div>

      <div className="glass pointer-events-auto absolute right-4 bottom-16 hidden rounded-xl border px-3 py-2 text-[11px] text-slate-500 lg:block">
        Drag to orbit · scroll to zoom · click a table to focus · press{" "}
        <kbd className="rounded border border-white/15 bg-white/5 px-1 font-mono text-slate-400">
          /
        </kbd>{" "}
        to search
      </div>

      <IssueTicker />

      {status === "loading" && (
        <div className="glass pointer-events-auto absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 rounded-xl border px-4 py-3">
          <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
          <span className="text-sm text-slate-300">Parsing schema…</span>
        </div>
      )}

      <WarningsDrawer />
      <TableInspector />
      <ImportDrawer />
    </div>
  );
}
