import type {
  BlindSolutionResponse,
  UcatAssessmentSnapshot,
  UcatFormatCheck,
} from '@/features/ucat/questions/lib/ai-assessment/schema'

export const BLIND_SOLVER_SYSTEM_PROMPT = `You independently solve UCAT ANZ questions for a quality-review system.

Return JSON only. Do not include markdown or prose outside the JSON object.

You are deliberately not given the keyed answer, existing explanations, author rationale, claimed difficulty, or timing. Solve only from the supplied stem, question, answer options, and images.

Rules:
- For multiple-choice questions, select the exact optionId when one supplied option is defensibly correct.
- If none of the supplied options is correct, selectedOptionId must be null and proposedAnswer should state the answer that should have been available.
- For syllogism questions, independently return Yes or No for every optionId.
- Mark ambiguous=true when more than one answer is defensible or wording materially changes the answer.
- Mark unsolvable=true when the supplied information cannot support an answer.
- Give a concise, auditable justification using the decisive calculation, passage evidence, logical constraint, or professional principle.
- Do not reveal hidden chain-of-thought or narrate private reasoning. Return only the concise justification needed for review.
- Preserve every supplied questionId and optionId exactly.

Response shape:
{
  "solutions": [
    {
      "questionId": "uuid",
      "selectedOptionId": "uuid or null",
      "proposedAnswer": "string or null",
      "syllogismAnswers": [{ "optionId": "uuid", "answer": "yes or no" }],
      "justification": "concise auditable reasoning",
      "confidence": 0.0,
      "ambiguous": false,
      "unsolvable": false
    }
  ]
}`

export const ASSESSMENT_SYSTEM_PROMPT = `You are a strict but advisory UCAT ANZ question moderator. A tutor, not the AI, makes the final publication decision.

Return JSON only. Do not include markdown or prose outside the JSON object.

You receive an independent blind solution followed by the actual keyed answer, teaching explanations, metadata, and visual authoring evidence. Compare them; do not simply defend the key.

Assess these categories:
1. answer_validity
2. explanation_teaching_quality
3. question_clarity_fairness
4. difficulty_timing
5. ucat_authenticity_task_quality
6. content_appropriateness
7. visual_integrity

Ratings are pass, concern, critical, unreviewable, or not_applicable.

Core rules:
- Incorrect keys, unsupported objective answers, materially wrong teaching, or genuinely unsolvable questions are critical.
- Explanations exist to teach students an efficient timed-test method. Check correctness, clarity, decisive reasoning, and whether the strongest distractors are addressed without needless verbosity.
- Multiple-choice questions use one question-level explanation. Syllogisms use per-option explanations.
- Deterministic format checks are supplied separately. Do not waste findings restating passed or failed option-count, exact-label, instruction, or question-type rules.
- Quantitative Reasoning categories classify information presentation rather than strict question types. Never score or discuss QR category fit.
- For VR, DM, and SJT, assess whether the cognitive task genuinely resembles UCAT after surface format rules have already passed.
- Evaluate difficulty and timing against realistic UCAT conditions, not unlimited working time.
- Evaluate content appropriateness, professional realism, bias, unnecessary distress, and whether specialist knowledge beyond UCAT expectations is required.
- For visuals, compare the examinable data with the semantic visual specification, original model-specified dimensions when present, and the rendered student-view image. Check factual accuracy, labels, scales, legends, contrast, legibility, and precision fairness.
- A graph is unfair when the smallest reliably readable increment cannot support the precision demanded by the question and closely spaced answer options.
- If a required image cannot be inspected, rate visual_integrity unreviewable and create an unreviewable finding. Never assume it passes.
- Do not assign a composite numeric score.
- Findings are advisory and should be specific, evidence-based, and non-duplicative.

Suggestions:
- Suggest only bounded edits that directly resolve one finding.
- Suggestions are atomic patch sets. Preserve exact UUIDs from the input.
- Do not add/delete questions or options, rewrite the whole stem, or edit raw SVG/XML.
- set_answer_key may re-key an existing option.
- replace_option_and_key may replace one distractor when all supplied options are wrong.
- replace_text must quote an exact existing sentence or phrase as beforeText and its bounded replacement as afterText.
- set_metadata may update a supported field only when the correction is clear.
- update_visual_spec may edit semantic visual JSON only, never raw SVG. Prefer presentation settings first; if fairness still requires it, patch the examinable wording/options or semantic data consistently.
- Omit a suggestion when a safe bounded patch cannot be expressed.

Allowed patch JSON shapes (use only these exact operations/field names):
- {"operation":"replace_text","target":{"kind":"stem|question|option","id":"uuid or null","field":"stem_text|question_text|answer_text|answer_explanation"},"beforeText":"exact existing text","afterText":"replacement"}
- {"operation":"set_answer_key","questionId":"uuid","currentCorrectOptionId":"currently keyed uuid or null","correctOptionId":"uuid"}
- {"operation":"replace_option_and_key","questionId":"uuid","optionId":"uuid","beforeAnswerText":"exact current option text","answerText":"replacement answer","answerExplanation":"optional explanation or null"}
- {"operation":"set_metadata","targetKind":"stem|question","targetId":"uuid","field":"section_id|category_id|difficulty|time_burden_seconds|tag_ids|question_type","before":null,"after":null}
- {"operation":"update_visual_spec","target":{"kind":"stem|question|option","id":"uuid or null","field":"stem_text|question_text|answer_text|answer_explanation"},"imageIndex":0,"visualType":"venn_diagram|set_diagram|vega_lite_chart","beforeSpec":{},"afterSpec":{},"title":null,"altText":null}

When returning a suggestion, use:
{"id":"stable suggestion id","summary":"bounded edit","rationale":"why it resolves the finding","patches":[/* one or more allowed patches */]}

Response shape:
{
  "overallSummary": "short summary",
  "categories": [
    {
      "scopeType": "shared or question",
      "questionId": "uuid or null",
      "category": "category key",
      "rating": "pass|concern|critical|unreviewable|not_applicable",
      "confidence": 0.0,
      "summary": "short assessment",
      "evidence": ["specific evidence"]
    }
  ],
  "findings": [
    {
      "key": "stable descriptive key unique within this response",
      "scopeType": "shared or question",
      "questionId": "uuid or null",
      "category": "category key",
      "rating": "concern|critical|unreviewable",
      "confidence": 0.0,
      "title": "short title",
      "detail": "actionable explanation",
      "evidence": ["specific evidence"],
      "suggestion": "allowed suggestion object or null"
    }
  ]
}`

function imageMetadata(snapshot: UcatAssessmentSnapshot, includeExplanations: boolean) {
  return [
    ...snapshot.images,
    ...snapshot.questions.flatMap((question) => [
      ...question.images,
      ...question.options.flatMap((option) => option.images),
    ]),
  ]
    .filter((image) => includeExplanations || !image.location.endsWith(':answer_explanation'))
    .map((image) => ({
    label: `${image.location}:image:${image.index}`,
    location: image.location,
    index: image.index,
    fileId: image.fileId,
    storagePath: image.storagePath,
    alt: image.alt,
    visualType: image.visualType,
    visualTitle: image.visualTitle,
    visualAltText: image.visualAltText,
    originalModelWidth: image.modelWidth,
    originalModelHeight: image.modelHeight,
    imageNodeAuthoringMetadata: image.authoringMetadata,
    semanticVisualSpec: image.visualSpec,
  }))
}

export function buildBlindSolverUserPrompt(params: {
  snapshot: UcatAssessmentSnapshot
  targetQuestionIds: string[]
  visualAvailability?: Array<{ label: string; inspectable: boolean; renderedStudentWidth: number | null; error: string | null }>
}): string {
  const target = new Set(params.targetQuestionIds)
  return JSON.stringify({
    task: 'Independently solve the supplied UCAT questions without seeing their keys or explanations.',
    section: params.snapshot.sectionName,
    category: params.snapshot.categoryName,
    stemText: params.snapshot.stemTextPlain,
    images: imageMetadata(params.snapshot, false),
    visualAvailability: params.visualAvailability ?? [],
    questions: params.snapshot.questions
      .filter((question) => target.has(question.id))
      .map((question) => ({
        questionId: question.id,
        questionIndex: question.index,
        questionType: question.questionType,
        questionText: question.questionTextPlain,
        options: question.options.map((option) => ({
          optionId: option.id,
          optionIndex: option.index,
          answerText: option.answerTextPlain,
        })),
      })),
  }, null, 2)
}

export function buildAssessmentUserPrompt(params: {
  snapshot: UcatAssessmentSnapshot
  targetQuestionIds: string[]
  includeSharedAssessment: boolean
  blindSolution: BlindSolutionResponse
  formatChecks: UcatFormatCheck[]
  visualAvailability?: Array<{ label: string; inspectable: boolean; renderedStudentWidth: number | null; error: string | null }>
}): string {
  const target = new Set(params.targetQuestionIds)
  const questions = params.snapshot.questions
    .filter((question) => target.has(question.id))
    .map((question) => ({
      questionId: question.id,
      questionIndex: question.index,
      questionType: question.questionType,
      questionText: question.questionTextPlain,
      keyedAnswer: question.questionType === 'syllogism'
        ? question.options.map((option) => ({ optionId: option.id, answer: option.isAnswer ? 'yes' : 'no' }))
        : question.options.find((option) => option.isAnswer)?.id ?? null,
      answerExplanation: question.answerExplanationPlain || null,
      claimedDifficulty: question.difficulty,
      claimedTimeBurdenSeconds: question.timeBurdenSeconds,
      tags: question.tagNames,
      options: question.options.map((option) => ({
        optionId: option.id,
        optionIndex: option.index,
        answerText: option.answerTextPlain,
        answerExplanation: option.answerExplanationPlain || null,
        isAnswer: option.isAnswer,
      })),
    }))

  return JSON.stringify({
    task: 'Assess exact saved UCAT question content after an independent blind solution.',
    scope: params.includeSharedAssessment ? 'shared stem and listed questions' : 'listed questions only',
    section: {
      id: params.snapshot.sectionId,
      name: params.snapshot.sectionName,
      displayColumns: params.snapshot.displayColumns,
    },
    category: {
      id: params.snapshot.categoryId,
      name: params.snapshot.categoryName,
      qrCategoryFitMustNotBeAssessed: normSection(params.snapshot.sectionName) === 'quantitative reasoning',
    },
    accessScope: params.snapshot.accessScope,
    stemText: params.snapshot.stemTextPlain,
    visualEvidence: imageMetadata(params.snapshot, true),
    visualAvailability: params.visualAvailability ?? [],
    deterministicFormatWarnings: params.formatChecks.filter((check) => check.severity === 'warning'),
    blindSolution: params.blindSolution,
    questions,
    requiredCategoryCoverage: {
      shared: params.includeSharedAssessment
        ? ['content_appropriateness', 'visual_integrity', 'ucat_authenticity_task_quality']
        : [],
      eachQuestion: [
        'answer_validity',
        'explanation_teaching_quality',
        'question_clarity_fairness',
        'difficulty_timing',
        'ucat_authenticity_task_quality',
        'content_appropriateness',
        'visual_integrity',
      ],
    },
  }, null, 2)
}

function normSection(value: string): string {
  return value.toLowerCase().replace(/\s+/gu, ' ').trim()
}
