# Changelog — ditto skill

## 2026-04-13

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
  and apply. References `~/.claude/skills/ditto/reference/patcher-philosophy.md`
  for directive-to-edit worked examples.
