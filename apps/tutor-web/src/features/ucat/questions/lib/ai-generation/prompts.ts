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
- Each stem must be a passage of 2-6 paragraphs.
- Generate exactly 4 questions per stem.
- A stem must use one answer mode consistently:
  - True, False, Can't Tell category: every question has exactly 3 options: True, False, Can't Tell.
  - Reading Comprehension category: every question has exactly 4 options.
- Use only one correct answer per question.
- Questions must be answerable from the passage alone.
- Include a question-level answerExplanation for every question, explaining why the correct answer is correct and why distractors are wrong.`,
  decision_making: `Decision Making rules:
- Candidate must fit one of these categories: Syllogisms, Recognising Assumptions, Venn Diagrams, Drawing Conclusions, Probabilistic and Statistical Reasoning, Logical Puzzles.
- Generate exactly 1 question per stem.
- For multiple-choice questions, include 4-5 options and exactly one correct answer.
- For syllogism questions, each option is a statement and isAnswer means Yes/No truth value.
- Syllogisms question text must be exactly: Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow.
- Recognising Assumptions question text must be exactly: Select the strongest argument from the statements below.
- Syllogisms must have exactly five statements and per-option explanations.
- Include a question-level answerExplanation for non-syllogism questions.`,
  quantitative_reasoning: `Quantitative Reasoning rules:
- Generate structured tables and deterministic visual specs where useful; do not rely on freeform image descriptions.
- Use realistic numbers, units, and calculations.
- Include exactly 5 options and exactly one correct answer per question.
- Generate between 1 and 4 questions per stem.
- Include enough information in the stem for all calculations.
- Include a question-level answerExplanation for every question with the working or reasoning.`,
  situational_judgement: `Situational Judgement rules:
- Generate realistic professional/ethical scenarios.
- Generate exactly 4 questions per stem.
- Use either How Important or How Appropriate for all questions in the stem, never both.
- How Important options exactly: Very important; Important; Of minor importance; Not important at all.
- How Appropriate options exactly: A very appropriate thing to do; Appropriate, but not ideal; Inappropriate, but not awful; A very inappropriate thing to do.
- Include exactly one best answer per question.
- Include a question-level answerExplanation for every question, acknowledging plausible judgement nuance where relevant.`,
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

export type AiGenerationPromptLayer = {
  scopeType: 'section' | 'stem_category' | 'question_tag'
  name: string
  promptText: string
  version: number
}

export type AiGenerationBrief = {
  sectionName: string
  categoryName: string | null
  stemCount: number
  candidateCount: number
  difficultyTarget: 'easy' | 'medium' | 'hard' | 'mixed'
  timeBurdenTarget: 'low' | 'medium' | 'high' | 'mixed'
  targetTags: Array<{ id: string; name: string }>
  runInstructions?: string | null
  examples: Array<Record<string, unknown>>
  promptLayers: AiGenerationPromptLayer[]
}

function layeredInstructions(input: Pick<AiGenerationBrief, 'promptLayers'>): string[] {
  return input.promptLayers.map((layer) => `${layer.scopeType}:${layer.name} v${layer.version}\n${layer.promptText}`)
}

export function buildPlanningPrompt(input: AiGenerationBrief): string {
  return JSON.stringify(
    {
      task: 'Plan diverse UCAT generation candidates before writing content',
      brief: {
        section: input.sectionName,
        category: input.categoryName,
        requestedStemCount: input.stemCount,
        candidatesPerStem: input.candidateCount,
        difficultyTarget: input.difficultyTarget,
        timeBurdenTarget: input.timeBurdenTarget,
        targetTags: input.targetTags,
        runInstructions: input.runInstructions,
      },
      sectionRules: getAiGenerationSectionPrompt(sectionNameToAiGenerationKey(input.sectionName)),
      layeredInstructions: layeredInstructions(input),
      requirements: [
        'Create exactly requestedStemCount * candidatesPerStem plan rows.',
        'For mixed difficulty/time burden, distribute targets across the batch like real UCAT question spread.',
        'Vary scenario domains, question archetypes, distractor plans, wording patterns, names, and data relationships.',
        'Avoid planning disguised clones of source examples.',
      ],
      outputShape: {
        plans: [
          {
            stemIndex: 0,
            candidateIndex: 0,
            scenarioDomain: 'string',
            questionArchetype: 'string',
            distractorPlan: 'string',
            difficultyTarget: 'easy|medium|hard|mixed',
            timeBurdenTarget: 'low|medium|high|mixed',
            notes: 'string',
          },
        ],
      },
    },
    null,
    2
  )
}

export function buildWriterPrompt(input: AiGenerationBrief & { plan: unknown }): string {
  return JSON.stringify(
    {
      task: 'Write UCAT generation candidates from the plan',
      brief: {
        section: input.sectionName,
        category: input.categoryName,
        requestedStemCount: input.stemCount,
        candidatesPerStem: input.candidateCount,
        difficultyTarget: input.difficultyTarget,
        timeBurdenTarget: input.timeBurdenTarget,
        targetTags: input.targetTags,
        runInstructions: input.runInstructions,
      },
      plan: input.plan,
      sectionRules: getAiGenerationSectionPrompt(sectionNameToAiGenerationKey(input.sectionName)),
      layeredInstructions: layeredInstructions(input),
      sourceExamplesForCalibrationOnly: input.examples,
      contentBlockContract: [
        'stemText, questionText, answerText, and explanations may be strings or arrays of generated content blocks.',
        'Content blocks: paragraph {type,text}, table {type,caption,columns,rows}, visual {type,visualType,title,altText,spec}.',
        'Use table blocks for data tables.',
        'Use visual blocks only for warranted QR/DM visual categories and provide exact structured data in spec.',
        'Do not output ProseMirror JSON.',
      ],
      requirements: [
        'Return JSON only.',
        'Return candidates for the full plan.',
        'Do not copy selected source examples, scenario premises, distinctive data relationships, or near-exact wording.',
        'Every multiple_choice question must have exactly one isAnswer=true option and a question-level explanation.',
        'Every syllogism option must have answerExplanation explaining why the answer is Yes or No.',
        'Explanations must explain why the correct answer is correct and why the distractors are wrong.',
      ],
      outputShape: {
        stems: [
          {
            stemText: 'string or GeneratedContentBlock[]',
            categoryName: input.categoryName,
            difficultyTarget: 'easy|medium|hard|mixed',
            timeBurdenTarget: 'low|medium|high|mixed',
            warnings: [],
            questions: [
              {
                questionText: 'string or GeneratedContentBlock[]',
                questionType: 'multiple_choice|syllogism',
                answerExplanation: 'string or GeneratedContentBlock[] or null',
                difficultyTarget: 'easy|medium|hard|mixed',
                timeBurdenTarget: 'low|medium|high|mixed',
                estimatedDifficulty: 0.5,
                estimatedTimeBurdenSeconds: 90,
                tagIds: [],
                options: [
                  {
                    answerText: 'string or GeneratedContentBlock[]',
                    answerExplanation: 'string or GeneratedContentBlock[] or null',
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

export function buildCriticPrompt(input: AiGenerationBrief & { candidates: unknown }): string {
  return JSON.stringify(
    {
      task: 'Independently solve and critique UCAT generation candidates',
      brief: {
        section: input.sectionName,
        category: input.categoryName,
        difficultyTarget: input.difficultyTarget,
        timeBurdenTarget: input.timeBurdenTarget,
        targetTags: input.targetTags,
      },
      sectionRules: getAiGenerationSectionPrompt(sectionNameToAiGenerationKey(input.sectionName)),
      layeredInstructions: layeredInstructions(input),
      sourceExamplesForSimilarityCheck: input.examples,
      candidates: input.candidates,
      requirements: [
        'Mark objective answer or explanation errors as blocking with high confidence.',
        'For Situational Judgement and ambiguous Verbal Reasoning, warn when multiple answers are plausible unless the item is clearly invalid.',
        'Warn for weak distractors, thin explanations, difficulty/time-burden target mismatch, or low UCAT-likeness.',
        'Block disguised clones of source examples. Do not block broad topic, archetype, answer pattern, ordinary names, or generic table/chart dimensions.',
      ],
      outputShape: {
        issues: [
          {
            severity: 'blocking|warning',
            code: 'string',
            message: 'string',
            stemIndex: 0,
            questionIndex: 0,
            confidence: 0.75,
          },
        ],
        scores: {
          ucatLikeness: 0.9,
          answerConfidence: 0.9,
          explanationQuality: 0.9,
        },
      },
    },
    null,
    2
  )
}

export function buildRewriterPrompt(input: AiGenerationBrief & { candidate: unknown; issues: unknown }): string {
  return JSON.stringify(
    {
      task: 'Rewrite a salvageable UCAT generation candidate once',
      brief: {
        section: input.sectionName,
        category: input.categoryName,
        difficultyTarget: input.difficultyTarget,
        timeBurdenTarget: input.timeBurdenTarget,
        targetTags: input.targetTags,
      },
      sectionRules: getAiGenerationSectionPrompt(sectionNameToAiGenerationKey(input.sectionName)),
      layeredInstructions: layeredInstructions(input),
      candidate: input.candidate,
      issues: input.issues,
      requirements: [
        'Fix the listed issues without changing the selected section/category.',
        'Preserve UCAT style and answer validity.',
        'Return exactly one rewritten candidate in the same stems array shape.',
      ],
      outputShape: {
        stems: [
          {
            stemText: 'string or GeneratedContentBlock[]',
            categoryName: input.categoryName,
            questions: [],
          },
        ],
      },
    },
    null,
    2
  )
}
