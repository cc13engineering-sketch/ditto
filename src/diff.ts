import { readFileSync } from "node:fs";
import { applyModsToString, countOccurrences } from "./patch";
import type { Variant } from "./types";

export interface SimResult {
  applied: number;
  skipped: number;
  alreadyApplied: number;
  summary: string[];
}

export function simulateApply(cliJs: string, variant: Variant): SimResult {
  const src = readFileSync(cliJs, "utf8");
  const { applied, skipped, alreadyApplied, reports } = applyModsToString(
    src,
    variant.modifications,
  );

  const summary: string[] = [];
  for (const r of reports) {
    const header = `${r.mod.promptName} [piece ${r.mod.pieceIndex}]`;
    if (r.outcome === "applied") summary.push(`[APPLY x${r.occurrences}] ${header}  — ${r.mod.rationale}`);
    else if (r.outcome === "alreadyApplied") summary.push(`[ALREADY] ${header}`);
    else summary.push(`[SKIP (not found)] ${header}`);
  }
  return { applied, skipped, alreadyApplied, summary };
}

export function renderPerModDiff(variant: Variant, cliJs?: string): string {
  const src = cliJs ? readFileSync(cliJs, "utf8") : null;

  const lines: string[] = [];
  lines.push(`# ditto variant: ${variant.name}`);
  lines.push(`# directive: ${variant.directive}`);
  lines.push(`# claude-code: ${variant.claudeCodeVersion}  |  tweakcc: ${variant.tweakccVersion}`);
  lines.push(`# modifications: ${variant.modifications.length}`);
  if (variant.skipped && variant.skipped.length) {
    lines.push(`# skipped (from authoring): ${variant.skipped.length}`);
  }
  lines.push("");

  for (const mod of variant.modifications) {
    let state = "";
    if (src) {
      if (src.includes(mod.newText) && !src.includes(mod.originalText)) state = "ALREADY APPLIED";
      else if (!src.includes(mod.originalText)) state = "NOT FOUND IN cli.js";
      else state = `WILL APPLY x${countOccurrences(src, mod.originalText)}`;
    }

    lines.push(`## ${mod.promptName}  [piece ${mod.pieceIndex}]${state ? `  (${state})` : ""}`);
    lines.push(`   id: ${mod.promptId}`);
    lines.push(`   why: ${mod.rationale}`);
    lines.push(`--- original`);
    for (const ln of mod.originalText.split("\n")) lines.push(`- ${ln}`);
    lines.push(`+++ new`);
    for (const ln of mod.newText.split("\n")) lines.push(`+ ${ln}`);
    lines.push("");
  }

  if (variant.skipped && variant.skipped.length) {
    lines.push(`# skipped mods (recorded at authoring time, no match in cli.js)`);
    for (const s of variant.skipped) {
      lines.push(`- ${s.rationale}  — ${s.reason}`);
    }
  }

  return lines.join("\n");
}
