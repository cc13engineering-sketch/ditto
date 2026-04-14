# ditto

A library of Claude Code personalities.

Give it a directive. Get a named variant you can apply, restore, and swap.

```
ditto apply smart            # shipped default: quality > speed, judgment > rules
ditto apply trust-me-more    # one you authored via the skill
ditto restore                # back to pristine
```

ditto ships with a `smart` variant already committed in `variants/` —
`ditto apply smart` to try it without authoring anything.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/cc13engineering-sketch/ditto/main/install.sh | bash
```

See [INSTALL.md](INSTALL.md) for prerequisites, manual install, updating, and uninstall.

## How it works

1. `ditto check` — confirms your installed Claude Code matches a published
   [tweakcc](https://github.com/Piebald-AI/tweakcc) prompt catalog.
2. The **ditto skill** (in Claude Code) walks you through authoring a variant:
   picks the highest-impact prompts for your directive, proposes surgical
   rewrites, saves a JSON.
3. `ditto apply <name>` — backup → patch → `node cli.js --version` verify →
   auto-restore on failure.

## Commands

| | |
|---|---|
| `ditto check`            | detect + precheck |
| `ditto prompts`          | list the installed version's prompts |
| `ditto show <id>`        | print one full prompt |
| `ditto save <name>`      | save a variant (from `--stdin` or `--file`) |
| `ditto diff <name>`      | preview what a variant would change |
| `ditto apply <name>`     | apply it (with verify + backup) |
| `ditto restore`          | roll back to the last backup |
| `ditto list`             | see your variants |
| `ditto status`           | what's installed, what's applied |

## Variant shape

```json
{
  "name": "trust-me-more",
  "directive": "trust me more",
  "claudeCodeVersion": "2.1.104",
  "tweakccVersion": "2.1.104",
  "modifications": [
    { "promptId": "...", "pieceIndex": 0,
      "originalText": "...", "newText": "...", "rationale": "..." }
  ]
}
```

## Layout

```
~/.ditto/
├── bin/ditto          # bun shim
├── src/               # TypeScript source (no build step)
├── variants/          # your library
├── backups/           # timestamped cli.js backups
├── cache/prompts/     # tweakcc prompts-{version}.json
└── state.json         # which variant is applied
```

## Requirements

Bun (`#!/usr/bin/env bun`), Node.js for the verify step, an
`npm install -g @anthropic-ai/claude-code` that matches a tweakcc version.

## Safety

Every apply backs up `cli.js` and runs `node cli.js --version` before
trusting the result. A failed verify auto-restores. `ditto restore` always
gets you back.
