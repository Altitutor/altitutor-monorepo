import type {
  BlindSolutionResponse,
  UcatAssessmentSnapshot,
  UcatFormatCheck,
} from '@/features/ucat/questions/lib/ai-assessment/schema'
import { UCAT_EXPLANATION_POLICY_PROMPT } from '@/features/ucat/questions/lib/ai-generation/explanation-rubric'
import {
  proseMirrorHasBlockTable,
  proseMirrorToPlainText,
} from '@/features/ucat/shared/lib/rich-text'
import type { Json } from '@altitutor/shared'

type ReviewTextBlock = {
  kind: 'paragraph' | 'bullet_list_item' | 'ordered_list_item' | 'heading' | 'table'
  text: string
}

export const UCAT_AUDIT_CRITERIA_PROMPT = `Audit criteria:
1. Formatting: find malformed tables, squashed or lost line breaks, and other visible formatting defects. Automatically repair them when the intended formatting is clear.
2. Content: decide whether the question is representative of the real UCAT ANZ. Leave strong candidates unchanged, flag weak candidates for tutor review, and recommend exclusion only for probably irrecoverable candidates.
3. Difficulty and timing: set realistic metadata when missing or inaccurate, and judge whether the task itself is appropriately difficult and time-bounded. Time burden is the expected active working time, in whole seconds, for a candidate from the target UCAT cohort to submit a fully correct answer on first exposure, under realistic section timing and without assistance. Assess the question in its authored position within the stem, including the initial reading or subsequent re-reading normally attributable to that position. Difficulty is the estimated proportion of the target UCAT candidate cohort who would answer incorrectly under those same conditions: 0 is easiest and 1 is hardest.
4. Answer correctness: independently solve the question, verify the key is correct and uniquely defensible, and ensure distractors are plausible but fair. Do not require precision beyond what the UCAT calculator or supplied visual can support.
5. Answer explanation quality: apply the shared teaching standard below. Missing explanations, materially wrong teaching, bare answer recaps, and explanations that omit the section-relevant evidence or method fail this dimension.
${UCAT_EXPLANATION_POLICY_PROMPT}
6. Tags: if a question already has tags, do not assess or change them. Otherwise assign the most appropriate supplied tag IDs.`

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
  if (value && proseMirrorHasBlockTable(value)) {
    return {
      plainText,
      blocks,
      structuredDocument: value,
      formattingNote: 'This field contains a structured table. Preserve the ProseMirror document shape. Use set_rich_content with exact before and after documents for bounded table or header repairs.',
    }
  }
  if (blocks.length <= 1) return plainText
  return {
    blocks,
    formattingNote: 'Each array entry is a separate rich-text block. Boundaries between blocks are intentional; do not report missing spaces or punctuation between adjacent entries. List markers are structural and are not literal text for replace_text patches.',
  }
}

export const BLIND_SOLVER_SYSTEM_PROMPT = `You independently solve UCAT ANZ questions for a quality-review system.

Return JSON only. Do not include markdown or prose outside the JSON object.

You are deliberately not given the keyed answer, existing explanations, author rationale, claimed difficulty, or timing. Solve only from the supplied stem, question, answer options, and images.
Keep each justification to one decisive sentence. Do not restate the full question.

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
      "placementAnswers": [{ "optionId": "uuid", "answer": "yes or no" }],
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

${UCAT_AUDIT_CRITERIA_PROMPT}

Ratings are pass, concern, critical, unreviewable, or not_applicable.

Core rules:
- presentation_integrity covers malformed tables, squashed or lost line breaks, rich-text rendering defects, and visual integrity.
- ucat_suitability covers whether the item resembles real UCAT ANZ content, uses appropriate knowledge and professional context, and is worth retaining. Use recommendedAction="exclude" only for probably irrecoverable candidates.
- answer_correctness_fairness requires independent solution, exactly one defensible keyed answer for multiple choice, correct Yes/No conclusions for syllogisms, plausible distractors, and fair discrimination at UCAT calculator/visual precision.
- explanation_quality follows the shared Explanation teaching standard in the audit criteria. Incorrect keys, unsupported objective answers, materially wrong teaching, bare answer recaps, or genuinely unsolvable questions are critical.
- Failed deterministic format checks are supplied separately. Repair every failure that needs content judgment when a coherent repair is possible. Return a complete one-click suggestion rather than merely describing the problem.
- When an option-count check fails, add plausible, mutually exclusive distractors or remove the weakest/redundant options until the exact required count is reached. Independently solve the repaired question, preserve or correct the answer key, and ensure exactly one answer is defensible.
- If a missing explanation is reported, write the complete student-facing lesson to the shared teaching standard. If an existing explanation is correct but too brief to teach the method, replace it with a complete improved explanation.
- Leave a deterministic failure without a suggestion only when the content is genuinely ambiguous, unsolvable, or cannot be safely repaired without rewriting a shared multi-question passage.
- Quantitative Reasoning categories classify information presentation rather than strict question types. Never score or discuss QR category fit.
- For VR, DM, and SJ, assess whether the cognitive task genuinely resembles UCAT after surface format rules have already passed.
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
- set_text may fill an empty explanation or replace an entire bounded text field. For explanations, afterText may use Markdown headings, ordered lists, pipe tables, and display equations; these are converted to structured rich text.
- set_rich_content may replace an exact structured ProseMirror field when structuredDocument is supplied, primarily for bounded table/header repairs. Copy before exactly, preserve unrelated nodes in after, and require approval for meaning-changing edits.
- Structural patches must contain the complete resulting question/option content needed for one-click application.
- replace_text must quote an exact existing sentence or phrase as beforeText and its bounded replacement as afterText. The beforeText must exist wholly inside one paragraph or one list item; never span rich-text blocks or infer missing spaces where block boundaries are serialized.
- set_metadata may update a supported field only when the correction is clear.
- update_visual_spec may edit semantic visual JSON only, never raw SVG. Prefer presentation settings first; if fairness still requires it, patch the examinable wording/options or semantic data consistently.
- Omit a suggestion when a safe bounded patch cannot be expressed.

Allowed patch JSON shapes (use only these exact operations/field names):
- {"operation":"replace_text","target":{"kind":"stem|question|option","id":"uuid or null","field":"stem_text|question_text|answer_text|answer_explanation"},"beforeText":"exact existing text","afterText":"replacement"}
- {"operation":"set_text","target":{"kind":"stem|question|option","id":"uuid or null","field":"stem_text|question_text|answer_text|answer_explanation"},"beforeText":"current plain text or null","afterText":"complete replacement"}
- {"operation":"set_rich_content","target":{"kind":"stem|question|option","id":"uuid or null","field":"stem_text|question_text|answer_text|answer_explanation"},"before":{"type":"doc","content":[]},"after":{"type":"doc","content":[]}}
- {"operation":"set_answer_key","questionId":"uuid","currentCorrectOptionId":"currently keyed uuid or null","correctOptionId":"uuid"}
- {"operation":"replace_option_and_key","questionId":"uuid","optionId":"uuid","beforeAnswerText":"exact current option text","answerText":"replacement answer","answerExplanation":"optional explanation or null"}
- {"operation":"replace_question","questionId":"uuid","beforeQuestionText":"exact current question text","question":{"questionText":"replacement","responseType":"multiple_choice|drag_and_drop","answerScheme":"single_choice|situational_judgement_rating|decision_making_binary_placement|situational_judgement_most_least","answerExplanation":"string or null","difficulty":0.0,"timeBurdenSeconds":60,"tagIds":["uuid"],"options":[{"id":"existing uuid or null","answerText":"text","answerExplanation":"string or null","answerKeyValue":"correct|yes|no|most|least|null"}]}}
- {"operation":"insert_question","afterQuestionId":"uuid or null","question":{/* complete question as above */}}
- {"operation":"remove_question","questionId":"uuid","beforeQuestionText":"exact current question text"}
- {"operation":"insert_option","questionId":"uuid","afterOptionId":"uuid or null","option":{"id":null,"answerText":"text","answerExplanation":"string or null","answerKeyValue":null}}
- {"operation":"remove_option","questionId":"uuid","optionId":"uuid","beforeAnswerText":"exact current answer text"}
- {"operation":"reorder_options","questionId":"uuid","optionIds":["every existing option uuid in final order"]}
- {"operation":"set_metadata","targetKind":"stem|question","targetId":"uuid","field":"section_id|category_id|difficulty|time_burden_seconds|tag_ids|response_type|answer_scheme","before":null,"after":null}
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

export const BULK_IMPORT_AUDIT_REPAIR_SYSTEM_PROMPT = `You independently audit and propose bounded fixes for authored UCAT ANZ questions in a one-click bulk-import workflow. You can see the current key and explanations, but you do not see the independent blind solver's answer.

Return JSON only with exactly two top-level fields: audit and review. audit contains category comments and findings. review contains atomic typed directives and manual findings.

Audit exactly these dimensions: presentation_integrity, ucat_suitability, difficulty_timing, answer_correctness_fairness, and explanation_quality. Check every supplied deterministic failure. Independently reason about the current keyed content, but do not claim agreement with the unseen blind solver.

Be conservative about authored prose. Clear, grammatical, and mathematically unambiguous wording passes even if you would personally phrase it differently. Do not create a finding for style, mild awkwardness, repetition, or a sentence whose intended relationship is already clear. Flag prose only when a concrete error or genuine ambiguity could change how a student interprets or answers the question.

Keep audit prose compact: overall summaries and category summaries should be one sentence, evidence arrays should contain at most two short items, and finding details should state only the concrete defect and required action. Spend output on complete repair content, not repeated commentary.

${UCAT_AUDIT_CRITERIA_PROMPT}

Put every confident bounded correction in review.directives. Each directive contains exactly one patch and one matching kind: explanation for answer_explanation, metadata for set_metadata, answer_key for set_answer_key, visual for update_visual_spec, content for bounded text edits, or structure for option/question structure. Never bundle unrelated changes. Use exact current UUIDs and exact before values. resolvedFindingKeys must contain the audit finding keys resolved by that directive. Use an empty array only for a deterministic issue without an audit finding.

Generate complete teaching explanations where they are missing or weak, following the shared Explanation teaching standard and its section-specific guidance. A correct answer recap is not enough. Formatting-only text repairs, explanations, metadata, tags, answer-key proposals, and option repairs may be proposed. The server independently decides which directives can be applied and requests a blind solve only when answer correctness or meaning requires it. Put genuinely uncertain concerns in review.manualFindings.

Treat difficulty null and timeBurdenSeconds null as unset metadata. A difficulty of 0 is valid and means the easiest endpoint; never treat it as missing. A legacy non-positive timeBurdenSeconds value is invalid and should be repaired. For every target question with unset or invalid metadata, estimate a realistic UCAT difficulty from 0 (easiest) through 1 (hardest) and a positive whole-number time burden in seconds, and emit separate high-confidence set_metadata directives using the exact current before values.

Do not emit whole-question insertion, replacement or removal, broad shared-passage rewrites, or visual-spec edits. You may use set_rich_content only when structuredDocument is supplied and the edit is a bounded repair that preserves unrelated nodes, such as correcting table headers or a short inaccurate title. If source facts cannot be verified from the supplied evidence, leave that uncertainty as a manual finding instead of inventing content. audit findings must use suggestion=null.`

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
        responseType: question.responseType,
        answerScheme: question.answerScheme,
        questionText: reviewText(question.questionText, question.questionTextPlain),
        options: question.options.map((option) => ({
          optionId: option.id,
          optionIndex: option.index,
          answerText: reviewText(option.answerText, option.answerTextPlain),
        })),
      })),
  })
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
      responseType: question.responseType,
      answerScheme: question.answerScheme,
      questionText: reviewText(question.questionText, question.questionTextPlain),
      keyedAnswer: question.responseType === 'drag_and_drop'
        ? question.options.map((option) => ({ optionId: option.id, answer: option.answerKeyValue }))
        : question.options.find((option) => option.answerKeyValue === 'correct')?.id ?? null,
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
        answerKeyValue: option.answerKeyValue,
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
    failedDeterministicFormatChecks: params.formatChecks,
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
  })
}

export function buildIndependentAuditUserPrompt(params: {
  snapshot: UcatAssessmentSnapshot
  targetQuestionIds: string[]
  includeSharedAssessment: boolean
  formatChecks: UcatFormatCheck[]
  availableQuestionTags?: Array<{ id: string; name: string }>
  visualAvailability?: Array<{ label: string; inspectable: boolean; renderedStudentWidth: number | null; error: string | null }>
}): string {
  const payload = JSON.parse(buildAssessmentUserPrompt({
    ...params,
    blindSolution: { solutions: [] },
  })) as Record<string, unknown>
  delete payload.blindSolution
  payload.task = 'Independently audit the current keyed UCAT content without seeing the blind solver output.'
  payload.responseRule = 'Return suggestions as null. Report current-content findings only.'
  payload.responseShape = {
    overallSummary: 'short overall assessment',
    categories: [{
      scopeType: 'shared or question',
      questionId: 'exact question UUID or null for shared scope',
      category: 'one required category key',
      rating: 'pass|concern|critical|unreviewable',
      confidence: 0.95,
      summary: 'specific category assessment',
    }],
    findings: [{
      key: 'stable descriptive key unique within this response',
      scopeType: 'shared or question',
      questionId: 'exact question UUID or null',
      category: 'category key',
      rating: 'concern|critical|unreviewable',
      confidence: 0.95,
      title: 'short title',
      detail: 'actionable explanation',
      evidence: ['specific evidence'],
      recommendedAction: 'fix|review|exclude',
      suggestion: null,
    }],
  }
  return JSON.stringify(payload)
}

function bulkImportAllowedPatchShapes() {
  return [
    {
      operation: 'replace_text',
      target: {
        kind: 'stem|question|option',
        id: 'exact UUID or null for stem',
        field: 'stem_text|question_text|answer_text|answer_explanation',
      },
      beforeText: 'exact existing text',
      afterText: 'bounded replacement text',
    },
    {
      operation: 'set_text',
      target: {
        kind: 'stem|question|option',
        id: 'exact UUID or null for stem',
        field: 'stem_text|question_text|answer_text|answer_explanation',
      },
      beforeText: 'current exact plain text or null',
      afterText: 'complete replacement text',
    },
    {
      operation: 'set_rich_content',
      target: {
        kind: 'stem|question|option',
        id: 'exact UUID or null for stem',
        field: 'stem_text|question_text|answer_text|answer_explanation',
      },
      before: { type: 'doc', content: ['exact structuredDocument content'] },
      after: { type: 'doc', content: ['same document with only the bounded repair'] },
    },
    {
      operation: 'set_answer_key',
      questionId: 'exact question UUID',
      currentCorrectOptionId: 'current option UUID or null',
      correctOptionId: 'replacement option UUID',
    },
    {
      operation: 'replace_option_and_key',
      questionId: 'exact question UUID',
      optionId: 'exact option UUID',
      beforeAnswerText: 'exact current option text',
      answerText: 'replacement option text',
      answerExplanation: 'explanation or null',
    },
    {
      operation: 'insert_option',
      questionId: 'exact question UUID',
      afterOptionId: 'exact option UUID or null',
      option: {
        id: null,
        answerText: 'complete distractor text',
        answerExplanation: 'explanation or null',
        answerKeyValue: null,
      },
    },
    {
      operation: 'remove_option',
      questionId: 'exact question UUID',
      optionId: 'exact option UUID',
      beforeAnswerText: 'exact current option text',
    },
    {
      operation: 'reorder_options',
      questionId: 'exact question UUID',
      optionIds: ['every existing option UUID in final order'],
    },
    {
      operation: 'set_metadata',
      targetKind: 'stem|question',
      targetId: 'exact UUID',
      field: 'difficulty|time_burden_seconds|tag_ids',
      before: 'exact current value',
      after: 'replacement value',
    },
  ]
}

function bulkImportReviewResponseShape() {
  return {
    overallSummary: 'short summary of fixes and any remaining manual work',
    directives: [{
      kind: 'explanation|metadata|answer_key|content|structure|visual',
      summary: 'one bounded change summary',
      rationale: 'why the change is correct',
      confidence: 0.95,
      resolvedFindingKeys: ['exact audit finding key'],
      patch: 'one object copied exactly from allowedPatchShapes',
    }],
    manualFindings: [{
      key: 'stable unresolved finding key',
      scopeType: 'shared or question',
      questionId: 'exact question UUID or null',
      category: 'category key',
      rating: 'concern|critical|unreviewable',
      confidence: 0.8,
      title: 'short title',
      detail: 'why tutor input is still needed',
      evidence: ['specific evidence'],
      recommendedAction: 'review|exclude',
    }],
  }
}

export function buildBulkImportAuditRepairUserPrompt(params: {
  snapshot: UcatAssessmentSnapshot
  targetQuestionIds: string[]
  includeSharedAssessment: boolean
  formatChecks: UcatFormatCheck[]
  availableQuestionTags?: Array<{ id: string; name: string }>
  visualAvailability?: Array<{ label: string; inspectable: boolean; renderedStudentWidth: number | null; error: string | null }>
}): string {
  const payload = JSON.parse(buildIndependentAuditUserPrompt(params)) as Record<string, unknown>
  const auditResponseShape = payload.responseShape
  payload.task = 'Audit the current keyed UCAT content and produce a focused repair plan in the same response.'
  payload.responseRule = 'Return audit findings with suggestion=null. Return each independent change as one typed directive with exactly one patch.'
  payload.allowedPatchShapes = bulkImportAllowedPatchShapes()
  payload.responseShape = {
    audit: auditResponseShape,
    review: bulkImportReviewResponseShape(),
  }
  return JSON.stringify(payload)
}

function normSection(value: string): string {
  return value.toLowerCase().replace(/\s+/gu, ' ').trim()
}
