import type {
  BlindSolutionResponse,
  UcatAssessmentSnapshot,
  UcatFormatCheck,
} from '@/features/ucat/questions/lib/ai-assessment/schema'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import type { Json } from '@altitutor/shared'

type ReviewTextBlock = {
  kind: 'paragraph' | 'bullet_list_item' | 'ordered_list_item' | 'heading' | 'table'
  text: string
}

function richTextReviewBlocks(value: Json | null): ReviewTextBlock[] {
  const blocks: ReviewTextBlock[] = []

  function visit(node: unknown, listKind: ReviewTextBlock['kind'] | null = null) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return
    const record = node as Record<string, unknown>
    const type = typeof record.type === 'string' ? record.type : ''
    const content = Array.isArray(record.content) ? record.content : []

    if (type === 'paragraph' || type === 'heading' || type === 'table') {
      const text = proseMirrorToPlainText(node as Json).trim()
      if (text) {
        blocks.push({
          kind: listKind ?? (type === 'heading' ? 'heading' : type === 'table' ? 'table' : 'paragraph'),
          text,
        })
      }
      return
    }
    if (type === 'bulletList') {
      content.forEach((child) => visit(child, 'bullet_list_item'))
      return
    }
    if (type === 'orderedList') {
      content.forEach((child) => visit(child, 'ordered_list_item'))
      return
    }
    content.forEach((child) => visit(child, listKind))
  }

  visit(value)
  return blocks
}

function reviewText(value: Json | null, plainText: string) {
  const blocks = richTextReviewBlocks(value)
  if (blocks.length <= 1) return plainText
  return {
    blocks,
    formattingNote: 'Each array entry is a separate rich-text block. Boundaries between blocks are intentional; do not report missing spaces or punctuation between adjacent entries. List markers are structural and are not literal text for replace_text patches.',
  }
}

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

Assess exactly these five review dimensions:
1. presentation_integrity
2. ucat_suitability
3. difficulty_timing
4. answer_correctness_fairness
5. explanation_quality

Ratings are pass, concern, critical, unreviewable, or not_applicable.

Core rules:
- presentation_integrity covers malformed tables, squashed or lost line breaks, rich-text rendering defects, and visual integrity.
- ucat_suitability covers whether the item resembles real UCAT ANZ content, uses appropriate knowledge and professional context, and is worth retaining. Use recommendedAction="exclude" only for probably irrecoverable candidates.
- answer_correctness_fairness requires independent solution, exactly one defensible keyed answer for multiple choice, correct Yes/No conclusions for syllogisms, plausible distractors, and fair discrimination at UCAT calculator/visual precision.
- explanation_quality follows the supplied question type and section. Incorrect keys, unsupported objective answers, materially wrong teaching, or genuinely unsolvable questions are critical.
- Explanations exist to teach students an efficient timed-test method. Check correctness, clarity, decisive reasoning, and whether the strongest distractors are addressed without needless verbosity.
- Multiple-choice questions require one question-level explanation and may also use helpful, non-duplicative option-level explanations. Syllogisms require per-option explanations and may also use a helpful, non-duplicative question-level strategy explanation.
- Deterministic format checks are supplied separately. Do not restate passed checks. For a failed check, create a finding only when you can propose the complete repair that code could not safely apply; otherwise leave the deterministic failure to the gate UI.
- Quantitative Reasoning categories classify information presentation rather than strict question types. Never score or discuss QR category fit.
- For VR, DM, and SJT, assess whether the cognitive task genuinely resembles UCAT after surface format rules have already passed.
- Evaluate difficulty and timing against realistic UCAT conditions, not unlimited working time. This category is not merely a metadata-calibration check.
- Independently judge whether the task belongs within an appropriate UCAT difficulty and time-burden range. Flag questions that are too trivial, too difficult, too slow, excessively calculation-heavy, or otherwise inappropriate for the section even when the claimed difficulty/time metadata accurately describes them.
- Consider the work a prepared candidate must perform under the section time limit, including reading, interpreting visuals, setup, calculation and answer discrimination. Distinguish a healthy easy or hard UCAT item from one outside the useful exam range.
- Evaluate content appropriateness, professional realism, bias, unnecessary distress, and whether specialist knowledge beyond UCAT expectations is required.
- For visuals, compare the examinable data with the semantic visual specification, original model-specified dimensions when present, and the rendered student-view image. Check factual accuracy, labels, scales, legends, contrast, legibility, and precision fairness.
- A graph is unfair when the smallest reliably readable increment cannot support the precision demanded by the question and closely spaced answer options.
- If a required image cannot be inspected, rate visual_integrity unreviewable and create an unreviewable finding. Never assume it passes.
- Do not assign a composite numeric score.
- Findings are advisory and should be specific, evidence-based, and non-duplicative.
- Multi-block rich text is supplied as explicit blocks. Treat paragraph and list-item boundaries as formatting, never as missing spaces or run-on text.
- If a question already has tags, do not assess or change its tags. If it is untagged, select only exact tag IDs supplied in availableQuestionTags.

Suggestions:
- Suggest only bounded edits that directly resolve one finding.
- Suggestions are atomic patch sets. Preserve exact UUIDs from the input.
- Set application="auto_apply" only for a safe, bounded, high-confidence correction that does not need staff judgment. Re-keying is auto-applicable only when the blind solution and moderation agree on one uniquely defensible option with very high confidence.
- Set application="approval_required" for meaning-changing or destructive edits, including replacing a question or adding/removing/reordering questions or options.
- Do not rewrite a whole passage or multi-question stem. Recommend exclusion instead.
- set_answer_key may re-key an existing option.
- replace_option_and_key may replace one distractor when all supplied options are wrong.
- set_text may fill an empty explanation or replace an entire bounded text field.
- Structural patches must contain the complete resulting question/option content needed for one-click application.
- replace_text must quote an exact existing sentence or phrase as beforeText and its bounded replacement as afterText. The beforeText must exist wholly inside one paragraph or one list item; never span rich-text blocks or infer missing spaces where block boundaries are serialized.
- set_metadata may update a supported field only when the correction is clear.
- update_visual_spec may edit semantic visual JSON only, never raw SVG. Prefer presentation settings first; if fairness still requires it, patch the examinable wording/options or semantic data consistently.
- Omit a suggestion when a safe bounded patch cannot be expressed.

Allowed patch JSON shapes (use only these exact operations/field names):
- {"operation":"replace_text","target":{"kind":"stem|question|option","id":"uuid or null","field":"stem_text|question_text|answer_text|answer_explanation"},"beforeText":"exact existing text","afterText":"replacement"}
- {"operation":"set_text","target":{"kind":"stem|question|option","id":"uuid or null","field":"stem_text|question_text|answer_text|answer_explanation"},"beforeText":"current plain text or null","afterText":"complete replacement"}
- {"operation":"set_answer_key","questionId":"uuid","currentCorrectOptionId":"currently keyed uuid or null","correctOptionId":"uuid"}
- {"operation":"replace_option_and_key","questionId":"uuid","optionId":"uuid","beforeAnswerText":"exact current option text","answerText":"replacement answer","answerExplanation":"optional explanation or null"}
- {"operation":"replace_question","questionId":"uuid","beforeQuestionText":"exact current question text","question":{"questionText":"replacement","questionType":"multiple_choice|syllogism","answerExplanation":"string or null","difficulty":0.0,"timeBurdenSeconds":60,"tagIds":["uuid"],"options":[{"id":"existing uuid or null","answerText":"text","answerExplanation":"string or null","isAnswer":true}]}}
- {"operation":"insert_question","afterQuestionId":"uuid or null","question":{/* complete question as above */}}
- {"operation":"remove_question","questionId":"uuid","beforeQuestionText":"exact current question text"}
- {"operation":"insert_option","questionId":"uuid","afterOptionId":"uuid or null","option":{"id":null,"answerText":"text","answerExplanation":"string or null","isAnswer":false}}
- {"operation":"remove_option","questionId":"uuid","optionId":"uuid","beforeAnswerText":"exact current answer text"}
- {"operation":"reorder_options","questionId":"uuid","optionIds":["every existing option uuid in final order"]}
- {"operation":"set_metadata","targetKind":"stem|question","targetId":"uuid","field":"section_id|category_id|difficulty|time_burden_seconds|tag_ids|question_type","before":null,"after":null}
- {"operation":"update_visual_spec","target":{"kind":"stem|question|option","id":"uuid or null","field":"stem_text|question_text|answer_text|answer_explanation"},"imageIndex":0,"visualType":"venn_diagram|set_diagram|vega_lite_chart","beforeSpec":{},"afterSpec":{},"title":null,"altText":null}

When returning a suggestion, use:
{"id":"stable suggestion id","summary":"bounded edit","rationale":"why it resolves the finding","application":"auto_apply|approval_required","patches":[/* one or more allowed patches */]}

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
      "recommendedAction": "fix|review|exclude",
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
    stemText: reviewText(params.snapshot.stemText, params.snapshot.stemTextPlain),
    images: imageMetadata(params.snapshot, false),
    visualAvailability: params.visualAvailability ?? [],
    questions: params.snapshot.questions
      .filter((question) => target.has(question.id))
      .map((question) => ({
        questionId: question.id,
        questionIndex: question.index,
        questionType: question.questionType,
        questionText: reviewText(question.questionText, question.questionTextPlain),
        options: question.options.map((option) => ({
          optionId: option.id,
          optionIndex: option.index,
          answerText: reviewText(option.answerText, option.answerTextPlain),
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
  availableQuestionTags?: Array<{ id: string; name: string }>
  visualAvailability?: Array<{ label: string; inspectable: boolean; renderedStudentWidth: number | null; error: string | null }>
}): string {
  const target = new Set(params.targetQuestionIds)
  const questions = params.snapshot.questions
    .filter((question) => target.has(question.id))
    .map((question) => ({
      questionId: question.id,
      questionIndex: question.index,
      questionType: question.questionType,
      questionText: reviewText(question.questionText, question.questionTextPlain),
      keyedAnswer: question.questionType === 'syllogism'
        ? question.options.map((option) => ({ optionId: option.id, answer: option.isAnswer ? 'yes' : 'no' }))
        : question.options.find((option) => option.isAnswer)?.id ?? null,
      answerExplanation: question.answerExplanationPlain
        ? reviewText(question.answerExplanation, question.answerExplanationPlain)
        : null,
      claimedDifficulty: question.difficulty,
      claimedTimeBurdenSeconds: question.timeBurdenSeconds,
      tags: question.tagNames,
      options: question.options.map((option) => ({
        optionId: option.id,
        optionIndex: option.index,
        answerText: reviewText(option.answerText, option.answerTextPlain),
        answerExplanation: option.answerExplanationPlain
          ? reviewText(option.answerExplanation, option.answerExplanationPlain)
          : null,
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
    stemText: reviewText(params.snapshot.stemText, params.snapshot.stemTextPlain),
    visualEvidence: imageMetadata(params.snapshot, true),
    visualAvailability: params.visualAvailability ?? [],
    deterministicFormatWarnings: params.formatChecks.filter((check) => check.severity === 'warning'),
    availableQuestionTags: params.availableQuestionTags ?? [],
    blindSolution: params.blindSolution,
    questions,
    requiredCategoryCoverage: {
      shared: params.includeSharedAssessment
        ? ['presentation_integrity', 'ucat_suitability']
        : [],
      eachQuestion: [
        'presentation_integrity',
        'ucat_suitability',
        'difficulty_timing',
        'answer_correctness_fairness',
        'explanation_quality',
      ],
    },
  }, null, 2)
}

function normSection(value: string): string {
  return value.toLowerCase().replace(/\s+/gu, ' ').trim()
}
