import type { DiffStatus, HealthStatus, WarningSeverity } from "@/lib/types";

/** Single source of truth for colours shared between the DOM and the 3D scene. */
export const PALETTE = {
  ok: "#22d3ee",
  pk: "#fbbf24",
  fk: "#22d3ee",
  warning: "#f59e0b",
  error: "#fb7185",
  implicit: "#f59e0b",
  selection: "#67e8f9",
  hover: "#e0f2fe",
  surface: "#0b1220",
  surfaceRaised: "#111c33",
  muted: "#64748b",
  text: "#e2e8f0",
  textDim: "#94a3b8",
} as const;

export const HEALTH_COLOR: Record<HealthStatus, string> = {
  ok: PALETTE.ok,
  warning: PALETTE.warning,
  error: PALETTE.error,
};

/** Colours used only inside a schema diff's view graph. */
export const DIFF_COLOR: Record<DiffStatus, string> = {
  added: "#34d399",
  removed: "#fb7185",
  modified: "#a78bfa",
};

/** Tailwind class fragments for diff-tinted DOM chrome — ink stamps, not neon pills. */
export const DIFF_CLASSES: Record<
  DiffStatus,
  { text: string; border: string; bg: string }
> = {
  added: { text: "text-stamp-added", border: "border-stamp-added/40", bg: "bg-stamp-added/10" },
  removed: { text: "text-stamp-removed", border: "border-stamp-removed/40", bg: "bg-stamp-removed/10" },
  modified: { text: "text-stamp-modified", border: "border-stamp-modified/40", bg: "bg-stamp-modified/10" },
};

export const SEVERITY_COLOR: Record<WarningSeverity, string> = {
  error: "#b85c52",
  warning: "#ad8a42",
  info: "#5b7fa6",
};

export const SEVERITY_LABEL: Record<WarningSeverity, string> = {
  error: "Error",
  warning: "Warning",
  info: "Note",
};

/** Tailwind class fragments for severity-tinted DOM chrome — desaturated ink stamps. */
export const SEVERITY_CLASSES: Record<
  WarningSeverity,
  { text: string; border: string; bg: string; dot: string }
> = {
  error: {
    text: "text-stamp-error",
    border: "border-stamp-error/40",
    bg: "bg-stamp-error/10",
    dot: "bg-stamp-error",
  },
  warning: {
    text: "text-stamp-warning",
    border: "border-stamp-warning/40",
    bg: "bg-stamp-warning/10",
    dot: "bg-stamp-warning",
  },
  info: {
    text: "text-stamp-info",
    border: "border-stamp-info/40",
    bg: "bg-stamp-info/10",
    dot: "bg-stamp-info",
  },
};
