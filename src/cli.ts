import { existsSync, readFileSync } from "node:fs";
import { bootstrapSmart } from "./bootstrap";
import { detectClaudeCode } from "./detect";
import { renderPerModDiff, simulateApply } from "./diff";
import { cachedPromptSetPath, getLatestTweakccVersion, getPromptSet, TweakccNotFoundError } from "./fetch";
import { ensureDirs, DITTO_HOME } from "./paths";
import { applyVariantToFile, restoreFromBackup } from "./patch";
import { findPromptById, renderPromptAnnotated, summarize } from "./prompts";
import { readState, writeState } from "./state";
import { hasVariant, listVariants, loadVariant, saveVariant, validateVariantName, validateVariantShape } from "./variants";
import { verifyCliJs } from "./verify";

async function main(): Promise<void> {
  ensureDirs();
  const [, , cmd, ...rest] = process.argv;
  try {
    switch (cmd) {
      case "check":
        return await cmdCheck();
      case "prompts":
        return await cmdPrompts(rest);
      case "show":
        return await cmdShow(rest);
      case "save":
        return await cmdSave(rest);
      case "diff":
        return await cmdDiff(rest);
      case "apply":
        return await cmdApply(rest);
      case "restore":
        return await cmdRestore();
      case "list":
        return cmdList();
      case "status":
        return cmdStatus();
      case "bootstrap-smart":
        return await cmdBootstrapSmart();
      case undefined:
      case "help":
      case "--help":
      case "-h":
        return cmdHelp();
      default:
        console.error(`ditto: unknown command: ${cmd}\n`);
        cmdHelp();
        process.exit(2);
    }
  } catch (err) {
    const e = err as { message?: string };
    console.error(`ditto: ${e.message ?? String(err)}`);
    process.exit(1);
  }
}

function cmdHelp(): void {
  const lines = [
    "ditto — directive-driven Claude Code prompt customization",
    "",
    "Usage:  ditto <command> [args]",
    "",
    "Commands:",
    "  check                        Detect Claude Code + verify tweakcc prompts are available",
    "  prompts [--json]             List prompt ids/names/descriptions for the installed version",
    "  show <prompt-id>             Print a reconstructed prompt (pieces + placeholders)",
    "  save <name> [--stdin|--file path]",
    "                               Save a variant JSON",
    "  diff <name>                  Show per-modification diff of a variant",
    "  apply <name>                 Backup cli.js → apply variant → verify → update state",
    "  restore                      Restore cli.js from the most recent backup",
    "  list                         List saved variants; mark which is applied",
    "  status                       Summarize Claude Code / tweakcc / applied variant",
    "  bootstrap-smart              Seed variants/smart.json from ~/DIY/AI/patcher/patch-claude-code.sh",
    "  help                         This help",
    "",
    `home: ${DITTO_HOME}`,
  ];
  console.log(lines.join("\n"));
}

async function cmdCheck(): Promise<void> {
  const det = detectClaudeCode();
  process.stdout.write(`Claude Code: ${det.version}  (${det.cliJs})\n`);

  try {
    const set = await getPromptSet(det.version);
    process.stdout.write(`tweakcc: prompts-${set.version}.json OK (${set.prompts.length} prompts)\n`);
  } catch (err) {
    if (err instanceof TweakccNotFoundError) {
      process.stderr.write(err.message + "\n");
      process.exit(1);
    }
    throw err;
  }

  // First-run: auto-seed smart variant (plan section "Seed variant smart")
  if (!hasVariant("smart")) {
    const r = await bootstrapSmart();
    if (r.created) {
      process.stdout.write(
        `seeded variants/smart.json  (${r.modifications} mods, ${r.skipped} skipped)\n` +
          `apply it:  ditto apply smart\n`,
      );
    } else {
      process.stdout.write(`smart seed: ${r.reason}\n`);
    }
  }
}

async function cmdPrompts(rest: string[]): Promise<void> {
  const json = rest.includes("--json");
  const det = detectClaudeCode();
  const set = await getPromptSet(det.version);
  const rows = summarize(set.prompts);
  if (json) {
    process.stdout.write(JSON.stringify({ version: set.version, prompts: rows }, null, 2) + "\n");
    return;
  }
  const idWidth = Math.max(...rows.map((r) => r.id.length), 3);
  for (const r of rows) {
    process.stdout.write(`${r.id.padEnd(idWidth)}  ${r.name}  — ${r.description}\n`);
  }
  process.stdout.write(`\n${rows.length} prompts  (claude-code ${det.version}, tweakcc ${set.version})\n`);
}

async function cmdShow(rest: string[]): Promise<void> {
  const id = rest[0];
  if (!id) throw new Error("usage: ditto show <prompt-id>");
  const det = detectClaudeCode();
  const set = await getPromptSet(det.version);
  const prompt = findPromptById(set.prompts, id);
  if (!prompt) throw new Error(`prompt not found: ${id}\n  try: ditto prompts`);
  process.stdout.write(renderPromptAnnotated(prompt));
}

async function cmdSave(rest: string[]): Promise<void> {
  const name = rest[0];
  if (!name) throw new Error("usage: ditto save <name> [--stdin | --file <path>]");
  validateVariantName(name);

  let raw: string;
  const fileIdx = rest.indexOf("--file");
  if (rest.includes("--stdin")) {
    raw = await readStdinAll();
  } else if (fileIdx !== -1 && rest[fileIdx + 1]) {
    const p = rest[fileIdx + 1]!;
    if (!existsSync(p)) throw new Error(`--file not found: ${p}`);
    raw = readFileSync(p, "utf8");
  } else {
    throw new Error("provide variant JSON via --stdin or --file <path>");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`variant JSON is invalid: ${(err as Error).message}`);
  }
  const variant = validateVariantShape(parsed);
  // Honor the CLI-supplied name: override whatever the JSON said.
  variant.name = name;
  if (!variant.created) variant.created = new Date().toISOString();

  const p = saveVariant(variant);
  process.stdout.write(`saved ${variant.name} → ${p}\n`);
  process.stdout.write(`  ${variant.modifications.length} modifications\n`);
}

async function cmdDiff(rest: string[]): Promise<void> {
  const name = rest[0];
  if (!name) throw new Error("usage: ditto diff <name>");
  const variant = loadVariant(name);
  const det = detectClaudeCode();

  if (variant.claudeCodeVersion !== det.version) {
    process.stderr.write(
      `note: variant was authored for ${variant.claudeCodeVersion}, current is ${det.version}\n`,
    );
  }

  process.stdout.write(renderPerModDiff(variant, det.cliJs) + "\n");
}

async function cmdApply(rest: string[]): Promise<void> {
  const name = rest[0];
  if (!name) throw new Error("usage: ditto apply <name>");
  const variant = loadVariant(name);
  const det = detectClaudeCode();

  if (variant.claudeCodeVersion !== det.version) {
    process.stderr.write(
      `warning: variant was authored for ${variant.claudeCodeVersion}, current is ${det.version}\n`,
    );
  }

  const state = readState();

  // If a different variant is currently applied, restore first so we start from pristine.
  if (state.appliedVariant && state.appliedVariant !== variant.name && state.lastBackupPath && existsSync(state.lastBackupPath)) {
    restoreFromBackup(det.cliJs, state.lastBackupPath);
    process.stdout.write(`(pre-apply: restored pristine cli.js from ${state.lastBackupPath})\n`);
  }

  const result = applyVariantToFile(det.cliJs, variant);
  const verdict = verifyCliJs(det.cliJs);

  if (!verdict.ok) {
    process.stderr.write(`verify failed: node cli.js --version exited ${verdict.code}\n`);
    if (verdict.stderr) process.stderr.write(verdict.stderr + "\n");
    restoreFromBackup(det.cliJs, result.backupPath);
    process.stderr.write(`restored cli.js from ${result.backupPath}\n`);
    process.exit(1);
  }

  const next = {
    appliedVariant: variant.name,
    lastBackupPath: state.appliedVariant === variant.name && state.lastBackupPath ? state.lastBackupPath : result.backupPath,
    appliedAt: new Date().toISOString(),
    claudeCodeVersion: det.version,
  };
  writeState(next);

  process.stdout.write(
    `applied ${variant.name}: +${result.applied} replaced, ${result.alreadyApplied} already, ${result.skipped} not found\n`,
  );
  process.stdout.write(`verified: ${verdict.stdout.trim()}\n`);
  process.stdout.write(`backup: ${next.lastBackupPath}\n`);

  if (result.skipped) {
    for (const r of result.reports) {
      if (r.outcome === "notFound") {
        process.stdout.write(`  [not found] ${r.mod.promptName} [piece ${r.mod.pieceIndex}]\n`);
      }
    }
  }
}

async function cmdRestore(): Promise<void> {
  const det = detectClaudeCode();
  const state = readState();
  if (!state.lastBackupPath || !existsSync(state.lastBackupPath)) {
    throw new Error(
      `no backup to restore from in state.json (${state.lastBackupPath ?? "null"}).\n` +
        `run  ditto status  to inspect`,
    );
  }
  restoreFromBackup(det.cliJs, state.lastBackupPath);
  const verdict = verifyCliJs(det.cliJs);
  if (!verdict.ok) {
    process.stderr.write(`warning: restored cli.js failed --version check (${verdict.code}): ${verdict.stderr}\n`);
  }
  process.stdout.write(`restored cli.js from ${state.lastBackupPath}\n`);
  if (verdict.ok) process.stdout.write(`verified: ${verdict.stdout.trim()}\n`);

  writeState({
    appliedVariant: null,
    lastBackupPath: null,
    appliedAt: null,
    claudeCodeVersion: det.version,
  });
}

function cmdList(): void {
  const state = readState();
  const variants = listVariants();
  if (variants.length === 0) {
    process.stdout.write("(no variants yet — use the ditto skill or `ditto bootstrap-smart`)\n");
    return;
  }
  const nameWidth = Math.max(...variants.map((v) => v.name.length), 4);
  for (const v of variants) {
    const marker = state.appliedVariant === v.name ? "*" : " ";
    const mods = `${v.modifications.length} mods`;
    process.stdout.write(`${marker} ${v.name.padEnd(nameWidth)}  ${mods.padStart(7)}  — ${v.directive}\n`);
  }
  if (state.appliedVariant) process.stdout.write(`\n* = currently applied\n`);
}

function cmdStatus(): void {
  const state = readState();
  let det: { version: string; cliJs: string } | null = null;
  try {
    det = detectClaudeCode();
  } catch (err) {
    process.stdout.write(`Claude Code: NOT FOUND  (${(err as Error).message.split("\n")[0]})\n`);
  }
  if (det) process.stdout.write(`Claude Code: ${det.version}  (${det.cliJs})\n`);

  if (det) {
    const cached = existsSync(cachedPromptSetPath(det.version));
    process.stdout.write(`tweakcc cache: ${cached ? "yes" : "no"}  (${cachedPromptSetPath(det.version)})\n`);
  }

  process.stdout.write(`applied variant: ${state.appliedVariant ?? "(none)"}\n`);
  if (state.appliedAt) process.stdout.write(`applied at: ${state.appliedAt}\n`);
  if (state.lastBackupPath) process.stdout.write(`last backup: ${state.lastBackupPath}\n`);
  process.stdout.write(`ditto home: ${DITTO_HOME}\n`);
}

async function cmdBootstrapSmart(): Promise<void> {
  const r = await bootstrapSmart();
  if (r.created) {
    process.stdout.write(`${r.reason}\n`);
    process.stdout.write(`  ${r.modifications} modifications, ${r.skipped} skipped\n`);
    process.stdout.write(`  → ${r.path}\n`);
    if (r.skipped) {
      process.stdout.write(`  (skipped entries likely drifted out of this Claude Code version)\n`);
    }
  } else {
    process.stdout.write(`no-op: ${r.reason}\n`);
  }
}

async function readStdinAll(): Promise<string> {
  let data = "";
  for await (const chunk of process.stdin) {
    data += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
  }
  return data;
}

void main();
