# Changelog — ditto CLI

## 2026-04-13

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
