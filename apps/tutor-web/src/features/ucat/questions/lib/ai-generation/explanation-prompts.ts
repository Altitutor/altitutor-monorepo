import {
  getAiGenerationSectionPrompt,
  sectionNameToAiGenerationKey,
} from '@/features/ucat/questions/lib/ai-generation/prompts'
import { EXPLANATION_TEACHING_RUBRIC } from '@/features/ucat/questions/lib/ai-generation/explanation-rubric'
import { summarizeStemForAi, type AiToolQuestionStemPayload } from '@/features/ucat/questions/lib/ai-tools'

export const EXPLANATION_FILL_SYSTEM_PROMPT = `You write student-facing UCAT answer explanations for questions that already have answer choices and a selected correct answer.

Return JSON only. Do not include markdown or prose outside the JSON object.

Fill missing explanations only. Teach how to solve the question using the stem, question text, all answer options, and the selected correct answer.

Workflow rules:
- Before writing any explanation, independently solve each listed question from the stem and answer options, then compare your result with the keyed answer (the option or Yes/No value marked isAnswer=true). This validation must happen first.
- If any keyed answer is incorrect, ambiguous, unsupported, or the question is unsolvable, do not generate an explanation for it. Set reviewRequired=true and unresolved=true so the tutor is alerted, leave answerExplanation null and omit optionExplanations, and explain the discrepancy in reviewMessage. Include suggestedCorrectOptionIndex / suggestedAnswerExplanation when a clear correction exists.
- For multiple-choice questions, return one non-empty question-level answerExplanation when the key is sound. Option-level explanations may be included when they help; otherwise use null or omit them.
- For syllogism questions, return optionExplanations for every option (Yes/No statement) when the key is sound. A question-level answerExplanation may be included when useful; otherwise use null.
- Only return updates for the listed questionIndex values. Do not rewrite existing non-empty explanations. Preserve the selected correct answer unless reviewRequired is true.

${EXPLANATION_TEACHING_RUBRIC}

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
        'Write complete teaching explanations that walk the student through how to solve the question.',
      ],
    },
    null,
    2,
  )
}
