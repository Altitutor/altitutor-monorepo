# UCAT format

Student-facing text must look like the exam: structured tables, ordinary glyphs, no formatting source. Apply every rule that matches this stem’s section.

## Presentation

The candidate sees rendered content, not source.

- **Tables** — rectangular pipe tables (header + separator + body). Repair ragged columns, cells that spilled into paragraph text, missing headers, and tables flattened into a run of words.
- **Maths** — ordinary glyphs for simple arithmetic (`÷`, `×`, `±`, `≈`, `≤`, `≥`). Richer notation as inline `\( ... \)` or display `\[ ... \]`. Currency `$` is ordinary text. Replace leaked TeX such as `\div`, `\times`, `\leq`, raw `$...$`, and visible `\( \)` / `\[ \]` *inside* saved plain text with the rendered form.
- **Markup** — no literal `**bold**`, `~~strike~~`, or `[text](url)` in what the student reads. Those belong in Markdown *input* so the server can store real emphasis, not as visible characters.
- **Breaks** — restore lost paragraph and list structure. A Verbal Reasoning passage is separate paragraphs, not one block.

Write repairs as Markdown (`{ "format": "markdown", "value": "..." }`) unless you must keep an exact ProseMirror image node.

## Bundling

One stem = one shared stimulus.

Questions belong together only when they use the same passage, data set, scenario, or diagram. An item that was pasted onto the wrong stem is a split (see STEM.md), not a rewrite of the shared text to paper over it.

## Keys and explanations (all sections)

- `multiple_choice` — exactly one option with `answerKeyValue: "correct"`. The rest `null`. One question-level `answerExplanation`.
- `drag_and_drop` Decision Making binary placement — five statements, each keyed `yes` or `no`, each with its own option explanation.
- SJT Most/Least — three actions; one `most`, one `least`, one `null`.

## Verbal Reasoning

- At least four questions on the stem.
- Passage is two to six paragraphs. Do not number paragraphs in the passage (explanations may cite paragraph numbers).
- Category is Reading Comprehension or True, False, Can't Tell.
- Every question is `multiple_choice`.
- Reading Comprehension: four options.
- True/False/Can't Tell: those three option labels, nothing else.

## Decision Making

- Exactly one question on the stem.
- Category is one of: Interpreting Information and Drawing Conclusions; Logical Puzzles; Probabilistic and Statistical Reasoning; Recognising Assumptions; Syllogisms; Venn Diagrams.
- Binary placement (syllogisms / follow-from-passage Yes-No): question text is exactly `Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow.` Response `drag_and_drop`, five statements.
- Recognising Assumptions: question text is exactly `Select the strongest argument from the statements below.` Four arguments, `multiple_choice`.
- Venn Diagrams: an editable Venn or set-diagram visual on the stem.

## Quantitative Reasoning

- Every question is `multiple_choice` with five options.
- Shared tables, charts, or data sit on the stem; questions that need different data are a bundling split.

## Situational Judgement

- Category is How Important, How Appropriate, or Most/Least Appropriate. One mode per stem.
- How Important options, in this order: `Very important` · `Important` · `Of minor importance` · `Not important at all`.
- How Appropriate options, in this order: `A very appropriate thing to do` · `Appropriate, but not ideal` · `Inappropriate, but not awful` · `A very inappropriate thing to do`.
- Rating items are `multiple_choice` with those four labels.
- Most/Least Appropriate: exactly one question, `drag_and_drop`, three actions.