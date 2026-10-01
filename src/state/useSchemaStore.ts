"use client";

import { create } from "zustand";

import { diffSchemas, type SchemaDiff } from "@/lib/diff/schemaDiff";
import { computeLayout, type LayoutMode, type PositionMap } from "@/lib/graph/layouts";
import type { Relation, SchemaGraph, Table } from "@/lib/types";

export type DrawerMode = "none" | "health" | "inspector" | "import" | "compare" | "diff";

/** How the current graph was loaded, so a focused table can round-trip through a URL. */
export type ShareParams = { kind: "sample"; key: string } | { kind: "url"; url: string } | null;

interface CompareState {
  diff: SchemaDiff;
  viewGraph: SchemaGraph;
}

interface SchemaState {
  graph: SchemaGraph | null;
  positions: PositionMap;
  layout: LayoutMode;
  status: "empty" | "loading" | "ready" | "error";
  error: string | null;

  selectedTableId: string | null;
  hoveredTableId: string | null;
  hoveredRelationId: string | null;
  highlightedRelationId: string | null;

  drawer: DrawerMode;
  activeWarningId: string | null;
  search: string;

  showParticles: boolean;
  showEdgeLabels: boolean;
  autoRotate: boolean;

  /** Bumped to ask the camera rig to fly to a table. */
  focus: { tableId: string; nonce: number } | null;
  resetNonce: number;

  /** Warnings the user has silenced from the ticker and the health score. */
  mutedWarningIds: string[];

  /** How the loaded graph can be reproduced from a URL, for shareable links. */
  shareParams: ShareParams;
  /** Bundled "before" schema offered by the current sample, if any. */
  compareBaseline: { sql: string; name: string } | null;
  /** Active schema comparison, if any — drives the 3D view graph and the Diff drawer. */
  compare: CompareState | null;

  setLoading: () => void;
  setError: (message: string) => void;
  setGraph: (graph: SchemaGraph) => void;
  clearGraph: () => void;
  setLayout: (layout: LayoutMode) => void;
  reflow: () => void;

  selectTable: (tableId: string | null) => void;
  hoverTable: (tableId: string | null) => void;
  hoverRelation: (relationId: string | null) => void;
  highlightRelation: (relationId: string | null) => void;

  focusTable: (tableId: string) => void;
  resetView: () => void;

  openHealth: (warningId?: string | null) => void;
  openImport: () => void;
  openCompare: () => void;
  openDiff: () => void;
  closeDrawer: () => void;
  setActiveWarning: (warningId: string | null) => void;
  setSearch: (search: string) => void;

  toggleParticles: () => void;
  toggleEdgeLabels: () => void;
  toggleAutoRotate: () => void;

  toggleMuteWarning: (warningId: string) => void;
  setMutedWarningIds: (ids: string[]) => void;

  setShareParams: (params: ShareParams) => void;
  setCompareBaseline: (baseline: { sql: string; name: string } | null) => void;
  startCompare: (baseline: SchemaGraph) => void;
  exitCompare: () => void;
}

export const useSchemaStore = create<SchemaState>((set, get) => ({
  graph: null,
  positions: {},
  layout: "force",
  status: "empty",
  error: null,

  selectedTableId: null,
  hoveredTableId: null,
  hoveredRelationId: null,
  highlightedRelationId: null,

  drawer: "none",
  activeWarningId: null,
  search: "",

  showParticles: true,
  showEdgeLabels: false,
  autoRotate: false,

  focus: null,
  resetNonce: 0,

  mutedWarningIds: [],
  shareParams: null,
  compareBaseline: null,
  compare: null,

  setLoading: () => set({ status: "loading", error: null }),

  setError: (message) => set({ status: "error", error: message }),

  setGraph: (graph) =>
    set((state) => ({
      graph,
      positions: computeLayout(graph, state.layout),
      status: "ready",
      error: null,
      selectedTableId: null,
      hoveredTableId: null,
      hoveredRelationId: null,
      highlightedRelationId: null,
      activeWarningId: null,
      search: "",
      drawer: "none",
      focus: null,
      resetNonce: state.resetNonce + 1,
      compareBaseline: null,
      compare: null,
    })),

  clearGraph: () =>
    set({
      graph: null,
      positions: {},
      status: "empty",
      error: null,
      selectedTableId: null,
      drawer: "none",
      search: "",
    }),

  // Both of these bump resetNonce so the camera re-frames the new arrangement
  // instead of staying pointed wherever it was. They lay out whichever graph
  // is actually on screen — the diff view graph while comparing, else the
  // real one — so ghost nodes don't lose their position.
  setLayout: (layout) => {
    const { graph, compare } = get();
    const active = compare?.viewGraph ?? graph;
    set((state) => ({
      layout,
      positions: active ? computeLayout(active, layout) : {},
      resetNonce: state.resetNonce + 1,
    }));
  },

  reflow: () => {
    const { graph, layout, compare } = get();
    const active = compare?.viewGraph ?? graph;
    if (!active) return;
    set((state) => ({
      positions: computeLayout(active, layout),
      resetNonce: state.resetNonce + 1,
    }));
  },

  selectTable: (tableId) =>
    set((state) => ({
      selectedTableId: tableId,
      drawer: tableId ? "inspector" : state.drawer === "inspector" ? "none" : state.drawer,
    })),

  hoverTable: (tableId) => set({ hoveredTableId: tableId }),
  hoverRelation: (relationId) => set({ hoveredRelationId: relationId }),
  highlightRelation: (relationId) => set({ highlightedRelationId: relationId }),

  focusTable: (tableId) =>
    set((state) => ({
      focus: { tableId, nonce: (state.focus?.nonce ?? 0) + 1 },
      selectedTableId: tableId,
    })),

  resetView: () =>
    set((state) => ({
      resetNonce: state.resetNonce + 1,
      focus: null,
      selectedTableId: null,
      highlightedRelationId: null,
    })),

  openHealth: (warningId = null) => set({ drawer: "health", activeWarningId: warningId }),
  openImport: () => set({ drawer: "import" }),
  openCompare: () => set({ drawer: "compare" }),
  openDiff: () => set((state) => ({ drawer: state.compare ? "diff" : "compare" })),
  closeDrawer: () => set({ drawer: "none" }),
  setActiveWarning: (warningId) => set({ activeWarningId: warningId }),
  setSearch: (search) => set({ search }),

  toggleParticles: () => set((state) => ({ showParticles: !state.showParticles })),
  toggleEdgeLabels: () => set((state) => ({ showEdgeLabels: !state.showEdgeLabels })),
  toggleAutoRotate: () => set((state) => ({ autoRotate: !state.autoRotate })),

  toggleMuteWarning: (warningId) =>
    set((state) => ({
      mutedWarningIds: state.mutedWarningIds.includes(warningId)
        ? state.mutedWarningIds.filter((id) => id !== warningId)
        : [...state.mutedWarningIds, warningId],
    })),
  setMutedWarningIds: (ids) => set({ mutedWarningIds: ids }),

  setShareParams: (params) => set({ shareParams: params }),
  setCompareBaseline: (baseline) => set({ compareBaseline: baseline }),

  startCompare: (baseline) => {
    const { graph, layout } = get();
    if (!graph) return;
    const { diff, viewGraph } = diffSchemas(baseline, graph);
    set((state) => ({
      compare: { diff, viewGraph },
      positions: computeLayout(viewGraph, layout),
      resetNonce: state.resetNonce + 1,
      drawer: "diff",
      selectedTableId: null,
      highlightedRelationId: null,
      focus: null,
    }));
  },

  exitCompare: () => {
    const { graph, layout } = get();
    set((state) => ({
      compare: null,
      positions: graph ? computeLayout(graph, layout) : {},
      resetNonce: state.resetNonce + 1,
      drawer: "none",
      focus: null,
    }));
  },
}));

/* ----------------------------- derived helpers ---------------------------- */

/** The graph the 3D scene should render: the diff view graph while comparing, else the real one. */
export function useActiveGraph(): SchemaGraph | null {
  const graph = useSchemaStore((state) => state.graph);
  const compare = useSchemaStore((state) => state.compare);
  return compare ? compare.viewGraph : graph;
}

export function relationsForTable(graph: SchemaGraph, tableId: string): {
  outgoing: Relation[];
  incoming: Relation[];
} {
  return {
    outgoing: graph.relations.filter((r) => r.sourceTable === tableId),
    incoming: graph.relations.filter((r) => r.targetTable === tableId && !r.dangling),
  };
}

export function neighborsOf(graph: SchemaGraph, tableId: string): Set<string> {
  const neighbors = new Set<string>([tableId]);
  for (const relation of graph.relations) {
    if (relation.sourceTable === tableId) neighbors.add(relation.targetTable);
    if (relation.targetTable === tableId) neighbors.add(relation.sourceTable);
  }
  return neighbors;
}

export function findTable(graph: SchemaGraph | null, tableId: string | null): Table | null {
  if (!graph || !tableId) return null;
  return graph.tables.find((t) => t.id === tableId) ?? null;
}

export interface SearchHit {
  tableId: string;
  tableName: string;
  columnName?: string;
  detail: string;
}

export function searchSchema(graph: SchemaGraph | null, query: string, limit = 12): SearchHit[] {
  const term = query.trim().toLowerCase();
  if (!graph || term.length === 0) return [];

  const hits: SearchHit[] = [];
  for (const table of graph.tables) {
    if (table.name.toLowerCase().includes(term)) {
      hits.push({
        tableId: table.id,
        tableName: table.name,
        detail: `${table.columns.length} columns`,
      });
    }
    for (const column of table.columns) {
      if (hits.length >= limit) break;
      if (column.name.toLowerCase().includes(term)) {
        hits.push({
          tableId: table.id,
          tableName: table.name,
          columnName: column.name,
          detail: column.rawType,
        });
      }
    }
    if (hits.length >= limit) break;
  }
  return hits.slice(0, limit);
}
