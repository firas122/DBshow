import type { SchemaGraph, Table } from "@/lib/types";

/**
 * Size and spacing of a table in world units.
 *
 * A table is a glass sphere with its text floating at the centre. The text has
 * no panel behind it, but it still occupies a rectangle — the "text block" —
 * and the sphere is sized to contain that rectangle's corners.
 */

const TEXT_WIDTH = 3.4;
export const TEXT_PADDING = 0.16;
export const HEADER_HEIGHT = 0.62;
export const ROW_HEIGHT = 0.3;

/** Columns beyond this are collapsed into a "+N more" row to keep tables legible. */
const MAX_VISIBLE_COLUMNS = 14;

export interface TextBlockSize {
  width: number;
  height: number;
  visibleColumns: number;
  hiddenColumns: number;
}

export function textBlockSize(table: Table): TextBlockSize {
  const total = table.columns.length;
  const visibleColumns = Math.min(total, MAX_VISIBLE_COLUMNS);
  const hiddenColumns = total - visibleColumns;
  const rows = visibleColumns + (hiddenColumns > 0 ? 1 : 0);
  const height = HEADER_HEIGHT + rows * ROW_HEIGHT + TEXT_PADDING * 2;
  return { width: TEXT_WIDTH, height, visibleColumns, hiddenColumns };
}

/** Clearance between the text block's corners and the shell around it. */
const SHELL_PADDING = 1.18;

/**
 * Radius of the sphere a table is drawn inside — large enough to clear the
 * corners of its text. This is the radius the layout, the edge anchors and the
 * camera limits all work in.
 */
export function nodeRadius(table: Table): number {
  const { width, height } = textBlockSize(table);
  return (Math.hypot(width, height) / 2) * SHELL_PADDING;
}

/** Radius of the largest shell in the graph — the unit spacing derives from. */
export function maxNodeRadius(graph: SchemaGraph): number {
  return graph.tables.reduce((largest, table) => Math.max(largest, nodeRadius(table)), 2);
}

/**
 * Horizontal radius of the shell at a given height above its centre — where an
 * edge for a column at that row should meet the sphere's surface.
 */
export function shellRadiusAtHeight(table: Table, height: number): number {
  const radius = nodeRadius(table);
  const remaining = radius * radius - height * height;
  return remaining > 0 ? Math.sqrt(remaining) : radius * 0.25;
}

/**
 * Offset of a column row's centre from the table's centre, along the text
 * block's own up axis. The text billboards, so callers turn this into a world
 * offset using the camera's up vector.
 */
export function columnRowOffset(table: Table, columnName: string): number {
  const { height, visibleColumns } = textBlockSize(table);
  const index = table.columns.findIndex(
    (c) => c.name.toLowerCase() === columnName.toLowerCase(),
  );
  if (index < 0 || index >= visibleColumns) {
    // Hidden or unknown columns anchor to the centre.
    return 0;
  }
  return height / 2 - TEXT_PADDING - HEADER_HEIGHT - (index + 0.5) * ROW_HEIGHT;
}

/**
 * Scene scale grows with table count so dense schemas do not collapse into a
 * ball and sparse ones do not drift apart.
 */
export function sceneRadius(graph: SchemaGraph): number {
  return Math.max(9, Math.cbrt(Math.max(graph.tables.length, 1)) * 7.5);
}
