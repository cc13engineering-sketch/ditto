import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { VARIANTS_DIR } from "./paths";
import type { Variant } from "./types";

export function variantPath(name: string): string {
  return path.join(VARIANTS_DIR, `${name}.json`);
}

export function saveVariant(v: Variant): string {
  mkdirSync(VARIANTS_DIR, { recursive: true });
  const p = variantPath(v.name);
  writeFileSync(p, JSON.stringify(v, null, 2) + "\n", "utf8");
  return p;
}

export function loadVariant(name: string): Variant {
  const p = variantPath(name);
  if (!existsSync(p)) {
    throw new Error(`Variant not found: ${name}\n  expected: ${p}`);
  }
  return JSON.parse(readFileSync(p, "utf8")) as Variant;
}

export function hasVariant(name: string): boolean {
  return existsSync(variantPath(name));
}

export function listVariants(): Variant[] {
  if (!existsSync(VARIANTS_DIR)) return [];
  return readdirSync(VARIANTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .map((n) => loadVariant(n));
}

const VARIANT_NAME_RE = /^[a-z0-9][a-z0-9-_]{0,63}$/;

export function validateVariantName(name: string): void {
  if (!VARIANT_NAME_RE.test(name)) {
    throw new Error(
      `Invalid variant name "${name}". Use lowercase letters, digits, "-" or "_"; start with a letter/digit; ≤64 chars.`,
    );
  }
}

export function validateVariantShape(v: unknown): Variant {
  if (!v || typeof v !== "object") throw new Error("Variant must be a JSON object");
  const o = v as Record<string, unknown>;
  const required = ["name", "directive", "claudeCodeVersion", "tweakccVersion", "modifications"];
  for (const k of required) {
    if (!(k in o)) throw new Error(`Variant missing required field: ${k}`);
  }
  if (!Array.isArray(o.modifications)) throw new Error("modifications must be an array");
  for (const [i, m] of (o.modifications as unknown[]).entries()) {
    if (!m || typeof m !== "object") throw new Error(`modifications[${i}] must be an object`);
    const mo = m as Record<string, unknown>;
    for (const k of ["promptId", "promptName", "pieceIndex", "originalText", "newText", "rationale"]) {
      if (!(k in mo)) throw new Error(`modifications[${i}] missing field: ${k}`);
    }
    if (typeof mo.originalText !== "string" || typeof mo.newText !== "string") {
      throw new Error(`modifications[${i}] originalText/newText must be strings`);
    }
    if (mo.originalText === mo.newText) {
      throw new Error(`modifications[${i}] originalText === newText (no-op)`);
    }
  }
  return v as Variant;
}
