export type AiGenerationSectionKey =
  | 'verbal_reasoning'
  | 'decision_making'
  | 'quantitative_reasoning'
  | 'situational_judgement'
  | 'generic'

export const AI_GENERATION_SYSTEM_PROMPT = `You generate high-quality UCAT ANZ question stems for tutor review.

Return JSON only. Do not include markdown or prose outside the JSON object.
Every generated question must include a concise, student-facing question-level answerExplanation.
Explanations must justify why the correct answer is correct, and should not merely restate the answer.
Do not copy sample stems verbatim. Create distinct scenarios that test similar reasoning skills.
Avoid image-dependent questions unless the request explicitly asks for images.`

const SECTION_PROMPTS: Record<AiGenerationSectionKey, string> = {
  verbal_reasoning: `Verbal Reasoning rules:
- Each stem should be a passage of 2-5 paragraphs.
- Generate exactly 4 questions per stem.
- A stem must use one answer mode consistently:
  - True/False/Can't Tell mode: every question has exactly 3 options: True, False, Can't Tell.
  - Multiple-choice mode: every question has exactly 4 options.
- Use only one correct answer per question.
- Questions must be answerable from the passage alone.
- Include a question-level answerExplanation for every question.`,
  decision_making: `Decision Making rules:
- Generate text/table-only Decision Making items; avoid image-dependent diagrams.
- Stems may test logic, arguments, probability, Venn/table reasoning, or syllogisms.
- For multiple-choice questions, include 4-5 options and exactly one correct answer.
- For syllogism questions, each option is a statement and isAnswer means Yes/No truth value.
- Include a question-level answerExplanation for every question.`,
  quantitative_reasoning: `Quantitative Reasoning rules:
- Generate text/table-only quantitative scenarios; avoid image-dependent charts.
- Use realistic numbers, units, and calculations.
- Include 4-5 options and exactly one correct answer per question.
- Include enough information in the stem for all calculations.
- Include a question-level answerExplanation for every question with the working or reasoning.`,
  situational_judgement: `Situational Judgement rules:
- Generate realistic professional/ethical scenarios.
- Use judgement-based answer options appropriate to UCAT SJT.
- Include exactly one best answer unless the question format explicitly asks otherwise.
- Include a question-level answerExplanation for every question.`,
  generic: `Generic UCAT rules:
- Generate coherent UCAT-style stems with linked questions.
- Include 4-5 options and exactly one correct answer for multiple-choice questions.
- Include a question-level answerExplanation for every question.`,
}

export function sectionNameToAiGenerationKey(sectionName: string | null | undefined): AiGenerationSectionKey {
  if (sectionName === 'Verbal Reasoning') return 'verbal_reasoning'
  if (sectionName === 'Decision Making') return 'decision_making'
  if (sectionName === 'Quantitative Reasoning') return 'quantitative_reasoning'
  if (sectionName === 'Situational Judgement') return 'situational_judgement'
  return 'generic'
}

export function getAiGenerationSectionPrompt(section: AiGenerationSectionKey): string {
  return SECTION_PROMPTS[section]
}

export function buildAiGenerationUserPrompt(input: {
  sectionName: string
  sectionPrompt: string
  categoryName: string | null
  stemCount: number
  examples: Array<Record<string, unknown>>
}): string {
  return JSON.stringify(
    {
      task: 'Generate UCAT question stems from samples',
      section: input.sectionName,
      category: input.categoryName,
      stemCount: input.stemCount,
      sectionRules: input.sectionPrompt,
      requirements: [
        'Return exactly stemCount stems.',
        'Every question must include non-empty answerExplanation.',
        'Use question-level answerExplanation; option answerExplanation may be null.',
        'Every multiple_choice question must have exactly one option with isAnswer=true.',
        'Do not generate image-dependent content.',
      ],
      examples: input.examples,
      outputShape: {
        stems: [
          {
            stemText: 'string',
            questions: [
              {
                questionText: 'string',
                questionType: 'multiple_choice|syllogism',
                answerExplanation: 'required non-empty string',
                options: [
                  {
                    answerText: 'string',
                    answerExplanation: null,
                    isAnswer: true,
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    null,
    2
  )
}
