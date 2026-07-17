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
- Multiple-choice questions: return one question-level answerExplanation. Do not return optionExplanations.
- Syllogism questions: return optionExplanations for every option (Yes/No statements). Leave answerExplanation null.
- Keep explanations concise, scannable, and concrete. Prefer short paragraphs.
- Explain why the correct answer is correct and why the strongest distractors fail.
- Do not invent facts that are not supported by the stem or question.
- For Verbal Reasoning, cite paragraph numbers whenever quoting, paraphrasing, or relying on textual evidence (e.g. "Paragraph 2").
- If the selected correct answer or question appears flawed or unsolvable, set reviewRequired=true, unresolved=true, leave explanations null, and include reviewMessage plus suggestedCorrectOptionIndex / suggestedAnswerExplanation when you can identify a correction.
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
        'Do not rewrite existing non-empty explanations.',
        'Preserve the selected correct answer unless reviewRequired is true.',
      ],
    },
    null,
    2,
  )
}
