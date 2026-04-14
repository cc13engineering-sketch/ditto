# ditto

A library of Claude Code personalities.

Give it a directive. Get a named variant you can apply, swap, and reset.

```
ditto apply smart            # shipped default: quality > speed, judgment > rules
ditto apply trust-me-more    # one you authored via the skill
ditto reinstall              # back to pristine (npm reinstalls current version)
```

ditto ships with a `smart` variant already committed in `variants/` —
`ditto apply smart` to try it without authoring anything.

## The idea

**[tweakcc](https://github.com/Piebald-AI/tweakcc)** — a safe way to patch
Claude Code's system prompts (versioned prompt catalog + patcher for the
minified `cli.js`).

**[roman01la's gist](https://gist.github.com/roman01la/483d1db15043018096ac3babf5688881)**
— a handful of targeted prompt rewrites can meaningfully reshape Claude
Code's behavior (his example: make it less shortcut-happy, more thorough).

**ditto** is those two glued together and generalized. You describe the
behavior you want in plain English ("trust me more", "push back harder");
a skill inside Claude Code picks the highest-impact prompts from tweakcc's
catalog and drafts surgical rewrites; the patcher applies them as a named
variant you can apply, swap, and reset.

The shipped `smart` variant **is** roman01la's gist, ported into ditto's
format with a couple of tweaks — some of the original prompt strings have
drifted in Claude Code releases since the gist was posted, so the rewrites
had to be re-aimed at the current catalog.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/cc13engineering-sketch/ditto/main/install.sh | bash
```

See [INSTALL.md](INSTALL.md) for prerequisites, manual install, updating, and uninstall.

## How it works

**You author variants from inside Claude Code.** ditto ships a Claude Code
skill (installed to `~/.claude/skills/ditto/`) that's triggered by phrases
like:

- "make claude push back harder"
- "ditto claude to stop narrating every step"
- "customize claude to trust me more"

The skill runs a three-phase flow:

1. **Intake.** Runs `ditto check` to confirm your installed Claude Code
   matches a published [tweakcc](https://github.com/Piebald-AI/tweakcc)
   prompt catalog, extracts your directive, and loads the prompt list.

2. **Batched walkthrough.** Ranks candidate prompts by impact on your
   directive and walks you through them 10 at a time. For each, it
   proposes a surgical rewrite and offers four choices:
   **Accept** / **Skip** (blacklist this prompt) / **Tweak** (you supply
   replacement text, the skill polishes it) / **Submit all and finish**.
   Later batches adapt to your tweak patterns — if you consistently
   shorten rewrites, subsequent suggestions come in tighter.

3. **Finalize.** Saves your accepted edits as a named variant JSON,
   previews the diff, and offers to apply.

**Clean split of responsibility:** the skill does the authoring
intelligence and the human conversation; the CLI (`~/.ditto/bin/ditto`)
does all the side effects — detect, fetch, patch, verify, reinstall,
state. The skill shells out to `ditto save`, `ditto diff`, and
`ditto apply`; nothing ever hand-edits `cli.js`.

You can also drive the CLI directly — `ditto apply smart`,
`ditto list`, `ditto reinstall` — without invoking the skill at all.
Use the skill when you're authoring; use the CLI when you're operating.

## Commands

| | |
|---|---|
| `ditto check`            | detect + precheck |
| `ditto prompts`          | list the installed version's prompts |
| `ditto show <id>`        | print one full prompt |
| `ditto save <name>`      | save a variant (from `--stdin` or `--file`) |
| `ditto diff <name>`      | preview what a variant would change |
| `ditto apply <name>`     | apply it (with verify + auto-recover) |
| `ditto stage [version]`  | prepare the per-version safe-to-modify prompt whitelist |
| `ditto reinstall`        | npm reinstall current version to return to pristine |
| `ditto list`             | see your variants |
| `ditto status`           | what's installed, what's applied |

## Staging

The tweakcc catalog ships ~280 prompts per Claude Code version, but most of
them are load-bearing for the harness — tool schemas, security rails,
plan-mode machinery, git safety. Variant authoring should only touch the
minority that shape tone, style, and coding philosophy.

`ditto stage [version]` prepares a per-version whitelist at
`staged/prompts-{version}.json`. The ditto skill runs the classification
(keep / prune / grey, with a walkthrough for grey cases) and writes the
file; `ditto apply` and the skill's prompts feed hard-error if the staged
file is missing for the current Claude Code version.

ditto ships `staged/prompts-2.1.104.json` pre-committed, so fresh installs
can `ditto apply smart` without running the skill first. When you upgrade
Claude Code to a version with no pre-shipped staged set, invoke the skill
with `"stage ditto for the current version"` to build one.

Existing variants keep applying regardless of the staged set —
enforcement is authoring-time only.

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
├── staged/            # per-version safe-to-modify whitelists
├── cache/prompts/     # tweakcc prompts-{version}.json
└── state.json         # which variant is applied

~/.claude/skills/ditto/  # the authoring skill (installed by install.sh)
```

## Requirements

Bun (`#!/usr/bin/env bun`), Node.js for the verify step, an
`npm install -g @anthropic-ai/claude-code` that matches a tweakcc version.

## Safety

Every apply runs `node cli.js --version` before trusting the result. A
failed verify auto-reinstalls the current version via npm. `ditto
reinstall` is the universal "get back to pristine" button — it just runs
`npm install -g @anthropic-ai/claude-code@<current-version>`. Manual edits
to `cli.js` that weren't saved as a variant are on you; reinstall will
blow them away.
