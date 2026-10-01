import * as THREE from "three";

import { TEXT_PADDING, HEADER_HEIGHT, ROW_HEIGHT, textBlockSize } from "@/lib/graph/geometry";
import { PALETTE } from "@/lib/theme";
import { tableHealth } from "@/lib/validators/schemaLinter";
import type { Table } from "@/lib/types";

/**
 * A table's text is drawn into a 2D canvas and used as a texture rather than
 * composed from 3D text meshes. That keeps each table to a single draw call,
 * renders emoji key/link glyphs with the system emoji font, and needs no
 * external font file at runtime.
 *
 * The canvas has no panel on it — just a soft elliptical scrim under the
 * glyphs. Because the scrim is fully feathered it has no edge to read as a
 * card, but it gives the type a dark ground to sit on, which is what makes it
 * legible against the starfield, the grid and whatever edges pass behind the
 * sphere.
 */

const PIXELS_PER_UNIT = 168;
const SUPERSAMPLE = 2;

/**
 * Feathered elliptical wash under the text. Drawn before any shadow is set so
 * it does not pick one up, and faded to fully transparent well before the
 * canvas edge so no boundary is ever visible.
 */
function paintScrim(ctx: CanvasRenderingContext2D, width: number, height: number) {
  // Work in a space squashed to the block's aspect, so a circle here becomes an
  // ellipse that tracks the text rather than a generic blob.
  const radius = (width / 2) * 1.06;

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(1, height / width);

  const wash = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  wash.addColorStop(0, "rgba(3, 7, 16, 0.9)");
  wash.addColorStop(0.5, "rgba(3, 7, 16, 0.82)");
  wash.addColorStop(0.8, "rgba(3, 7, 16, 0.42)");
  wash.addColorStop(1, "rgba(3, 7, 16, 0)");

  ctx.fillStyle = wash;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.restore();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

const SANS = '600 {size}px "Segoe UI", Inter, system-ui, -apple-system, sans-serif';
const MONO = '{weight} {size}px "Cascadia Code", "JetBrains Mono", Consolas, monospace';

function font(template: string, size: number, weight = "400"): string {
  return template.replace("{size}", String(size)).replace("{weight}", weight);
}

export function createTableTexture(table: Table): THREE.CanvasTexture {
  const { width: worldWidth, height: worldHeight, visibleColumns, hiddenColumns } = textBlockSize(table);

  const scale = PIXELS_PER_UNIT * SUPERSAMPLE;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(worldWidth * scale);
  canvas.height = Math.round(worldHeight * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is unavailable.");

  const W = canvas.width;
  const H = canvas.height;
  const pad = TEXT_PADDING * scale;
  const headerH = HEADER_HEIGHT * scale;
  const rowH = ROW_HEIGHT * scale;
  const health = tableHealth(table);
  const accent = health === "error" ? PALETTE.error : health === "warning" ? PALETTE.warning : PALETTE.ok;

  ctx.clearRect(0, 0, W, H);
  paintScrim(ctx, W, H);

  // A tight halo on each glyph, on top of the scrim — enough to survive an edge
  // passing behind the type without smearing the letterforms.
  ctx.shadowColor = "rgba(2, 6, 16, 0.9)";
  ctx.shadowBlur = 0.07 * scale;

  // Table name.
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = font(SANS, Math.round(0.25 * scale));
  const nameY = pad + headerH / 2;
  const badgeWidth = table.warnings.length > 0 ? 0.62 * scale : 0.34 * scale;
  ctx.fillText(truncate(ctx, table.name, W - pad * 2 - badgeWidth), pad, nameY);

  // Warning count, or a tick when the table is clean.
  ctx.textAlign = "right";
  if (table.warnings.length > 0) {
    ctx.font = font(SANS, Math.round(0.185 * scale));
    ctx.fillStyle = accent;
    ctx.fillText(`⚠ ${table.warnings.length}`, W - pad, nameY);
  } else {
    ctx.font = font(SANS, Math.round(0.18 * scale));
    ctx.fillStyle = `${PALETTE.ok}cc`;
    ctx.fillText("✓", W - pad, nameY);
  }

  // Column rows.
  const columns = table.columns.slice(0, visibleColumns);
  columns.forEach((column, index) => {
    const top = pad + headerH + index * rowH;
    const centerY = top + rowH / 2;

    const glyph = column.isPrimaryKey ? "🔑" : column.isForeignKey ? "🔗" : "";
    const glyphWidth = 0.28 * scale;

    ctx.textAlign = "left";
    if (glyph) {
      ctx.font = font(SANS, Math.round(0.155 * scale));
      ctx.fillText(glyph, pad, centerY);
    } else {
      ctx.fillStyle = "rgba(100, 116, 139, 0.5)";
      ctx.beginPath();
      ctx.arc(pad + glyphWidth * 0.32, centerY, 0.02 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // Column names lead, declared types sit a clear step behind them.
    const nameColor = column.isPrimaryKey
      ? "#fcd34d"
      : column.isForeignKey
        ? "#7dd3fc"
        : "#e8eef7";

    ctx.textAlign = "right";
    ctx.font = font(MONO, Math.round(0.135 * scale));
    // An unindexed foreign key tints its own type, so the defect is visible on
    // the table itself and not only in the drawer.
    ctx.fillStyle = column.isForeignKey && !column.isIndexed ? PALETTE.warning : "#8b9bb4";
    const typeLabel = `${column.rawType}${column.isNullable ? "" : " •"}`;
    const typeText = truncate(ctx, typeLabel, W * 0.42);
    ctx.fillText(typeText, W - pad, centerY);
    const typeWidth = ctx.measureText(typeText).width;

    ctx.textAlign = "left";
    ctx.font = font(MONO, Math.round(0.17 * scale), column.isPrimaryKey ? "600" : "500");
    ctx.fillStyle = nameColor;
    const nameX = pad + glyphWidth;
    ctx.fillText(
      truncate(ctx, column.name, W - nameX - pad - typeWidth - 0.14 * scale),
      nameX,
      centerY,
    );
  });

  if (hiddenColumns > 0) {
    const top = pad + headerH + visibleColumns * rowH;
    ctx.textAlign = "center";
    ctx.font = font(MONO, Math.round(0.14 * scale), "500");
    ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
    ctx.fillText(`+ ${hiddenColumns} more column${hiddenColumns === 1 ? "" : "s"}`, W / 2, top + rowH / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * The far-distance label: just the table name, drawn large.
 *
 * The detailed texture is mostly transparent, so minification mips average its
 * thin glyphs away to nothing and a zoomed-out sphere looks empty. This stands
 * in for it once a row would be only a few pixels tall.
 */
export function createTableNameTexture(table: Table): THREE.CanvasTexture {
  const { width: worldWidth, height: worldHeight } = textBlockSize(table);
  const scale = PIXELS_PER_UNIT * SUPERSAMPLE;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(worldWidth * scale);
  canvas.height = Math.round(worldHeight * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is unavailable.");

  const health = tableHealth(table);
  const accent =
    health === "error" ? PALETTE.error : health === "warning" ? PALETTE.warning : PALETTE.ok;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  paintScrim(ctx, canvas.width, canvas.height);
  ctx.shadowColor = "rgba(2, 6, 16, 0.9)";
  ctx.shadowBlur = 0.1 * scale;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  const centerY = canvas.height / 2;
  ctx.font = font(SANS, Math.round(0.82 * scale));
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(
    truncate(ctx, table.name, canvas.width * 0.94),
    canvas.width / 2,
    centerY - 0.18 * scale,
  );

  ctx.font = font(SANS, Math.round(0.4 * scale));
  ctx.fillStyle = accent;
  const subtitle =
    table.warnings.length > 0 ? `⚠ ${table.warnings.length}` : `${table.columns.length} cols`;
  ctx.fillText(truncate(ctx, subtitle, canvas.width * 0.94), canvas.width / 2, centerY + 0.56 * scale);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/** Small billboard texture for the floating warning badge above a table. */
export function createBadgeTexture(count: number, color: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is unavailable.");

  const glow = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size / 2);
  glow.addColorStop(0, `${color}88`);
  glow.addColorStop(1, `${color}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(8, 13, 25, 0.92)";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.035;
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = `600 ${Math.round(size * 0.3)}px "Segoe UI", Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(count > 1 ? String(count) : "!", size / 2, size / 2 + size * 0.02);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
