import { existsSync, readFileSync } from "node:fs";
import { detectClaudeCode } from "./detect";
import { getPromptSet } from "./fetch";
import { PATCHER_SCRIPT } from "./paths";
import { hasVariant, saveVariant } from "./variants";
import type { TweakccPrompt, Variant, VariantModification, VariantSkipped } from "./types";

export interface BootstrapResult {
  created: boolean;
  reason: string;
  modifications: number;
  skipped: number;
  path?: string;
}

export async function bootstrapSmart(opts?: { force?: boolean }): Promise<BootstrapResult> {
  if (!opts?.force && hasVariant("smart")) {
    return { created: false, reason: "already exists (variants/smart.json)", modifications: 0, skipped: 0 };
  }
  if (!existsSync(PATCHER_SCRIPT)) {
    return {
      created: false,
      reason: `patcher script not found at ${PATCHER_SCRIPT} — skipping smart seed`,
      modifications: 0,
      skipped: 0,
    };
  }

  const script = readFileSync(PATCHER_SCRIPT, "utf8");
  const patches = parsePatches(script);
  if (patches.length === 0) {
    return {
      created: false,
      reason: "no patch() calls found in patcher script",
      modifications: 0,
      skipped: 0,
    };
  }

  const detection = detectClaudeCode();
  const promptSet = await getPromptSet(detection.version);

  const modifications: VariantModification[] = [];
  const skipped: VariantSkipped[] = [];

  for (const p of patches) {
    const match = findPieceMatch(p.oldText, promptSet.prompts);
    if (match) {
      modifications.push({
        promptId: match.promptId,
        promptName: match.promptName,
        pieceIndex: match.pieceIndex,
        originalText: p.oldText,
        newText: p.newText,
        rationale: p.label,
      });
    } else {
      skipped.push({
        rationale: p.label,
        originalText: p.oldText,
        newText: p.newText,
        reason: `no piece in prompts-${detection.version}.json contains this text`,
      });
    }
  }

  const variant: Variant = {
    name: "smart",
    directive: "the patcher's original 13 opinions (quality > speed, judgment > rules, pragmatic fixes > narrow scope)",
    created: new Date().toISOString(),
    claudeCodeVersion: detection.version,
    tweakccVersion: promptSet.version,
    modifications,
    skipped: skipped.length ? skipped : undefined,
  };

  const out = saveVariant(variant);
  return {
    created: true,
    reason: `seeded from ${PATCHER_SCRIPT}`,
    modifications: modifications.length,
    skipped: skipped.length,
    path: out,
  };
}

interface ParsedPatch {
  label: string;
  oldText: string;
  newText: string;
}

function parsePatches(script: string): ParsedPatch[] {
  const re =
    /patch\s*\(\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*\)/g;
  const out: ParsedPatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(script)) !== null) {
    const [, label, oldText, newText] = m;
    if (label === undefined || oldText === undefined || newText === undefined) continue;
    out.push({ label: decodeLit(label), oldText: decodeLit(oldText), newText: decodeLit(newText) });
  }
  return out;
}

function decodeLit(s: string): string {
  // Patcher script uses JS-style escapes inside the bash-single-quoted PATCH_SCRIPT:
  // \u0027  →  '    \n → newline    \" → "    \\ → \    \t → tab    \r → CR
  return s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function findPieceMatch(
  needle: string,
  prompts: TweakccPrompt[],
): { promptId: string; promptName: string; pieceIndex: number } | null {
  for (const p of prompts) {
    for (let i = 0; i < p.pieces.length; i++) {
      if ((p.pieces[i] ?? "").includes(needle)) {
        return { promptId: p.id, promptName: p.name, pieceIndex: i };
      }
    }
  }
  return null;
}
