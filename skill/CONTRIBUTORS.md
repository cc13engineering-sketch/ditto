# Contributors — ditto skill

## Original author

- colinlaptop (the user), 2026-04-13.
- Implemented by Claude (Opus 4.6 session) from a detailed written plan.

## Purpose

Interactive authoring layer for the `ditto` CLI at `~/.ditto/bin/ditto`. The
CLI handles file plumbing (detect Claude Code, fetch tweakcc prompts,
backup/patch/verify/restore). This skill does the human-facing authoring:
take a natural-language directive, pick the N most relevant prompts to
modify, walk the user through surgical rewrites one at a time, save the
result as a reusable named variant, and apply.

## Key design decisions

- **Skill does authoring, CLI does plumbing.** The skill never touches `cli.js`
  directly and never writes variant JSON to disk itself — it pipes JSON
  through `ditto save --stdin`. All backup/verify/restore logic lives in the
  CLI so it's testable without running a Claude Code session.
- **Per-piece edits, not whole-prompt rewrites.** Variants record edits at
  `{promptId, pieceIndex, originalText, newText}` granularity. This keeps
  edits surgical and makes them likely to survive minor Claude Code updates
  that re-word surrounding pieces.
- **Reference doc is a philosophy primer, not a templater.** The 13 worked
  examples in `reference/editing-philosophy.md` teach Claude what a high-
  impact directive-aligned edit *feels* like (replace hard rules with
  judgment; tone down rigid negatives). They're not meant to be copy-pasted.
- **Strict-fail on version mismatch.** If tweakcc has no matching prompts
  file, the skill stops at the precheck and reports the exact CLI message
  (with downgrade suggestion). No silent approximation.
- **Shipped `smart` variant short-circuits the flow.** If the user just
  wants the default opinionated behavior, they can `ditto apply smart`
  without invoking the skill at all — `variants/smart.json` ships as a
  committed default in the ditto CLI repo. The skill should recognize this
  and suggest it rather than running a full authoring session.
