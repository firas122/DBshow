import { SEVERITY_LABEL } from "@/lib/theme";
import { summarizeHealth } from "@/lib/validators/schemaLinter";
import type { SchemaGraph, WarningSeverity } from "@/lib/types";

const SEVERITY_ORDER: WarningSeverity[] = ["error", "warning", "info"];

/** Builds a shareable Markdown snapshot of the current health report. */
export function buildHealthReportMarkdown(graph: SchemaGraph, mutedIds: Set<string> = new Set()): string {
  const visible = graph.warnings.filter((w) => !mutedIds.has(w.id));
  const summary = summarizeHealth(graph, mutedIds);
  const lines: string[] = [];

  lines.push(`# Schema health report — ${graph.name}`);
  lines.push("");
  lines.push(
    `**Score:** ${summary.score}/100 — ${summary.errors} error(s) · ${summary.warnings} warning(s) · ${summary.info} note(s)`,
  );
  lines.push(`_${graph.tables.length} tables · ${graph.relations.length} relations_`);
  if (mutedIds.size > 0) {
    lines.push(`_${mutedIds.size} muted warning(s) excluded from the score above._`);
  }
  lines.push("");

  for (const severity of SEVERITY_ORDER) {
    const items = visible.filter((w) => w.severity === severity);
    if (items.length === 0) continue;

    lines.push(`## ${SEVERITY_LABEL[severity]}s (${items.length})`);
    lines.push("");
    for (const warning of items) {
      lines.push(`### ${warning.title}`);
      lines.push(
        `- **Where:** ${warning.tableIds.join(", ")}${warning.columnName ? ` (${warning.columnName})` : ""}`,
      );
      lines.push(`- **Issue:** ${warning.message}`);
      lines.push(`- **Why it matters:** ${warning.suggestion}`);
      if (warning.fix) {
        lines.push("- **Suggested fix:**");
        lines.push("  ```sql");
        for (const fixLine of warning.fix.split("\n")) lines.push(`  ${fixLine}`);
        lines.push("  ```");
      }
      lines.push("");
    }
  }

  if (visible.length === 0) {
    lines.push("No issues detected — every relation resolves, matches its parent's type and is indexed.");
  }

  return lines.join("\n");
}

/** Triggers a client-side file save for text content — no server round-trip. */
export function downloadTextFile(filename: string, content: string, mimeType = "text/markdown"): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
