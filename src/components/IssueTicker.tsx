"use client";

import { useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, ArrowRight, Info, ShieldCheck, Wrench } from "lucide-react";

import { SEVERITY_CLASSES } from "@/lib/theme";
import { useSchemaStore } from "@/state/useSchemaStore";
import type { SchemaWarning } from "@/lib/types";

const SEVERITY_ICON = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const SECONDS_PER_ITEM = 5;
const MIN_DURATION = 18;

function TickerChip({ warning }: { warning: SchemaWarning }) {
  const focusTable = useSchemaStore((state) => state.focusTable);
  const highlightRelation = useSchemaStore((state) => state.highlightRelation);
  const openHealth = useSchemaStore((state) => state.openHealth);

  const classes = SEVERITY_CLASSES[warning.severity];
  const Icon = SEVERITY_ICON[warning.severity];
  const remedy = warning.fix ?? warning.suggestion;

  return (
    <button
      type="button"
      onClick={() => {
        focusTable(warning.tableIds[0]);
        highlightRelation(warning.relationId ?? null);
        openHealth(warning.id);
      }}
      className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-left transition hover:bg-white/[0.06] ${classes.border} bg-white/[0.03]`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${classes.text}`} />
      <span className="max-w-[15rem] truncate text-[12px] font-medium text-slate-200">
        {warning.title}
      </span>
      <ArrowRight className="h-3 w-3 shrink-0 text-slate-600" />
      <Wrench className="h-3 w-3 shrink-0 text-slate-500" />
      <span className="max-w-[20rem] truncate font-mono text-[11px] text-slate-400">{remedy}</span>
    </button>
  );
}

export default function IssueTicker() {
  const graph = useSchemaStore((state) => state.graph);
  const drawer = useSchemaStore((state) => state.drawer);
  const [hovered, setHovered] = useState(false);

  const warnings = useMemo(() => graph?.warnings ?? [], [graph]);
  const track = useMemo(() => [...warnings, ...warnings], [warnings]);
  const duration = Math.max(warnings.length * SECONDS_PER_ITEM, MIN_DURATION);

  if (!graph) return null;

  return (
    <div className="glass pointer-events-auto absolute inset-x-0 bottom-0 z-20 h-11 overflow-hidden border-t">
      {warnings.length === 0 ? (
        <div className="flex h-full items-center justify-center gap-2 text-[12px] text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          All relations look healthy — no issues detected.
        </div>
      ) : (
        <div
          className="animate-ticker-scroll flex h-full items-center gap-3 px-4 whitespace-nowrap"
          style={{
            width: "max-content",
            animationName: "ticker-scroll",
            animationDuration: `${duration}s`,
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
            animationPlayState: hovered || drawer !== "none" ? "paused" : "running",
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {track.map((warning, index) => (
            <TickerChip key={`${warning.id}:${index}`} warning={warning} />
          ))}
        </div>
      )}
    </div>
  );
}
