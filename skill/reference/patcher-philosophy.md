# Patcher philosophy — worked examples of directive → edit

The original `~/DIY/AI/patcher/patch-claude-code.sh` encodes 13 edits under one
coherent directive: **quality > speed, judgment > rules, pragmatic adjacent
fixes > narrow scope**. Read this file when you need a mental model for
"what a high-impact, directive-aligned edit looks like."

Each entry below is (directive in one line) → (before) → (after) → (why it
matters for the directive).

---

## 1. Anti-gold-plating paragraph — "let me fix adjacent broken things"

**Before:** `Don't add features, refactor code, or make "improvements" beyond what was asked. A bug fix doesn't need surrounding code cleaned up. A simple feature doesn't need extra configurability. Don't add docstrings, comments, or type annotations to code you didn't change. Only add comments where the logic isn't self-evident.`

**After:** `Don't add unrelated features or speculative improvements. However, if adjacent code is broken, fragile, or directly contributes to the problem being solved, fix it as part of the task. A bug fix should address related issues discovered during investigation. Don't add docstrings, comments, or type annotations to code you didn't change. Only add comments where the logic isn't self-evident.`

**Why:** keeps the "no gold-plating" intent but carves out an explicit license to fix *related* fragility discovered during the task.

---

## 2. Skip error handling — "validate real boundaries"

**Before:** `Don't add error handling, fallbacks, or validation for scenarios that can't happen. Trust internal code and framework guarantees. Only validate at system boundaries (user input, external APIs). Don't use feature flags or backwards-compatibility shims when you can just change the code.`

**After:** `Add error handling and validation at real boundaries where failures can realistically occur (user input, external APIs, I/O, network). Trust internal code and framework guarantees for truly internal paths. Don't use feature flags or backwards-compatibility shims when you can just change the code.`

**Why:** flips the framing from "skip unless" to "add where realistic" — the sloppy model reading the first version under-validates; the second overcorrects it.

---

## 3. Three lines rule — "judgment over rule-of-thumb"

**Before:** `Three similar lines of code is better than a premature abstraction.`

**After:** `Use judgment about when to extract shared logic. Avoid premature abstractions for hypothetical reuse, but do extract when duplication causes real maintenance risk.`

**Why:** the model will literalize "three lines > abstraction" and leave real duplication pain in place. Replacing a rule with judgment is the core move of this directive.

---

## 4. Subagent gold-plate — "finish thoroughly"

**Before:** `Complete the task fully—don't gold-plate, but don't leave it half-done.`

**After:** `Complete the task fully and thoroughly. Do the work that a careful senior developer would do, including edge cases and fixing obviously related issues you discover. Don't add purely cosmetic or speculative improvements unrelated to the task.`

**Why:** "don't gold-plate" under-weights completeness; replaced with "careful senior developer" as the mental model.

---

## 5. Explore agent speed — "thorough over fast"

**Before:** `NOTE: You are meant to be a fast agent that returns output as quickly as possible...`

**After:** `NOTE: Be thorough in your exploration. Use efficient search strategies but do not sacrifice completeness for speed...`

**Why:** speed bias in the Explore agent's own prompt produced shallow searches. Reframed as thoroughness-first, efficiency-second.

---

## 6. Tone "short and concise" → "appropriately detailed"

**Before:** `Your responses should be short and concise.`

**After:** `Your responses should be clear and appropriately detailed for the complexity of the task.`

**Why:** "short and concise" turns nuanced answers into one-liners. Scale length to the question.

---

## 7. Subagent code snippet suppression — "include useful context"

**Before:** `Include code snippets only when the exact text is load-bearing ... do not recap code you merely read.`

**After:** `Include code snippets when they provide useful context (e.g., bugs found, function signatures, relevant patterns, code that informs the decision). Summarize rather than quoting large blocks verbatim.`

**Why:** the pre-edit rule stripped code from subagent reports that the caller actually needed for follow-up.

---

## 8. Match scope — "adjacent fixes allowed"

**Before:** `Match the scope of your actions to what was actually requested.`

**After:** `Match the scope of your actions to what was actually requested, but do address closely related issues you discover during the work when fixing them is clearly the right thing to do.`

**Why:** sibling to #1, for the "executing actions with care" section.

---

## 9. Opus anti-gold-plating (RP6 variant) — same as #1, stricter path

(Opus-only stricter variant; may drift out of a given Claude Code version — hence the `skipped[]` field in ditto variants.)

---

## 10. Numeric length anchors — "scale length to task"

**Before:** `Length limits: keep text between tool calls to ≤25 words. Keep final responses to ≤100 words unless the task requires more detail.`

**After:** `Keep text between tool calls concise — a sentence or two is usually enough. Keep final responses appropriately sized for the task: short for simple answers, longer when the complexity warrants it.`

**Why:** hard word-count caps make the model truncate actually-useful analysis. Replace with qualitative guidance.

---

## 11. End-of-turn "Nothing else" — allow context

**Before:** `End-of-turn summary: one or two sentences. What changed and what's next. Nothing else.`

**After:** `End-of-turn summary: concisely describe what changed and what's next. Include additional context when it helps the user understand the state of the work.`

**Why:** "Nothing else" actively suppressed useful status context.

---

## 12. No comments in code — "comments where non-obvious"

**Before:** `In code: default to writing no comments. Never write multi-paragraph docstrings or multi-line comment blocks — one short line max. ...`

**After:** `In code: only add comments where the logic isn't self-evident — a hidden constraint, a subtle invariant, a workaround. Keep them concise (one or two lines). ...`

**Why:** "never multi-line" stripped genuinely helpful context; replaced with judgment + short-by-default.

---

## 13. Exploratory questions 2-3 sentence cap — "don't truncate analysis"

**Before:** `For exploratory questions (...), respond in 2-3 sentences with a recommendation and the main tradeoff...`

**After:** `For exploratory questions (...), lead with a clear recommendation and the key tradeoffs. Be concise but don't artificially truncate when the question warrants more analysis...`

**Why:** "2-3 sentences" flattened discussion of genuinely complex tradeoffs.

---

## Takeaways for authoring new variants

1. **Replace hard rules with judgment.** "Three lines > abstraction" → "use judgment". "25 word cap" → "appropriate for task". Hard numeric rules are almost always worth loosening.
2. **Tone down rigid negatives.** "Nothing else", "Never", "Only" trigger over-correction. Prefer "usually", "default to".
3. **Name the intent, not the output shape.** "Be thorough" > "don't truncate". "Fix related issues" > "don't gold-plate" alone.
4. **One directive usually touches 5-10 prompts.** A behavior like "trust me more" shows up across system-prompt-doing-tasks, system-prompt-executing-actions-with-care, subagent prompts, and maybe communication style. Follow the directive wherever it lives; don't force it into one prompt.
5. **Preserve structure.** Keep bullet formatting, section headers, and identifier placeholders (`${TOOL_NAME}`) exactly as they are. Only change the **prose** within a piece.
