import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PATCHER_LOCAL_PROMPTS_DIR, PROMPT_CACHE_DIR, ensureDirs } from "./paths";
import type { TweakccPromptSet } from "./types";

const TWEAKCC_RAW_BASE =
  "https://raw.githubusercontent.com/Piebald-AI/tweakcc/main/data/prompts";
const TWEAKCC_API_LIST =
  "https://api.github.com/repos/Piebald-AI/tweakcc/contents/data/prompts";

export class TweakccNotFoundError extends Error {
  constructor(
    public requestedVersion: string,
    public latestAvailable: string | null,
  ) {
    const tail = latestAvailable
      ? `\nLatest on tweakcc: ${latestAvailable}.\nOptions:\n  (a) wait for tweakcc to publish prompts-${requestedVersion}.json\n  (b) npm install -g @anthropic-ai/claude-code@${latestAvailable}`
      : `\nOptions:\n  (a) wait for tweakcc to publish prompts-${requestedVersion}.json\n  (b) check https://github.com/Piebald-AI/tweakcc/tree/main/data/prompts for an available version and downgrade`;
    super(`No tweakcc prompts for ${requestedVersion}.${tail}`);
    this.name = "TweakccNotFoundError";
  }
}

export function cachedPromptSetPath(version: string): string {
  return path.join(PROMPT_CACHE_DIR, `prompts-${version}.json`);
}

export async function getPromptSet(
  version: string,
  opts?: { force?: boolean; silent?: boolean },
): Promise<TweakccPromptSet> {
  ensureDirs();
  const cachePath = cachedPromptSetPath(version);

  if (!opts?.force && existsSync(cachePath)) {
    const data = JSON.parse(readFileSync(cachePath, "utf8")) as TweakccPromptSet;
    return data;
  }

  // Also try the patcher's local copy as an offline fallback (one-time seed into cache).
  const localSeed = path.join(PATCHER_LOCAL_PROMPTS_DIR, `prompts-${version}.json`);
  if (!opts?.force && existsSync(localSeed)) {
    copyFileSync(localSeed, cachePath);
    if (!opts?.silent) console.error(`(seeded cache from ${localSeed})`);
    return JSON.parse(readFileSync(cachePath, "utf8")) as TweakccPromptSet;
  }

  const url = `${TWEAKCC_RAW_BASE}/prompts-${version}.json`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(`Network error fetching ${url}: ${(err as Error).message}`);
  }
  if (res.status === 404) {
    const latest = await getLatestTweakccVersion().catch(() => null);
    throw new TweakccNotFoundError(version, latest);
  }
  if (!res.ok) {
    throw new Error(`Fetch ${url} failed: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  writeFileSync(cachePath, text, "utf8");
  return JSON.parse(text) as TweakccPromptSet;
}

export async function getLatestTweakccVersion(): Promise<string | null> {
  try {
    const res = await fetch(TWEAKCC_API_LIST, {
      headers: { "User-Agent": "ditto-cli" },
    });
    if (!res.ok) return null;
    const files = (await res.json()) as Array<{ name: string }>;
    const versions = files
      .map((f) => /^prompts-([\d.]+)\.json$/.exec(f.name)?.[1])
      .filter((v): v is string => !!v);
    versions.sort(cmpSemver);
    return versions[versions.length - 1] ?? null;
  } catch {
    return null;
  }
}

export function cmpSemver(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number(n) || 0);
  const pb = b.split(".").map((n) => Number(n) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}
