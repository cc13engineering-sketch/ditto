import { existsSync, readFileSync } from "node:fs";
import { detectClaudeCode } from "./detect";
import { renderPerModDiff } from "./diff";
import { cachedPromptSetPath, getLatestTweakccVersion, getPromptSet, TweakccNotFoundError } from "./fetch";
import { ensureDirs, DITTO_HOME } from "./paths";
import { applyVariantToFile } from "./patch";
import { findPromptById, renderPromptAnnotated, summarize } from "./prompts";
import { reinstallClaudeCode } from "./reinstall";
import { hasStaged, readStaged, stagedPath } from "./stage";
import { readState, writeState } from "./state";
import { listVariants, loadVariant, saveVariant, validateVariantName, validateVariantShape } from "./variants";
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
      case "stage":
        return await cmdStage(rest);
      case "reinstall":
        return await cmdReinstall();
      case "list":
        return cmdList();
      case "status":
        return cmdStatus();
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
    "  apply <name>                 Apply variant → verify → update state (reinstalls on switch/failure)",
    "  stage [version]              Prepare per-version staged prompt whitelist (skill writes it)",
    "  reinstall                    npm reinstall the current Claude Code version to return to pristine",
    "  list                         List saved variants; mark which is applied",
    "  status                       Summarize Claude Code / tweakcc / applied variant",
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

  if (hasStaged(det.version)) {
    const staged = readStaged(det.version);
    process.stdout.write(`staged: yes (${staged.kept.length} kept)\n`);
  } else {
    process.stdout.write(`staged: no  (run: ditto stage)\n`);
  }
}

async function cmdPrompts(rest: string[]): Promise<void> {
  const json = rest.includes("--json");
  const det = detectClaudeCode();

  if (!hasStaged(det.version)) {
    throw new Error(
      `No staged prompt set for Claude Code ${det.version}. Run: ditto stage`,
    );
  }

  const set = await getPromptSet(det.version);
  const staged = readStaged(det.version);
  const keptIds = new Set(staged.kept.map((k) => k.id));
  const kept = set.prompts.filter((p) => keptIds.has(p.id));
  const rows = summarize(kept);
  if (json) {
    process.stdout.write(JSON.stringify({ version: set.version, prompts: rows }, null, 2) + "\n");
    return;
  }
  const idWidth = Math.max(...rows.map((r) => r.id.length), 3);
  for (const r of rows) {
    process.stdout.write(`${r.id.padEnd(idWidth)}  ${r.name}  — ${r.description}\n`);
  }
  process.stdout.write(
    `\n${rows.length} prompts kept (of ${set.prompts.length})  (claude-code ${det.version}, tweakcc ${set.version})\n`,
  );
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

  if (!hasStaged(det.version)) {
    throw new Error(
      `No staged prompt set for Claude Code ${det.version}. Run: ditto stage`,
    );
  }

  if (variant.claudeCodeVersion !== det.version) {
    process.stderr.write(
      `warning: variant was authored for ${variant.claudeCodeVersion}, current is ${det.version}\n`,
    );
  }

  const state = readState();

  // If a different variant is currently applied, reinstall to get pristine cli.js first.
  if (state.appliedVariant && state.appliedVariant !== variant.name) {
    process.stdout.write(`(pre-apply: reinstalling Claude Code ${det.version} to clear ${state.appliedVariant})\n`);
    const r = reinstallClaudeCode(det.version);
    if (!r.ok) {
      process.stderr.write(`pre-apply reinstall failed (${r.code}): ${r.command}\n`);
      if (r.stderr) process.stderr.write(r.stderr + "\n");
      process.exit(1);
    }
  }

  const result = applyVariantToFile(det.cliJs, variant);
  const verdict = verifyCliJs(det.cliJs);

  if (!verdict.ok) {
    process.stderr.write(`verify failed: node cli.js --version exited ${verdict.code}\n`);
    if (verdict.stderr) process.stderr.write(verdict.stderr + "\n");
    process.stderr.write(`reinstalling Claude Code ${det.version} to recover...\n`);
    const r = reinstallClaudeCode(det.version);
    if (!r.ok) {
      process.stderr.write(`recovery reinstall failed (${r.code}): ${r.command}\n`);
      if (r.stderr) process.stderr.write(r.stderr + "\n");
    } else {
      process.stderr.write(`restored cli.js via ${r.command}\n`);
    }
    writeState({
      appliedVariant: null,
      appliedAt: null,
      claudeCodeVersion: det.version,
    });
    process.exit(1);
  }

  writeState({
    appliedVariant: variant.name,
    appliedAt: new Date().toISOString(),
    claudeCodeVersion: det.version,
  });

  process.stdout.write(
    `applied ${variant.name}: +${result.applied} replaced, ${result.alreadyApplied} already, ${result.skipped} not found\n`,
  );
  process.stdout.write(`verified: ${verdict.stdout.trim()}\n`);

  if (result.skipped) {
    for (const r of result.reports) {
      if (r.outcome === "notFound") {
        process.stdout.write(`  [not found] ${r.mod.promptName} [piece ${r.mod.pieceIndex}]\n`);
      }
    }
  }
}

async function cmdStage(rest: string[]): Promise<void> {
  let version = rest[0];
  if (!version) {
    const latest = await getLatestTweakccVersion().catch(() => null);
    if (latest) {
      version = latest;
    } else {
      const det = detectClaudeCode();
      version = det.version;
      process.stderr.write(
        `warning: could not reach tweakcc; falling back to installed Claude Code version ${version}\n`,
      );
    }
  }

  try {
    await getPromptSet(version);
  } catch (err) {
    if (err instanceof TweakccNotFoundError) {
      process.stderr.write(err.message + "\n");
      process.exit(1);
    }
    throw err;
  }

  const catalogPath = cachedPromptSetPath(version);
  const path = stagedPath(version);
  const alreadyStaged = hasStaged(version);

  process.stdout.write(
    JSON.stringify(
      { version, catalogPath, stagedPath: path, alreadyStaged },
      null,
      2,
    ) + "\n",
  );
}

async function cmdReinstall(): Promise<void> {
  const det = detectClaudeCode();
  process.stdout.write(`reinstalling Claude Code ${det.version}...\n`);
  const r = reinstallClaudeCode(det.version);
  if (!r.ok) {
    process.stderr.write(`reinstall failed (${r.code}): ${r.command}\n`);
    if (r.stderr) process.stderr.write(r.stderr + "\n");
    process.exit(1);
  }
  if (r.stdout.trim()) process.stdout.write(r.stdout);

  const after = detectClaudeCode();
  const verdict = verifyCliJs(after.cliJs);
  if (!verdict.ok) {
    process.stderr.write(`warning: reinstalled cli.js failed --version check (${verdict.code}): ${verdict.stderr}\n`);
  } else {
    process.stdout.write(`verified: ${verdict.stdout.trim()}\n`);
  }

  writeState({
    appliedVariant: null,
    appliedAt: null,
    claudeCodeVersion: after.version,
  });
  process.stdout.write(`Claude Code ${after.version} is now pristine (${after.cliJs})\n`);
}

function cmdList(): void {
  const state = readState();
  const variants = listVariants();
  if (variants.length === 0) {
    process.stdout.write("(no variants yet — use the ditto skill)\n");
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
  process.stdout.write(`ditto home: ${DITTO_HOME}\n`);
}

async function readStdinAll(): Promise<string> {
  let data = "";
  for await (const chunk of process.stdin) {
    data += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
  }
  return data;
}

void main();
