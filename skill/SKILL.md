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
Code by surgically rewriting a small number of system prompts to match a
natural-language **directive**. The result is a reusable JSON file that the
`ditto` CLI can apply/restore/swap at will.

All file-touching is done through the CLI at `~/.ditto/bin/ditto`. You never
edit `cli.js` yourself — you build the variant JSON and pipe it through
`ditto save` + `ditto apply`.

## Step 1 — Precheck

Run:

```bash
~/.ditto/bin/ditto check
```

If the exit code is non-zero: **stop and report the exact message to the user**
(it contains actionable guidance: wait for tweakcc, or downgrade Claude Code to
a matching version). Do not proceed past this point.

Note: ditto ships with a built-in `smart` variant. The user can run
`~/.ditto/bin/ditto apply smart` any time for the default opinionated behavior
(quality > speed, judgment > rules) — but continue with their directive.

## Step 2 — Extract the directive

Pull the directive out of the user's invocation phrase. Examples:

- "make claude trust me more" → directive: `trust me more`
- "ditto a version that pushes back harder" → directive: `push back harder`
- "customize claude to be more concise" → directive: `be more concise`

If the phrase is ambiguous or missing, ask with `AskUserQuestion`:
"What should the new variant emphasize?" Keep it short — one sentence of intent.

## Step 3 — Ask for max prompts to change

Use `AskUserQuestion`:

> "What's the maximum number of prompts you want to change?"

If the user hedges or says something like "your call", default to **5**.
Parse the integer. This is the `max` for later steps.

## Step 4 — Load the catalog

```bash
~/.ditto/bin/ditto prompts --json
```

This returns `{version, prompts: [{id, name, description, pieceCount}, ...]}`.
Read it into working memory.

## Step 5 — Rank by impact

Read each prompt's `id` + `name` + `description`. Think about which prompts, if
modified, would actually change Claude Code's behavior in the direction of the
directive. Produce an ordered list `relevant[]` from most to least impactful.

**Selection rule**: if `relevant.length <= max`, use all. Otherwise, pick the
top `max` — by **impact on behavior**, not lexical match. For "trust me more",
that's prompts that gate risky actions / require confirmation / enforce
autonomy rules — not prompts about output formatting.

Before you start ranking, read
`~/.claude/skills/ditto/reference/patcher-philosophy.md` once. It contains 13
worked examples of directive-to-edit mapping from the original patcher. Use it
as a reference for what "impactful edit" actually looks like.

## Step 6 — Interactive walkthrough

For each of the top `max` selected prompts, in order:

1. `~/.ditto/bin/ditto show <prompt-id>` → prints the full reconstructed text,
   with piece boundaries marked and identifier placeholders (`${NAME}`) inline.

2. Tell the user, in 2–3 sentences, **what this prompt does in Claude Code** —
   your best inference from the text. Example:
   > "This gates risky/destructive actions (pushing, deleting, dropping
   > tables) behind explicit user confirmation. It's the main source of
   > Claude's 'ask before doing anything big' behavior."

3. Propose a concrete rewrite. Pick a **specific piece** (one entry in the
   `pieces[]` array) and quote the exact substring you'd replace (`originalText`)
   and the replacement (`newText`), plus a one-sentence `rationale` tied to the
   directive.

   Rules:
   - `originalText` must be a substring of a **single** piece (don't span
     placeholders).
   - Keep the rewrite minimal and surgical. Prefer tightening / relaxing /
     rebalancing over full rewrites.
   - Preserve any formatting the prompt relies on (hyphen bullets, headers).

4. Use `AskUserQuestion` to let the user: confirm, tweak the rewrite, or skip.
   If they tweak, adopt their version verbatim.

5. Record the accepted change as a `VariantModification`:
   ```json
   { "promptId": "...", "promptName": "...", "pieceIndex": N,
     "originalText": "...", "newText": "...", "rationale": "..." }
   ```

## Step 7 — Overflow gate

If `relevant.length > max` (you trimmed in step 5), tell the user:

> "There are N other prompts that might also shift behavior toward
> '<directive>': [short bulleted list of name — one-line why]. Modify any of
> these too?"

Use `AskUserQuestion`. If they pick some, loop Step 6 for each.

## Step 8 — Name the variant

Default name: slugify the directive (`"trust me more"` → `trust-me-more`).
Lowercase, dashes, no spaces, ≤64 chars. Offer it to the user via
`AskUserQuestion` ("Call it `<slug>`? Or something else?"); accept an override.

## Step 9 — Save

Build the variant JSON in memory:

```json
{
  "name": "<slug>",
  "directive": "<directive>",
  "created": "<ISO timestamp>",
  "claudeCodeVersion": "<version from step 4>",
  "tweakccVersion": "<version from step 4>",
  "modifications": [ /* from step 6 */ ]
}
```

Pipe via stdin:

```bash
echo '<the JSON>' | ~/.ditto/bin/ditto save <slug> --stdin
```

(Prefer a heredoc when the JSON is large, to avoid shell-escaping pain.)

## Step 10 — Preview

```bash
~/.ditto/bin/ditto diff <slug>
```

Show the output. Ask via `AskUserQuestion`: "Apply now?" Offer yes / no.

## Step 11 — Apply (if confirmed)

```bash
~/.ditto/bin/ditto apply <slug>
```

Report the result. If apply fails and auto-restores, relay that clearly.
If the user declined, remind them:

> "Run `~/.ditto/bin/ditto apply <slug>` when you're ready. Restore with
> `~/.ditto/bin/ditto restore`."

## Notes on the shipped variant `smart`

ditto ships with `variants/smart.json` as a committed default — the original
13 opinions (quality > speed, judgment > rules). If a user's directive is
"just give me the shipped defaults", skip this authoring flow entirely and
suggest `~/.ditto/bin/ditto apply smart`.

## Error handling

- If any `ditto` command exits non-zero, stop and report stdout+stderr as-is.
- Never edit `cli.js` directly; never guess around a failing verify — the CLI
  auto-restores on verify failure.
- If a proposed `originalText` isn't a substring of the shown piece, recheck
  against the `ditto show` output before sending to `ditto save`. A `NOT FOUND`
  report from `ditto diff` means your `originalText` doesn't match cli.js
  literally.
