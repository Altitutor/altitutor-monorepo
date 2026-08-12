import { buildUcatExplanationPolicy } from '@/features/ucat/questions/lib/ai-generation/explanation-rubric'
import { summarizeStemForAi, type AiToolQuestionStemPayload } from '@/features/ucat/questions/lib/ai-tools'

const EXPLANATION_FILL_BASE_SYSTEM_PROMPT = `You write student-facing UCAT answer explanations for questions that already have answer choices and a selected correct answer.

Return JSON only. Do not include markdown or prose outside the JSON object.

Fill missing explanations only. Teach how to solve the question using the stem, question text, all answer options, and the selected correct answer.

Workflow rules:
- Before writing any explanation, independently solve each listed question from the stem and answer options, then compare your result with the keyed answer (the option or Yes/No value marked isAnswer=true). This validation must happen first.
- If any keyed answer is incorrect, ambiguous, unsupported, or the question is unsolvable, do not generate an explanation for it. Set reviewRequired=true and unresolved=true so the tutor is alerted, leave answerExplanation null and omit optionExplanations, and explain the discrepancy in reviewMessage. Include suggestedCorrectOptionIndex / suggestedAnswerExplanation when a clear correction exists.
- For multiple-choice questions, return one non-empty question-level answerExplanation when the key is sound. Also return option-level explanations whenever they add distinct teaching for that choice; omit an option only when it would merely repeat the question-level explanation.
- For drag-and-drop questions, return optionExplanations for every statement or placement item when the key is sound. Add a question-level answerExplanation when appropriate to teach general strategy without repeating the option-level explanations.
- Only return updates for the listed questionIndex values. Do not rewrite existing non-empty explanations. Preserve the selected correct answer unless reviewRequired is true.

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

export const EXPLANATION_FILL_SYSTEM_PROMPT = [
  EXPLANATION_FILL_BASE_SYSTEM_PROMPT,
  buildUcatExplanationPolicy(),
].join('\n\n')

export function buildExplanationFillSystemPrompt(params: {
  sectionName?: string | null
  promptLayers?: string[]
}): string {
  const layers = (params.promptLayers ?? []).map((text) => text.trim()).filter(Boolean)
  const explanationPolicy = buildUcatExplanationPolicy({ sectionName: params.sectionName })
  return [EXPLANATION_FILL_BASE_SYSTEM_PROMPT, explanationPolicy, ...layers]
    .filter(Boolean)
    .join('\n\n')
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
        'Write complete teaching explanations using the shared section-specific teaching standard.',
      ],
    },
    null,
    2,
  )
}
