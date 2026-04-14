# Changelog — ditto skill

## 2026-04-14

- **Rename `reference/patcher-philosophy.md` → `reference/editing-philosophy.md`**
  (session — per user). The skill ships as part of the repo and shouldn't
  reference files on the author's laptop. Renamed the file, scrubbed the
  opening paragraph's pointer to `~/DIY/AI/patcher/patch-claude-code.sh`
  (now points at the repo's shipped `variants/smart.json` instead), and
  updated all cross-references in SKILL.md, CONTRIBUTORS.md, and this file.

## 2026-04-13

- **Batched lazy walkthrough with 4-way per-suggestion choice** (session —
  per user plan). Rewrote the body from 11 numbered prose steps into three
  algorithmic phases (Intake / Batched Walkthrough / Finalize). Removed the
  upfront "max number of prompts" question; batches of 10 are now ranked
  lazily on demand. Every per-suggestion AskUserQuestion — outer loop and
  inner tweak loop — offers the same 4 options: Accept / Skip / Tweak /
  Submit all and finish. Skip blacklists the `promptId` so no future batch
  re-proposes an edit to it. Tweak takes free-text, Claude polishes it, and
  the inner loop repeats until Accept or Skip. Between batches, skill-side
  `tweakSignals` (lengthBias, toneNotes, structureNotes) feed forward into
  ranking and rewrite style so subsequent batches get shorter and better.
  Added a Claude-initiated finish for when ranking runs out of meaningful
  edits, with a "show me what's left anyway" escape hatch. Preserved
  frontmatter, shipped-`smart` sidebar, and error-handling section.
- **Moved skill source into `~/.ditto/skill/`** (session — per user plan to
  give `~/.ditto` a single source of truth for both CLI and skill).
  Installed copy at `~/.claude/skills/ditto/` is now synced via
  `npm run update-skill`, mirroring the `~/.lofi` pattern.
- **Reframe `smart` as shipped default** (session — follows CLI's
  `bootstrap-smart` removal). Updated the precheck step to drop the
  "if you see `seeded variants/smart.json`" branch and instead note that
  `smart` is a built-in variant available via `ditto apply smart`. Reworded
  the notes-section shortcut ("just give me the shipped defaults") to point
  at the committed `smart` variant rather than a bootstrap-generated one.
- **Initial version.** (session — per user's implementation plan for `ditto`
  as a CLI tool + skill.) Interactive authoring flow covering precheck,
  directive extraction, max-prompts gate, catalog load, impact ranking,
  per-prompt walkthrough, overflow gate, variant naming, save, diff preview,
  and apply. References `~/.claude/skills/ditto/reference/editing-philosophy.md`
  for directive-to-edit worked examples.
