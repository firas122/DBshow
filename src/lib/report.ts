import type { Locale } from "@/lib/i18n/locale";
import { UI_STRINGS } from "@/lib/i18n/ui";
import { summarizeHealth } from "@/lib/validators/schemaLinter";
import type { SchemaGraph, WarningSeverity } from "@/lib/types";

const SEVERITY_ORDER: WarningSeverity[] = ["error", "warning", "info"];

/** Builds a shareable Markdown snapshot of the current health report. */
export function buildHealthReportMarkdown(
  graph: SchemaGraph,
  mutedIds: Set<string> = new Set(),
  locale: Locale = "en",
): string {
  const t = UI_STRINGS[locale];
  const visible = graph.warnings.filter((w) => !mutedIds.has(w.id));
  const summary = summarizeHealth(graph, mutedIds);
  const lines: string[] = [];

  lines.push(`# ${t.report.heading(graph.name)}`);
  lines.push("");
  lines.push(t.report.score(summary.score, summary.errors, summary.warnings, summary.info));
  lines.push(`_${t.report.tablesRelations(graph.tables.length, graph.relations.length)}_`);
  if (mutedIds.size > 0) {
    lines.push(`_${t.report.mutedExcluded(mutedIds.size)}_`);
  }
  lines.push("");

  for (const severity of SEVERITY_ORDER) {
    const items = visible.filter((w) => w.severity === severity);
    if (items.length === 0) continue;

    lines.push(`## ${t.severityLabel[severity]}s (${items.length})`);
    lines.push("");
    for (const warning of items) {
      lines.push(`### ${warning.title}`);
      lines.push(
        `- **${t.report.where}:** ${warning.tableIds.join(", ")}${warning.columnName ? ` (${warning.columnName})` : ""}`,
      );
      lines.push(`- **${t.report.issue}:** ${warning.message}`);
      lines.push(`- **${t.report.whyItMatters}:** ${warning.suggestion}`);
      if (warning.fix) {
        lines.push(`- **${t.report.suggestedFix}:**`);
        lines.push("  ```sql");
        for (const fixLine of warning.fix.split("\n")) lines.push(`  ${fixLine}`);
        lines.push("  ```");
      }
      lines.push("");
    }
  }

  if (visible.length === 0) {
    lines.push(t.report.noIssues);
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
