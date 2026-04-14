---
name: ditto
description: >-
  Create a named custom variant of the user's installed Claude Code by
  modifying a small, user-chosen number of system prompts to fulfill a
  natural-language directive ("trust me more", "be more concise", "push
  back harder"). Trigger on phrases like "make claude", "ditto claude",
  "create a ditto version", "customize claude to", "make a claude that".
allowed-tools: >-
  Bash(~/.ditto/bin/ditto *) Bash(bun *) Read Write AskUserQuestion
model: opus
---

# ditto — author a Claude Code prompt variant

You are helping the user author a **named variant** of their installed Claude
Code by surgically rewriting system prompts to match a natural-language
**directive**. Work in three phases: **Intake → Batched Walkthrough → Finalize**.
Never edit `cli.js` yourself — build the variant JSON and pipe it through
`ditto save` + `ditto apply`.

## Phase 0 — Mode detection

Before anything else, check whether the invocation is a **stage** request
(classify prompts for a Claude Code version) rather than a variant-authoring
request. Stage-mode triggers on phrases like:

- `"stage ditto"`, `"ditto stage"`, `"stage prompts"`, `"re-stage"`
- `"stage ditto for 2.1.107"`, `"stage ditto for the current version"`
- `"classify prompts"`, `"refresh the staged whitelist"`

If the invocation matches, read `~/.claude/skills/ditto/reference/staging-workflow.md`
and follow the stage-mode flow there. Do NOT continue into Phase 1.

Otherwise (the invocation is a directive like "make claude X" / "customize
claude to Y"), proceed to Phase 1 — Intake.

## Phase 1 — Intake

```
1. Precheck:   ~/.ditto/bin/ditto check   (non-zero → print stdout+stderr, stop)
                 If the output ends with "staged: no  (run: ditto stage)", tell
                 the user the staged whitelist is missing and suggest they run
                 the skill with "stage ditto" first. Stop — do not author.
2. Directive:  extract from the invocation. If ambiguous, ONE AskUserQuestion:
                 "What should this variant emphasize?"  (single "Other" free-text)
3. Catalog:    ~/.ditto/bin/ditto prompts --json
                 → catalog = {version, prompts: [{id,name,description,pieceCount}]}
                 This feed is already filtered to the staged whitelist — treat
                 it as the full universe for ranking. If the command errors
                 with "No staged prompt set", surface the error and suggest
                 staging first.
4. Philosophy: read ~/.claude/skills/ditto/reference/editing-philosophy.md once.
```

No upfront max-prompts question — batches are generated lazily in Phase 2.

## Phase 2 — Batched walkthrough loop

**In-skill state (no disk persistence):**

```
accepted:     VariantModification[]       // push on Accept only
skipped:      Set<promptId>               // blacklisted — never re-propose
seen:         Set<promptId>               // already walked
tweakHistory: Array<{promptId, originalRewrite, userTweak, finalAccepted}>
tweakSignals: { lengthBias: "shorter"|"longer"|"neutral",
                toneNotes: string[], structureNotes: string[] }  // ≤5 items total
batchIndex: 0,  batchSize: 10
```

### Main loop

```
while true:
  remaining = catalog.prompts.filter(p => !skipped.has(p.id) && !seen.has(p.id))
  if remaining.empty: tell user "catalog exhausted"; break

  batch = rankBatch(remaining, directive, tweakSignals, 10)
  if batch.empty: offer Claude-initiated finish; break

  for prompt in batch:
    seen.add(prompt.id)
    result = walkthroughOne(prompt, tweakSignals)
    if result == FINISH: goto Phase 3

  batchIndex += 1
  updateTweakSignals(tweakHistory)
```

### `rankBatch` — in-skill reasoning, no tool call

Score each remaining prompt by **behavioral** impact on the directive using
editing-philosophy heuristics (rules→judgment, rigid→softer, numeric→qualitative,
gate→relax). Condition scoring on `tweakSignals`: `lengthBias=="shorter"`
down-weights prompts whose only leverage is *adding* framing and up-weights
prompts where tightening wins; `toneNotes` / `structureNotes` tilt scoring
toward prompts where those same adjustments unlock the directive.

Take the top 10 (or fewer if `remaining.length < 10`). If nothing clears a
"would meaningfully shift behavior" bar, return an empty batch — that triggers
the Claude-initiated finish below.

### `walkthroughOne(prompt, signals)`

1. `~/.ditto/bin/ditto show <promptId>` → annotated text + piece boundaries.
2. Draft in the assistant message *before* the AskUserQuestion:
   - 2–3 sentence summary of what the prompt does in Claude Code.
   - Chosen `pieceIndex`, exact `originalText` (verified substring of that
     piece), proposed `newText`, one-sentence `rationale`.
   - Style the rewrite using `tweakSignals` — tighter when
     `lengthBias=="shorter"`, softer modals when tone notes call for it,
     preserve bullets/headers when structure notes call for it.
3. **Outer AskUserQuestion — 4 options, exact order:**

   question: `Accept this rewrite for {promptName}?`

   1. `Accept` — "Record the edit as-is and move to the next prompt."
      → push to `accepted`; return.
   2. `Skip` — "Don't change this prompt — and don't suggest any other edits to it."
      → `skipped.add(promptId)`; return.
   3. `Tweak` *(free-text via Other)* — "Provide replacement text; I'll refine it into a polished edit before you confirm."
      → treat Other free-text as the raw replacement; enter inner tweak loop.
   4. `Submit all and finish` — "Stop here. Save everything accepted so far, preview the diff, and offer to apply."
      → return `FINISH`.

4. **Inner tweak loop** (entered on Tweak) — polish the user's raw replacement
   into a refined edit:
   - Clean up grammar / consistency with surrounding piece text.
   - Re-verify `originalText` still appears in the piece (adjust boundaries if
     the tweak shifts them).
   - Update `rationale` to reflect the tweak's direction.
   - Show: current `originalText`, previous `newText` (for reference), new
     refined `newText`, updated `rationale`.

   Then **Inner AskUserQuestion — same 4-option shape, always:**

   question: `Accept the refined rewrite?`

   1. `Accept` — "Record this refined edit and move on."
      → push refined edit to `accepted`; append
      `{promptId, originalRewrite, userTweak, finalAccepted}` to `tweakHistory`;
      return.
   2. `Skip` — "Drop this prompt entirely; don't suggest other edits to it."
      → `skipped.add(promptId)`; do NOT record the in-progress edit; return.
   3. `Tweak again` *(free-text)* — "Provide different replacement text; I'll refine it again."
      → loop (no bound).
   4. `Submit all and finish` — "Stop now. Discard this in-progress edit. Save everything previously accepted."
      → discard in-progress edit (no write to `accepted` or `tweakHistory`);
      return `FINISH`.

### `updateTweakSignals(tweakHistory)` — between batches

- **lengthBias:** median ratio `len(finalAccepted.newText) / len(originalRewrite.newText)`
  across `tweakHistory`. `<0.85` → `shorter`; `>1.15` → `longer`; else `neutral`.
- **toneNotes** / **structureNotes:** short observations (≤5 items total) you
  write during reasoning — e.g. "user softens 'always' → 'default to'",
  "preserves bullet structure". In-skill state only; no disk persistence.

### Claude-initiated finish

When `rankBatch` returns empty, AskUserQuestion:

question: `I don't see more edits that would meaningfully move Claude toward "{directive}". Finish up?`

1. `Finish and save` — Save accepted edits, show the diff, and offer to apply.
2. `Show me what's left anyway` — Force one more batch of up to 10 regardless
   of impact estimate, then re-evaluate.
3. `Submit all and finish` — Same as Finish and save. (kept for consistency)

## Phase 3 — Finalize

1. **Name the variant.** Suggest `slug = slugify(directive)` matching
   `/^[a-z0-9][a-z0-9-_]{0,63}$/`. AskUserQuestion:
   - question: `Name this variant?`
   - options: `Use "<slug>"` / `Other` (free-text).

2. **Empty-accepted guard.** If `accepted.length === 0`, tell the user there's
   nothing to save; skip save/diff/apply; exit.

3. **Assemble variant JSON** in memory:
   ```json
   {
     "name": "<slug>",
     "directive": "<directive>",
     "created": "<ISO timestamp>",
     "claudeCodeVersion": "<catalog.version>",
     "tweakccVersion": "<catalog.version>",
     "modifications": [ /* from accepted */ ]
   }
   ```
   Each entry in `modifications` must match `VariantModification`:
   `{promptId, promptName, pieceIndex, originalText, newText, rationale}`.

4. **Save via heredoc:**
   ```bash
   cat <<'JSON' | ~/.ditto/bin/ditto save <slug> --stdin
   <the JSON>
   JSON
   ```

5. **Preview:** `~/.ditto/bin/ditto diff <slug>` — print output verbatim.

6. **Apply gate.** AskUserQuestion: `Apply <slug> now?` → `Apply now` / `Not yet`.
   - `Apply now` → `~/.ditto/bin/ditto apply <slug>`; report one-line result.
   - `Not yet` → print exact commands for later:
     - apply:           `~/.ditto/bin/ditto apply <slug>`
     - restore pristine: `~/.ditto/bin/ditto reinstall`

## Shipped variant: `smart`

ditto ships with `variants/smart.json` as a committed default — the original
13 opinions (quality > speed, judgment > rules). If a user's directive is
"just give me the shipped defaults", skip this authoring flow entirely and
suggest `~/.ditto/bin/ditto apply smart`.

## Error handling

- If any `ditto` command exits non-zero, stop and report stdout+stderr as-is.
- Never edit `cli.js` directly; never guess around a failing verify — the CLI
  auto-reinstalls on verify failure.
- If a proposed `originalText` isn't a substring of the shown piece, recheck
  against the `ditto show` output before sending to `ditto save`. A `NOT FOUND`
  report from `ditto diff` means your `originalText` doesn't match cli.js
  literally.
