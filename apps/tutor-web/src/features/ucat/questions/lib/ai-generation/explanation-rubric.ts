/**
 * Shared student-facing explanation standard for fill generation and assessment/repair.
 * Keep workflow-specific rules (fill-only, patch shapes, audit dimensions) outside this rubric.
 */
export const EXPLANATION_TEACHING_RUBRIC = `Explanation teaching standard:
- Write student-facing lessons that teach how to solve the question. Do not write answer-key justifications or bare recaps of the correct choice.
- Act as a helpful tutor: reconstruct the relevant information, explain why each step is taken, show the decisive working, and finish with a clear answer.
- Prefer an efficient timed-test method the student can reproduce under exam conditions. Completeness of the teaching path matters more than short word count.
- For a non-trivial question, prefer two to five short, titled or numbered steps. A one-paragraph assertion or calculation is not a sufficient teaching explanation even when it reaches the correct answer.
- Multiple-choice questions require one non-empty question-level answerExplanation. Include option-level explanations when they help a student who chose a specific wrong option understand that mistake or add useful teaching not already covered at question level.
- Syllogism questions require an explanation for every Yes/No statement at option level. Include a question-level explanation when it teaches a useful strategy, technique, or shortcut not already covered by the option-level explanations.
- Decision Making and Quantitative Reasoning: step the student through how to solve the question with an efficient method. Use short paragraphs, calculations, compact lists, tables, elimination grids, ordered slots, or text diagrams when they materially help.
- Quantitative Reasoning: show calculator use where relevant, prefer mental maths when it is faster than calculator entry, and use plus-or-minus estimation when it is accurate enough to identify the correct option. Identify the required quantity, translate stem data into a calculation, preserve units, and perform a reasonableness check where useful.
- Verbal Reasoning: identify the specific passage evidence the student should read, cite paragraph numbers whenever quoting, paraphrasing, or relying on textual evidence (e.g. "Paragraph 2"), and teach the inference or elimination.
- Situational Judgement: connect the decision to the relevant professional principle and explain why less appropriate alternatives fail where that teaching helps.
- Explain why the correct answer is correct and why the strongest distractors fail when that teaching helps the student learn the method.
- Use Markdown headings, ordered steps, compact pipe tables, equations, elimination grids, or ordered slots when they improve understanding. These convert into structured rich text for the student.
- Keep explanations concrete and easy to scan. Avoid generic encouragement and empty filler, but never omit working, intermediate reasoning, evidence citations, or distractor teaching a student needs to learn the method.
- Only for a very difficult or time-consuming question where skipping would be the better real-exam decision, briefly advise the student to skip and return later. Do not add this advice routinely.
- Do not invent facts that are not supported by the stem or question.
- Use Australian English spelling.
- Avoid em dashes, double hyphens, canned headings, false starts, and phrases such as "it is important to note".`
