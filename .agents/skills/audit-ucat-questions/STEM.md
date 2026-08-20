# Per-stem audit

One stem. Load [FORMAT.md](FORMAT.md) for its section and [EXPLANATION.md](EXPLANATION.md) for its section and response type. Apply every rule that fires.

If you were given an `auditRunId`, claim it (`limit: 1`, `includeContent: true`) unless the parent already handed you the aggregate. Re-read with `get_ucat_content` before writing anyway.

## 1. See the item

Read the stem text, every question, every option, keys, explanations, category, tags, difficulty, time burden, and visuals. Fetch images with `get_ucat_file` or `render_ucat_visual` so the *blind solve* can see the data.

**Done when:** you can work from the stimulus a candidate would see, including charts and diagrams.

## 2. Format

Apply [FORMAT.md](FORMAT.md). Presentation first (tables, literal maths/markdown source, broken line breaks), then section shape, then *bundling*: questions that do not share this stem’s stimulus do not belong here.

**Split (draft / in review).** `create_question_stem` for the offloaded questions (stable `idempotencyKey`), then `remove_question` on the original. Leave the original a valid UCAT stem. Report `updated` and the new stem id.

**Split (published).** Do not yank live questions into a draft. Report `suggest_split`. Finish the audit-run target as `skipped`.

**Done when:** a candidate would see rendered UCAT layout, and every remaining question belongs on this stimulus — or a split/delete suggestion records the ones that do not.

## 3. Blind solve

Cover the keyed answers and existing explanations. Solve from stem, question, options, and visuals only. Write the answer and the shortest defensible method for every question.

Then uncover the key. Reconcile:

- Unique match → keep the key.
- Your answer is uniquely defensible and the key is not → retag the key, or edit options so exactly one fair UCAT answer remains. Prefer retagging when an existing option is already the right answer. Keep option counts required by [FORMAT.md](FORMAT.md).
- Two answers defensible, or unsolvable even after a recoverable edit → this is not a keep-as-is. Rewrite until it is uniquely defensible, or *suggest_delete* that question (whole stem only if the shared stimulus is dead or too few valid questions would remain). High bar: most conflicts resolve with an edit.

If you are keeping the item, every finding becomes a write. Leftover “notes for later” are not an outcome.

**Done when:** every kept question has a uniquely defensible key you have independently produced, or a delete suggestion names what cannot be saved.

## 4. UCAT-like

Stem, questions, and options must read as a real UCAT ANZ exam item: register, tone, and task. Polish when close. Rewrite when recoverable but not authentic. *suggest_delete* only when it cannot be made into a real item.

**Done when:** you would not be surprised to see the kept item on the real exam.

## 5. Explanations

Rewrite explanations to [EXPLANATION.md](EXPLANATION.md). Independently solved first (step 3). The explanation teaches a student with little UCAT experience how to reproduce that solution.

**Done when:** every kept question meets the teaching standard for its response type and section.

## 6. Category, tags, difficulty, time

`get_ucat_reference_data` for valid `categoryId` and `tagIds`. Use those IDs; do not invent them.

- **Category / tags** — overwrite only when they name the wrong skill or question type.
- **Difficulty** — proportion of the target cohort expected to get it *wrong* on first exposure under section timing, 0–1. Overwrite when off by 0.2 or more.
- **Time burden** — whole seconds of active work for a fully correct first-exposure answer in this authored position (includes the reading that position normally costs). Overwrite when off by 50% or by 30 seconds, whichever is larger.

Leave the field when it is already right, including small disagreements under those bounds.

**Done when:** every kept question has been checked against those bounds, and every overwrite is a typed operation.

## 7. Write

Authoring: `update_question_stem`. Published: `update_published_question_stem` with `auditRunId`, plus `summary` (and `rationale` when the change is not obvious).

Prefer `{ "format": "markdown", "value": "..." }` for text. Use native ProseMirror only to insert an `imageNode` from an image tool (`fileId` is the durable reference; it is not attached until you insert it).

Visuals: repair or regenerate only when the defect is clear and the image tools can fix it. Insert the new node. If the visual makes the item unsolvable and cannot be fixed, that is *suggest_delete*.

**Done when:** operations have been accepted at the current revision, or the outcome is `suggest_delete` / `suggest_split` / `failed` with no partial silent write.

## 8. Outcome

Return one object:

```text
stemId, section, status, outcome, why
```

`outcome` is `updated` | `unchanged` | `suggest_delete` | `suggest_split` | `failed`.

If an `auditRunId` was given, `finish_ucat_audit_run_target`: `completed` for updated/unchanged, `skipped` for suggest_delete/suggest_split, `failed` for failed. Put this object in `outcome`. Set `result` to that same `outcome` value for completed and skipped targets; failed has no result.

**Done when:** the parent can copy this into the run report without reading the stem again.