import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BACKUPS_DIR } from "./paths";
import type { Variant, VariantModification } from "./types";

export interface ModReport {
  mod: VariantModification;
  outcome: "applied" | "alreadyApplied" | "notFound";
  occurrences: number;
}

export interface PatchResult {
  backupPath: string;
  applied: number;
  skipped: number;
  alreadyApplied: number;
  reports: ModReport[];
}

export function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  return haystack.split(needle).length - 1;
}

export function applyModsToString(src: string, mods: VariantModification[]): {
  src: string;
  reports: ModReport[];
  applied: number;
  skipped: number;
  alreadyApplied: number;
} {
  let out = src;
  let applied = 0;
  let skipped = 0;
  let alreadyApplied = 0;
  const reports: ModReport[] = [];

  for (const mod of mods) {
    const hasNew = out.includes(mod.newText);
    const hasOld = out.includes(mod.originalText);

    if (hasNew && !hasOld) {
      alreadyApplied++;
      reports.push({ mod, outcome: "alreadyApplied", occurrences: 0 });
      continue;
    }
    if (!hasOld) {
      skipped++;
      reports.push({ mod, outcome: "notFound", occurrences: 0 });
      continue;
    }

    const occ = countOccurrences(out, mod.originalText);
    out = out.split(mod.originalText).join(mod.newText);
    applied += occ;
    reports.push({ mod, outcome: "applied", occurrences: occ });
  }

  return { src: out, reports, applied, skipped, alreadyApplied };
}

export function backupCliJs(cliJs: string, tag = ""): string {
  mkdirSync(BACKUPS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const suffix = tag ? `.${tag}` : "";
  const backupPath = path.join(BACKUPS_DIR, `cli.js.${ts}${suffix}.backup`);
  copyFileSync(cliJs, backupPath);
  return backupPath;
}

export function applyVariantToFile(cliJs: string, variant: Variant, opts?: { tag?: string }): PatchResult {
  const backupPath = backupCliJs(cliJs, opts?.tag ?? variant.name);
  const src = readFileSync(cliJs, "utf8");
  const result = applyModsToString(src, variant.modifications);
  writeFileSync(cliJs, result.src, "utf8");
  return {
    backupPath,
    applied: result.applied,
    skipped: result.skipped,
    alreadyApplied: result.alreadyApplied,
    reports: result.reports,
  };
}

export function restoreFromBackup(cliJs: string, backupPath: string): void {
  copyFileSync(backupPath, cliJs);
}
