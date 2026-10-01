/**
 * Minimal ambient types for d3-force-3d, which ships untyped. Only the subset
 * used by the layout engine is declared.
 */
declare module "d3-force-3d" {
  export interface SimulationNode {
    index?: number;
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number | null;
    fy?: number | null;
    fz?: number | null;
  }

  export interface SimulationLink<N> {
    source: N | string | number;
    target: N | string | number;
    index?: number;
  }

  export interface Force<N> {
    (alpha: number): void;
    initialize?(nodes: N[], random?: () => number): void;
  }

  export interface LinkForce<N, L> extends Force<N> {
    links(): L[];
    links(links: L[]): this;
    id(accessor: (node: N, index: number, nodes: N[]) => string): this;
    distance(distance: number | ((link: L, index: number, links: L[]) => number)): this;
    strength(strength: number | ((link: L, index: number, links: L[]) => number)): this;
    iterations(count: number): this;
  }

  export interface ManyBodyForce<N> extends Force<N> {
    strength(strength: number | ((node: N, index: number, nodes: N[]) => number)): this;
    distanceMin(distance: number): this;
    distanceMax(distance: number): this;
    theta(theta: number): this;
  }

  export interface CenterForce<N> extends Force<N> {
    x(x: number): this;
    y(y: number): this;
    z(z: number): this;
    strength(strength: number): this;
  }

  export interface CollideForce<N> extends Force<N> {
    radius(radius: number | ((node: N, index: number, nodes: N[]) => number)): this;
    strength(strength: number): this;
    iterations(count: number): this;
  }

  export interface PositionForce<N> extends Force<N> {
    x(x: number | ((node: N, index: number, nodes: N[]) => number)): this;
    y(y: number | ((node: N, index: number, nodes: N[]) => number)): this;
    z(z: number | ((node: N, index: number, nodes: N[]) => number)): this;
    strength(strength: number | ((node: N, index: number, nodes: N[]) => number)): this;
  }

  export interface Simulation<N, L> {
    tick(iterations?: number): this;
    stop(): this;
    restart(): this;
    nodes(): N[];
    nodes(nodes: N[]): this;
    alpha(alpha: number): this;
    alphaMin(min: number): this;
    alphaDecay(decay: number): this;
    alphaTarget(target: number): this;
    velocityDecay(decay: number): this;
    numDimensions(dimensions: 1 | 2 | 3): this;
    force(name: string): Force<N> | undefined;
    force(name: string, force: Force<N> | null): this;
    randomSource(source: () => number): this;
  }

  export function forceSimulation<N extends SimulationNode, L = SimulationLink<N>>(
    nodes?: N[],
    numDimensions?: 1 | 2 | 3,
  ): Simulation<N, L>;

  export function forceLink<N extends SimulationNode, L extends SimulationLink<N>>(
    links?: L[],
  ): LinkForce<N, L>;

  export function forceManyBody<N extends SimulationNode>(): ManyBodyForce<N>;
  export function forceCenter<N extends SimulationNode>(
    x?: number,
    y?: number,
    z?: number,
  ): CenterForce<N>;
  export function forceCollide<N extends SimulationNode>(
    radius?: number | ((node: N, index: number, nodes: N[]) => number),
  ): CollideForce<N>;
  export function forceX<N extends SimulationNode>(x?: number): PositionForce<N>;
  export function forceY<N extends SimulationNode>(y?: number): PositionForce<N>;
  export function forceZ<N extends SimulationNode>(z?: number): PositionForce<N>;
  export function forceRadial<N extends SimulationNode>(
    radius: number | ((node: N, index: number, nodes: N[]) => number),
    x?: number,
    y?: number,
    z?: number,
  ): Force<N> & { strength(strength: number): unknown };
}
