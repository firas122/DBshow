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

export const DIFF_CLASSES: Record<
  DiffStatus,
  { text: string; border: string; bg: string }
> = {
  added: { text: "text-emerald-300", border: "border-emerald-400/40", bg: "bg-emerald-500/10" },
  removed: { text: "text-rose-300", border: "border-rose-400/40", bg: "bg-rose-500/10" },
  modified: { text: "text-violet-300", border: "border-violet-400/40", bg: "bg-violet-500/10" },
};

export const SEVERITY_COLOR: Record<WarningSeverity, string> = {
  error: PALETTE.error,
  warning: PALETTE.warning,
  info: "#38bdf8",
};

export const SEVERITY_LABEL: Record<WarningSeverity, string> = {
  error: "Error",
  warning: "Warning",
  info: "Note",
};

/** Tailwind class fragments for severity-tinted DOM chrome. */
export const SEVERITY_CLASSES: Record<
  WarningSeverity,
  { text: string; border: string; bg: string; dot: string }
> = {
  error: {
    text: "text-rose-300",
    border: "border-rose-400/40",
    bg: "bg-rose-500/10",
    dot: "bg-rose-400",
  },
  warning: {
    text: "text-amber-300",
    border: "border-amber-400/40",
    bg: "bg-amber-500/10",
    dot: "bg-amber-400",
  },
  info: {
    text: "text-sky-300",
    border: "border-sky-400/40",
    bg: "bg-sky-500/10",
    dot: "bg-sky-400",
  },
};
