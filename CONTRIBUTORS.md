# Contributors — ditto CLI

## Original author

- colinlaptop (the user), 2026-04-13.
- Implemented by Claude (Opus 4.6 session) from a detailed written plan.

## Purpose

File plumbing for the companion skill at `~/.claude/skills/ditto/`. The skill
does the human-facing authoring; this CLI does all the side-effectful work:
detect the installed Claude Code, fetch/cache the matching tweakcc prompt
catalog, parse variant JSONs, diff / apply / verify / restore against
`cli.js` with timestamped backups, and track state.

## Key design decisions

- **Bun runtime, Node.js verify.** Ditto itself runs under Bun (`#!/usr/bin/env
  bun`). The verify step (`node cli.js --version`) shells out to Node because
  that's what end users actually run Claude Code under.
- **Per-piece granularity, not per-prompt.** Variants target
  `{promptId, pieceIndex, originalText, newText}` — a specific substring in a
  specific piece of a specific prompt. Makes edits survivable across minor
  Claude Code version drift.
- **Ported patcher's apply flow.** Reuses the proven split/join replacement,
  "already applied" idempotency check, and post-apply `--version` sanity check
  from `~/DIY/AI/patcher/patch-claude-code.sh`.
- **Fetch with cache + local fallback.** `getPromptSet(version)` checks
  `~/.ditto/cache/prompts/`, then `~/DIY/AI/patcher/prompts-{version}.json`,
  then fetches from tweakcc on GitHub raw. Cache survives offline use.
- **Strict-fail on version mismatch.** If tweakcc has no matching
  `prompts-{version}.json`, `ditto check` exits non-zero with an actionable
  message (latest tweakcc version + downgrade command). The skill relays this
  and stops.
- **`smart` ships as a committed default.** `variants/smart.json` is checked
  in as a shipped artifact — the patcher's original opinions (quality > speed,
  judgment > rules) mapped to `{promptId, pieceIndex}` edits for the pinned
  tweakcc version. Users get it for free via `ditto apply smart`; it evolves
  through the ditto skill or hand edits to the JSON, not by re-running a
  shell-script reverse-engineer step.

## Layout

- `bin/ditto` — `#!/usr/bin/env bun` shim to `src/cli.ts`.
- `src/` — one module per concern (detect, fetch, prompts, patch, variants,
  diff, verify, state, paths, types, cli).
- `variants/` — user's named variant JSONs (ships with `smart.json` as a
  committed default).
- `cache/prompts/` — cached `prompts-{version}.json` files.
- `backups/` — timestamped cli.js backups.
- `state.json` — tracks currently-applied variant + last backup path.
