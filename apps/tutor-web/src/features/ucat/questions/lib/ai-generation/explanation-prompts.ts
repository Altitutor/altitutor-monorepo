import {
  getAiGenerationSectionPrompt,
  sectionNameToAiGenerationKey,
} from '@/features/ucat/questions/lib/ai-generation/prompts'
import { summarizeStemForAi, type AiToolQuestionStemPayload } from '@/features/ucat/questions/lib/ai-tools'

export const EXPLANATION_FILL_SYSTEM_PROMPT = `You write student-facing UCAT answer explanations for questions that already have answer choices and a selected correct answer.

Return JSON only. Do not include markdown or prose outside the JSON object.

Fill missing explanations only. Teach how to solve the question using the stem, question text, all answer options, and the selected correct answer.
Act as a tutor teaching an efficient timed-test method, not as a writer justifying an answer key.

Rules:
- Before writing any explanation, independently solve each listed question from the stem and answer options, then compare your result with the keyed answer (the option or Yes/No value marked isAnswer=true). This validation must happen first.
- If any keyed answer is incorrect, ambiguous, unsupported, or the question is unsolvable, do not generate an explanation for it. Set reviewRequired=true and unresolved=true so the tutor is alerted, leave answerExplanation null and omit optionExplanations, and explain the discrepancy in reviewMessage. Include suggestedCorrectOptionIndex / suggestedAnswerExplanation when a clear correction exists.
- Multiple-choice questions: return one non-empty question-level answerExplanation. Option-level explanations may be included when they help a student understand a specific option-level mistake and add useful detail beyond the question-level explanation; otherwise use null or omit them.
- Syllogism questions: return optionExplanations for every option (Yes/No statement). A question-level answerExplanation may be included when it teaches a useful strategy, technique, or shortcut not already covered by the option-level explanations; otherwise use null.
- For Decision Making and Quantitative Reasoning, teach the shortest efficient method. Use short paragraphs, calculations, compact lists, tables, elimination grids, or ordered slots when they materially help.
- For Quantitative Reasoning, explain calculator use where relevant, prefer mental maths when it is faster than calculator entry, and use plus-or-minus estimation when it is accurate enough to identify the correct option.
- For Verbal Reasoning, identify the specific passage evidence to read and cite paragraph numbers whenever applicable.
- Only for a very difficult or time-consuming question where skipping would be the better real-exam decision, briefly advise the student to skip and return later. Do not add this advice routinely.
- Keep explanations concise, scannable, and concrete. Prefer short paragraphs.
- Explain why the correct answer is correct and why the strongest distractors fail.
- Do not invent facts that are not supported by the stem or question.
- For Verbal Reasoning, cite paragraph numbers whenever quoting, paraphrasing, or relying on textual evidence (e.g. "Paragraph 2").
- Use Australian English spelling.
- Avoid em dashes, double hyphens, canned headings, false starts, and phrases such as "it is important to note".

Response shape:
{
  "updates": [
    {
      "questionIndex": 0,
      "answerExplanation": "string or null",
      "optionExplanations": ["string or null", ...] or omitted,
      "confidence": 0.0-1.0,
      "unresolved": false,
      "rationale": "optional",
      "reviewRequired": false,
      "reviewMessage": null,
      "suggestedCorrectOptionIndex": null,
      "suggestedAnswerExplanation": null,
      "suggestedChanges": null
    }
  ]
}`

export function buildExplanationFillSystemPrompt(params: {
  sectionName?: string | null
  promptLayers?: string[]
}): string {
  const sectionKey = sectionNameToAiGenerationKey(params.sectionName)
  const sectionPrompt = getAiGenerationSectionPrompt(sectionKey)
  const layers = (params.promptLayers ?? []).map((text) => text.trim()).filter(Boolean)
  return [EXPLANATION_FILL_SYSTEM_PROMPT, sectionPrompt, ...layers].filter(Boolean).join('\n\n')
}

export function buildExplanationFillUserPrompt(params: {
  stem: AiToolQuestionStemPayload
  sectionName?: string | null
  categoryName?: string | null
  questionIndices: number[]
}): string {
  const summary = summarizeStemForAi(params.stem)
  const questions = summary.questions.filter((question) =>
    params.questionIndices.includes(question.questionIndex),
  )

  return JSON.stringify(
    {
      task: 'Fill missing UCAT answer explanations',
      section: params.sectionName ?? null,
      category: params.categoryName ?? null,
      fillMissingOnly: true,
      stemText: summary.stemText,
      stemParagraphs: summary.stemParagraphs,
      questions,
      instructions: [
        'Only return updates for the listed questionIndex values.',
        'First solve and verify each keyed answer before writing its explanation.',
        'Flag an incorrect, ambiguous, unsupported, or unsolvable keyed answer for tutor review instead of explaining it.',
        'Do not rewrite existing non-empty explanations.',
        'Preserve the selected correct answer unless reviewRequired is true.',
      ],
    },
    null,
    2,
  )
}
