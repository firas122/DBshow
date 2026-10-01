import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  forceZ,
  type SimulationNode,
} from "d3-force-3d";

import { maxNodeRadius, nodeRadius, sceneRadius } from "@/lib/graph/geometry";

import type { SchemaGraph } from "@/lib/types";

export type LayoutMode = "force" | "sphere" | "grid";

export type PositionMap = Record<string, [number, number, number]>;

export const LAYOUT_LABELS: Record<LayoutMode, string> = {
  force: "Force",
  sphere: "Sphere",
  grid: "Layered",
};

interface LayoutNode extends SimulationNode {
  id: string;
  radius: number;
}

interface LayoutLink {
  source: string;
  target: string;
  weight: number;
}

/** Deterministic PRNG so a given schema always lays out identically. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * 3D force-directed layout. The simulation is stepped to completion up front
 * rather than animated tick-by-tick: the scene then eases nodes into their
 * final positions, which avoids the jitter of a live simulation while keeping
 * the organic spacing a force layout gives you.
 */
function forceLayout(graph: SchemaGraph): PositionMap {
  const radius = sceneRadius(graph);
  const random = seededRandom(hashString(graph.tables.map((t) => t.id).join("|")));

  const nodes: LayoutNode[] = graph.tables.map((table, index) => {
    // Seed on a sphere so the simulation starts from a spread-out state.
    const angle = (index / Math.max(graph.tables.length, 1)) * Math.PI * 2;
    return {
      id: table.id,
      radius: nodeRadius(table),
      x: Math.cos(angle) * radius * 0.6 + (random() - 0.5) * 2,
      y: (random() - 0.5) * radius,
      z: Math.sin(angle) * radius * 0.6 + (random() - 0.5) * 2,
    };
  });

  const linkWeights = new Map<string, LayoutLink>();
  for (const relation of graph.relations) {
    if (relation.dangling) continue;
    if (relation.sourceTable === relation.targetTable) continue;
    const key = [relation.sourceTable, relation.targetTable].sort().join("|");
    const existing = linkWeights.get(key);
    if (existing) existing.weight += 1;
    else {
      linkWeights.set(key, {
        source: relation.sourceTable,
        target: relation.targetTable,
        weight: 1,
      });
    }
  }
  const links = [...linkWeights.values()];

  const meanRadius =
    nodes.reduce((total, node) => total + node.radius, 0) / Math.max(nodes.length, 1);
  const linkDistance = meanRadius * 3.4;

  const simulation = forceSimulation<LayoutNode, LayoutLink>(nodes, 3)
    .numDimensions(3)
    .randomSource(random)
    .alpha(1)
    .alphaDecay(0.0228)
    .velocityDecay(0.4)
    .force(
      "link",
      forceLink<LayoutNode, LayoutLink>(links)
        .id((node) => node.id)
        .distance((link) => linkDistance - Math.min(link.weight, 3) * meanRadius * 0.25)
        .strength((link) => Math.min(0.9, 0.3 + link.weight * 0.1)),
    )
    // Repulsion is scaled to card size, not to scene size: tying it to the
    // scene radius made the graph blow apart faster than centring could pull
    // it back, leaving tables kilometres from the camera.
    .force(
      "charge",
      forceManyBody<LayoutNode>()
        .strength(-meanRadius * 11)
        .distanceMax(linkDistance * 3),
    )
    .force("center", forceCenter<LayoutNode>(0, 0, 0).strength(1))
    // Mild pull toward the origin on each axis so unconnected tables settle
    // near the cluster instead of drifting off under pure repulsion.
    .force("x", forceX<LayoutNode>(0).strength(0.07))
    .force("y", forceY<LayoutNode>(0).strength(0.09))
    .force("z", forceZ<LayoutNode>(0).strength(0.07))
    .force(
      "collide",
      forceCollide<LayoutNode>((node) => node.radius * 1.3)
        .strength(0.9)
        .iterations(3),
    );

  simulation.tick(420);
  simulation.stop();

  const positions: PositionMap = {};
  for (const node of nodes) {
    positions[node.id] = [node.x ?? 0, node.y ?? 0, node.z ?? 0];
  }
  return recenter(positions);
}

/**
 * Moves the layout's centroid to the origin. Forces can leave the cluster
 * off-centre, which throws off camera framing.
 */
function recenter(positions: PositionMap): PositionMap {
  const entries = Object.entries(positions);
  if (entries.length === 0) return positions;

  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const [, [x, y, z]] of entries) {
    cx += x;
    cy += y;
    cz += z;
  }
  cx /= entries.length;
  cy /= entries.length;
  cz /= entries.length;

  const centered: PositionMap = {};
  for (const [id, [x, y, z]] of entries) {
    centered[id] = [x - cx, y - cy, z - cz];
  }
  return centered;
}

/** Evenly distributes tables over a sphere using the Fibonacci lattice. */
function sphereLayout(graph: SchemaGraph): PositionMap {
  const count = graph.tables.length;
  // Sized so neighbouring cards clear each other rather than by scene radius,
  // which left small schemas stranded far apart.
  const radius = Math.max(maxNodeRadius(graph) * 1.7 * Math.sqrt(count), 7);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const positions: PositionMap = {};

  // Order by connectivity so heavily linked tables end up as neighbours.
  const degree = new Map<string, number>();
  for (const relation of graph.relations) {
    degree.set(relation.sourceTable, (degree.get(relation.sourceTable) ?? 0) + 1);
    degree.set(relation.targetTable, (degree.get(relation.targetTable) ?? 0) + 1);
  }
  const ordered = [...graph.tables].sort(
    (a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || a.id.localeCompare(b.id),
  );

  ordered.forEach((table, index) => {
    const y = count === 1 ? 0 : 1 - (index / (count - 1)) * 2;
    const ringRadius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * index;
    positions[table.id] = [
      Math.cos(theta) * ringRadius * radius,
      y * radius,
      Math.sin(theta) * ringRadius * radius,
    ];
  });

  return positions;
}

/**
 * Layered layout: tables are stacked by dependency depth (tables nothing
 * depends on sit at the bottom, their dependants above), and spread on a grid
 * within each layer.
 */
function gridLayout(graph: SchemaGraph): PositionMap {
  const dependencies = new Map<string, Set<string>>();
  for (const table of graph.tables) dependencies.set(table.id, new Set());
  for (const relation of graph.relations) {
    if (relation.dangling || relation.sourceTable === relation.targetTable) continue;
    dependencies.get(relation.sourceTable)?.add(relation.targetTable);
  }

  // Longest-path depth, with a visit guard so cycles terminate.
  const depths = new Map<string, number>();
  const resolving = new Set<string>();

  const depthOf = (id: string): number => {
    const cached = depths.get(id);
    if (cached !== undefined) return cached;
    if (resolving.has(id)) return 0;

    resolving.add(id);
    let depth = 0;
    for (const parent of dependencies.get(id) ?? []) {
      depth = Math.max(depth, depthOf(parent) + 1);
    }
    resolving.delete(id);
    depths.set(id, depth);
    return depth;
  };

  for (const table of graph.tables) depthOf(table.id);

  const layers = new Map<number, string[]>();
  for (const table of graph.tables) {
    const depth = depths.get(table.id) ?? 0;
    const layer = layers.get(depth) ?? [];
    layer.push(table.id);
    layers.set(depth, layer);
  }

  const cardUnit = maxNodeRadius(graph);
  const widestLayer = Math.max(...[...layers.values()].map((ids) => ids.length), 1);
  const spacing = cardUnit * 2.1 + Math.min(widestLayer, 6) * 0.35;
  const layerHeight = cardUnit * 2.8;
  const maxDepth = Math.max(...layers.keys(), 0);
  const positions: PositionMap = {};

  for (const [depth, ids] of [...layers.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...ids].sort();
    const columns = Math.max(1, Math.ceil(Math.sqrt(sorted.length)));
    const rows = Math.ceil(sorted.length / columns);

    sorted.forEach((id, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      positions[id] = [
        (column - (columns - 1) / 2) * spacing,
        (depth - maxDepth / 2) * layerHeight,
        (row - (rows - 1) / 2) * spacing,
      ];
    });
  }

  return positions;
}

export function computeLayout(graph: SchemaGraph, mode: LayoutMode): PositionMap {
  if (graph.tables.length === 0) return {};
  if (mode === "sphere") return sphereLayout(graph);
  if (mode === "grid") return gridLayout(graph);
  return forceLayout(graph);
}

/**
 * Bounding sphere of the laid-out nodes: the box centre, plus the distance to
 * the furthest node from it. Used to frame the camera.
 */
export function layoutBounds(positions: PositionMap): { center: [number, number, number]; radius: number } {
  const entries = Object.values(positions);
  if (entries.length === 0) return { center: [0, 0, 0], radius: 12 };

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const [x, y, z] of entries) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }

  const center: [number, number, number] = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
  ];

  let radius = 0;
  for (const [x, y, z] of entries) {
    radius = Math.max(radius, Math.hypot(x - center[0], y - center[1], z - center[2]));
  }

  return { center, radius: Math.max(radius, 4) };
}
