# ditto

A library of Claude Code personalities, authored by talking to Claude.

Say *"make claude push back harder"* inside Claude Code — a skill walks
you through surgically rewriting the handful of system prompts that
matter and saves the result as a named variant you can apply, swap,
and reset.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/cc13engineering-sketch/ditto/main/install.sh | bash
```

Installs the CLI to `~/.ditto/` and the authoring skill to
`~/.claude/skills/ditto/`. See [INSTALL.md](INSTALL.md) for
prerequisites, manual install, updating, and uninstall.

## Author a variant — inside Claude Code

Just talk to Claude. The skill triggers on phrases like:

- *"make claude trust me more"*
- *"ditto claude to stop narrating every step"*
- *"customize claude to push back harder"*

What happens:

1. **Intake.** Confirms your installed Claude Code matches a published
   [tweakcc](https://github.com/Piebald-AI/tweakcc) prompt catalog and
   reads your directive.
2. **Batched walkthrough.** Ranks candidate prompts by impact and
   walks you through them 10 at a time. For each one it proposes a
   surgical rewrite; you **Accept** / **Skip** / **Tweak** (you
   supply replacement text, the skill polishes) / **Submit all and
   finish**. Later batches adapt to your tweak patterns.
3. **Finalize.** Saves to `variants/<name>.json`, previews the diff,
   applies on confirm.

The skill does the authoring intelligence; the CLI does the side
effects. Nothing ever hand-edits `cli.js`.

## Operate — from the shell

```
ditto apply <name>    # swap to a variant
ditto list            # see your library
ditto status          # what's installed, what's applied
ditto reinstall       # back to pristine (npm reinstalls current CC)
```

Every apply self-verifies; if it fails, `reinstall` is the universal
escape hatch. Run `ditto --help` for the full command list.

## Shipped variants

`variants/` ships a few pre-authored variants:

- **`smart`** — quality > speed, judgment > rules, pragmatic fixes >
  narrow scope. A port of [roman01la's
  gist](https://gist.github.com/roman01la/483d1db15043018096ac3babf5688881).
- **`disagreeable`** — licenses pushback over deference.

**Variants are version-pinned.** Every variant records the Claude
Code version it was authored against. CC's prompt strings drift
between releases, so a shipped variant may not line up with your
installed version. Run `ditto diff <name>` first — if the diff is
empty or partial, re-author via the skill.

## Staging — the safe-to-modify whitelist

The tweakcc catalog has ~280 prompts per CC version, but most are
load-bearing (tool schemas, security rails, plan-mode, git safety).
Authoring should only touch the minority that shape tone, style, and
coding philosophy.

`staged/prompts-{version}.json` is that per-version whitelist. This
repo ships staged sets for the CC versions it was cut against; when
you upgrade to a version with no shipped set, invoke the skill with
*"stage ditto for the current version"* to build one. Existing
variants keep applying regardless — staging is authoring-time only.

---

Built on [tweakcc](https://github.com/Piebald-AI/tweakcc) (safe
patching of CC's system prompts) and
[roman01la's gist](https://gist.github.com/roman01la/483d1db15043018096ac3babf5688881)
(proof that targeted rewrites reshape CC's behavior).
