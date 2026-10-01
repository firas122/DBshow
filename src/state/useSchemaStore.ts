"use client";

import { create } from "zustand";

import { computeLayout, type LayoutMode, type PositionMap } from "@/lib/graph/layouts";
import type { Relation, SchemaGraph, Table } from "@/lib/types";

export type DrawerMode = "none" | "health" | "inspector" | "import";

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
  closeDrawer: () => void;
  setActiveWarning: (warningId: string | null) => void;
  setSearch: (search: string) => void;

  toggleParticles: () => void;
  toggleEdgeLabels: () => void;
  toggleAutoRotate: () => void;
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
  // instead of staying pointed wherever it was.
  setLayout: (layout) => {
    const { graph } = get();
    set((state) => ({
      layout,
      positions: graph ? computeLayout(graph, layout) : {},
      resetNonce: state.resetNonce + 1,
    }));
  },

  reflow: () => {
    const { graph, layout } = get();
    if (!graph) return;
    set((state) => ({
      positions: computeLayout(graph, layout),
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
  closeDrawer: () => set({ drawer: "none" }),
  setActiveWarning: (warningId) => set({ activeWarningId: warningId }),
  setSearch: (search) => set({ search }),

  toggleParticles: () => set((state) => ({ showParticles: !state.showParticles })),
  toggleEdgeLabels: () => set((state) => ({ showEdgeLabels: !state.showEdgeLabels })),
  toggleAutoRotate: () => set((state) => ({ autoRotate: !state.autoRotate })),
}));

/* ----------------------------- derived helpers ---------------------------- */

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
