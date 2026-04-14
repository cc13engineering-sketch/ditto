# Changelog — ditto CLI

## 2026-04-14

- **Add `ditto stage` to pre-filter harness-critical prompts per CC version**
  (session — per user plan). The tweakcc catalog ships ~280 prompts per
  Claude Code version, but variant authoring should only touch the minority
  that shape tone/style/philosophy. `ditto stage [version]` now prepares a
  per-version whitelist at `staged/prompts-{version}.json`; the ditto skill
  runs the classification (keep/prune/grey, with walkthrough for grey) and
  writes the file. New files: `src/stage.ts` (I/O helpers), `src/types.ts`
  `StagedPromptSet`, `STAGED_DIR` in `src/paths.ts`, and `cmdStage` in
  `src/cli.ts`. Enforcement: `ditto apply <variant>` and `ditto prompts`
  hard-error when the staged file is missing for the current CC version;
  `ditto check` reports `staged: yes (N kept)` or `no (run: ditto stage)`.
  Pre-committed `staged/prompts-2.1.104.json` (73 kept of 280) so fresh
  installs can `ditto apply smart` without staging first. `patch.ts` is
  untouched — existing variants keep applying regardless of the staged
  set, enforcement is authoring-time only. Help text and README Commands
  table updated.
- **Remove laptop-path references** (session — per user). The repo ships to
  other machines; it shouldn't reference the original author's filesystem.
  Dropped the `PATCHER_LOCAL_PROMPTS_DIR` constant from `src/paths.ts` and the
  offline-seed fallback branch (plus its unused `silent?` option and
  `copyFileSync` import) from `src/fetch.ts`. Scrubbed `~/DIY/AI/patcher/`
  pointers from `CONTRIBUTORS.md`. Historical entries in this changelog
  preserved as record.

## 2026-04-13

- **Add `INSTALL.md` + `install.sh` for one-liner curl install** (session —
  per user plan). `curl -fsSL .../install.sh | bash` now clones (or
  `git pull --ff-only`s) `~/.ditto`, rsyncs `skill/` to
  `~/.claude/skills/ditto/`, and idempotently appends `~/.ditto/bin` to
  `PATH` via the user's shell rc (zsh / bash / fish / profile detected
  from `$SHELL`). Prereq-aborts (no auto-install) on missing `git`,
  `bun`, or `rsync` — per user decision. Honors `DITTO_HOME`. Re-running
  the same command is the update path. `README.md` gets a one-line
  pointer to `INSTALL.md` near the top so the README doesn't go stale
  about setup. No changes under `src/`.
- **Skill redesign: batched lazy walkthrough** (session — per user plan;
  skill-only, no CLI changes). `skill/SKILL.md` now drives a 3-phase flow
  (Intake / Batched Walkthrough / Finalize) with 10-suggestion batches, a
  4-way Accept/Skip/Tweak/Submit-all-and-finish choice on every prompt, a
  tweak-refinement inner loop, and cross-batch `tweakSignals` that shape
  ranking and rewrite style. Also renamed
  `skill/reference/patcher-philosophy.md` → `editing-philosophy.md` and
  scrubbed its pointer at the author's laptop, so the reference ships
  cleanly with the repo. Existing CLI subcommands (`save --stdin`, `diff`,
  `apply`, `prompts --json`, `show`, `check`, `reinstall`) already covered
  everything; nothing under `src/` changed.
- **Remove `bootstrap-smart`** (session — per user's implementation plan).
  Removed the `bootstrap-smart` subcommand and the first-run auto-seed in
  `ditto check`. The patcher shell script at
  `~/DIY/AI/patcher/patch-claude-code.sh` is no longer the source of truth
  for the `smart` variant — `variants/smart.json` ships as a committed
  default. Deleted `src/bootstrap.ts` and the `PATCHER_SCRIPT` path
  constant; `PATCHER_LOCAL_PROMPTS_DIR` stays (used independently by
  `fetch.ts` as the offline prompt-cache fallback).
- **Fix TS types** (session — user-reported error).
  - Replaced deprecated `bun-types` with `@types/bun@^1.3.12` in
    devDependencies; updated `tsconfig.json` `types` array from
    `"bun-types"` → `"bun"`. `bunx tsc --noEmit` now clean.
- **Initial version** (session — per user's implementation plan).
  - Bun + TypeScript, zero runtime deps.
  - Subcommands: `check`, `prompts`, `show`, `save`, `diff`, `apply`, `restore`,
    `list`, `status`, `bootstrap-smart`, `help`.
  - Variant JSON schema: `{name, directive, created, claudeCodeVersion,
    tweakccVersion, modifications[], skipped?}`.
  - Apply flow: backup → split/join string replace → `node cli.js --version`
    verify → restore on failure.
  - Bootstrap seed parses `~/DIY/AI/patcher/patch-claude-code.sh` into a
    `smart` variant (10/13 patches match on 2.1.104; 3 Opus-only drift into
    `skipped[]`).
  - Cache falls back to `~/DIY/AI/patcher/prompts-{version}.json` if present,
    then fetches from tweakcc on GitHub raw.
  - Round-trip verified on 2.1.105 cli.js: save → diff → apply → verify →
    restore, with state.json tracking applied variant + last backup.
