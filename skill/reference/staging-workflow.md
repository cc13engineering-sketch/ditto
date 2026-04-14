# Staging workflow — pre-filter tweakcc prompts per Claude Code version

The tweakcc catalog ships ~280 prompts. Most are critical to the Claude Code
harness (tool schemas, security rails, agent-loop plumbing) — rewriting them
breaks Claude Code. Only a minority (tone, style, coding philosophy,
communication conventions) are safe targets for directive-driven variants.

**Staging** is the classification pass that produces a per-version whitelist
of safe-to-modify prompts at `staged/prompts-{cc-version}.json`. Variant
authoring reads from this whitelist rather than re-classifying every session.

Run this flow when the user asks to stage ditto for a version — phrases like
`"stage ditto"`, `"ditto stage"`, `"stage prompts for <version>"`,
`"re-stage after a tweakcc update"`.

## Classification rubric

For each prompt in the catalog, decide one of: **keep** / **prune** / **grey**.

### Keep — safe to rewrite

The prompt shapes *how* Claude communicates, reasons, or approaches code —
rewriting it shifts tone/style/philosophy but doesn't break the harness.

- Tone and style ("be concise", "use markdown", end-of-turn summary shape).
- Coding philosophy (gold-plating, premature abstractions, error handling
  defaults, comment conventions, test-driven work habits).
- Planning / exploratory question conventions ("respond in 2-3 sentences",
  "propose before implementing").
- Subagent narrative style (how Explore, Plan, general-purpose agents phrase
  their reports).
- User-facing persona and voice (not identity — see grey).

### Prune — must not be rewritten

The prompt is load-bearing for the Claude Code harness itself. Modifying it
breaks tool calls, bypasses safety checks, or scrambles agent-loop plumbing.

- **Tool schemas and invocation rules** — argument shapes, required fields,
  "use this tool when X" guidance that maps user intent to tools.
- **Security rails** — prompt-injection warnings, secret handling, refusal
  policies, credential guardrails, sandbox instructions.
- **Git safety protocol** — force-push warnings, hook bypass rules, commit
  authorization, destructive-command confirmation.
- **Exit-plan-mode / plan-mode machinery** — the control-flow prompts that
  gate plan approval and mode transitions.
- **Agent-loop plumbing** — subagent dispatch conventions, context-window
  management, compaction instructions, session bookkeeping.
- **File-editing protocol** — Read-before-Edit, line-number format rules,
  Write vs Edit tool selection.
- **Platform / environment metadata** — OS detection, CWD injection,
  knowledge-cutoff strings.

### Grey — ask the user

Anything that could plausibly be either. Examples:

- Prompts that mix tone guidance with a behavioral rule.
- Agent descriptions where rewriting could shift both persona and task
  routing.
- Identity / model-family statements (usually prune, but directive-driven
  persona work sometimes wants them).
- "Executing actions with care" style prompts — safety-adjacent but also
  tone/philosophy.
- Hook descriptions, slash-command metadata, skill-loading rules — usually
  prune, but edge cases exist.

When in doubt, grey it and let the user decide.

## Stage-mode flow

1. **Invoke the CLI.**

   ```bash
   ~/.ditto/bin/ditto stage [version]
   ```

   Parse the JSON from stdout:

   ```json
   {
     "version": "2.1.107",
     "catalogPath": "/Users/.../cache/prompts/prompts-2.1.107.json",
     "stagedPath": "/Users/.../staged/prompts-2.1.107.json",
     "alreadyStaged": false
   }
   ```

2. **Read the catalog.** `Read` the file at `catalogPath`. It's a
   `TweakccPromptSet`: `{version, prompts: [{id, name, description, pieces,
   ...}]}`.

3. **Classify each prompt.** Apply the rubric above to every prompt. Build
   three in-memory lists: `keep`, `prune`, `grey`.

4. **Walk grey prompts one at a time.** For each grey prompt, issue one
   `AskUserQuestion`:

   - Question: `Stage "{promptName}" — keep, prune, or stop?`
   - Draft a short 2–3 sentence summary in the assistant message BEFORE the
     question: what the prompt does in Claude Code, why it's ambiguous
     (tone vs. harness), and the risk of each choice.
   - Options (exact order, always three):
     1. `Keep` — "Mark as safe to modify. Variant authoring may rewrite it."
     2. `Prune` — "Mark as harness-critical. Hide from variant authoring."
     3. `Stop and save` — "Stop asking. Save the staged set with everything
        decided so far (remaining grey prompts default to prune)."

   Apply the answer, then continue to the next grey prompt. If the user
   picks `Stop and save`, bucket remaining greys as prune and break out of
   the loop.

5. **Write the staged file.** Assemble the `StagedPromptSet` and write it
   via `Write` to `stagedPath`:

   ```json
   {
     "claudeCodeVersion": "<catalog.version>",
     "tweakccVersion": "<catalog.version>",
     "stagedAt": "<ISO timestamp>",
     "kept": [
       { "id": "<promptId>", "reason": "<one-line rationale>" }
     ]
   }
   ```

   `kept` contains every prompt classified as `keep` plus every grey prompt
   the user answered `Keep`. Nothing else. Pruned/defaulted prompts are
   implicit by absence.

6. **Print summary.** One line: `staged N kept for CC <version> → <path>`.

## Re-staging

Re-running `ditto stage` on the same version is safe. The CLI reports
`alreadyStaged: true` but the skill should still walk (or re-walk) grey
prompts if the user wants to reclassify. A fresh `Write` to `stagedPath`
overwrites the previous set — no merge semantics, no backup.

## What the staged file affects

- `ditto prompts` filters the catalog to `kept` IDs — the skill's Phase-1
  feed is the kept subset, not all 280.
- `ditto apply <variant>` hard-errors if no staged file exists for the
  current Claude Code version.
- `ditto check` reports `staged: yes (N kept)` or `staged: no (run: ditto
  stage)`.

What the staged file does NOT affect:

- `ditto show <id>` — still works for any catalog prompt.
- `patch.ts` string replacement — applies variants literally regardless of
  the staged set. Old variants stay applyable even if they reference
  now-pruned IDs.
