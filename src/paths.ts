import os from "node:os";
import path from "node:path";
import { mkdirSync } from "node:fs";

export const DITTO_HOME = process.env.DITTO_HOME ?? path.join(os.homedir(), ".ditto");
export const STATE_FILE = path.join(DITTO_HOME, "state.json");
export const CACHE_DIR = path.join(DITTO_HOME, "cache");
export const PROMPT_CACHE_DIR = path.join(CACHE_DIR, "prompts");
export const VARIANTS_DIR = path.join(DITTO_HOME, "variants");
export const STAGED_DIR = path.join(DITTO_HOME, "staged");

export function ensureDirs(): void {
  for (const d of [DITTO_HOME, CACHE_DIR, PROMPT_CACHE_DIR, VARIANTS_DIR, STAGED_DIR]) {
    mkdirSync(d, { recursive: true });
  }
}
