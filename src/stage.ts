import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { STAGED_DIR } from "./paths";
import type { StagedPromptSet } from "./types";

export function stagedPath(version: string): string {
  return path.join(STAGED_DIR, `prompts-${version}.json`);
}

export function hasStaged(version: string): boolean {
  return existsSync(stagedPath(version));
}

export function readStaged(version: string): StagedPromptSet {
  const p = stagedPath(version);
  if (!existsSync(p)) {
    throw new Error(
      `No staged prompt set for Claude Code ${version}. Run: ditto stage`,
    );
  }
  return JSON.parse(readFileSync(p, "utf8")) as StagedPromptSet;
}
