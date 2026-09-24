type ExplanationResponseType = 'multiple_choice' | 'drag_and_drop'

type ExplanationPolicyParams = {
  sectionName?: string | null
  responseType?: ExplanationResponseType | null
}

const RESPONSE_TYPE_RULES: Record<ExplanationResponseType, string> = {
  multiple_choice: '- For multiple_choice, provide one non-empty question-level answerExplanation. Also provide option-level explanations for answer choices whenever they add distinct teaching for a student who selected that option. Omit an option-level explanation only when it would merely repeat the question-level explanation without new information.',
  drag_and_drop: '- For drag_and_drop, provide an explanation for every statement or placement item at option level. Add a question-level explanation when it is appropriate to teach a general strategy, technique, or shortcut, without repeating what the option-level explanations already cover.',
}

const SECTION_RULES = {
  decision_making: '- Decision Making explanations should teach the shortest efficient method as a helpful tutor. A direct inference may need only a concise explanation. When the solution has multiple dependent constraints or operations, ordered steps with short titles, a compact table, an elimination grid, or ordered slots may materially help.',
  quantitative_reasoning: '- Quantitative Reasoning explanations should teach the shortest efficient method as a helpful tutor. For one direct calculation, a concise setup, calculation, and conclusion may be clearest. For multiple dependent operations, ordered steps with short titles may help. Use a compact table when comparison is central. Explain calculator use where relevant, prefer mental maths when quicker than calculator entry, and use plus-or-minus estimation when accurate enough to identify the correct answer.',
  verbal_reasoning: '- Verbal Reasoning explanations should identify the specific passage evidence the student should read to arrive at the answer, citing the paragraph number where applicable. Explain how that evidence supports the answer and, where useful, why the strongest distractor misreads or overstates the text.',
  situational_judgement: '- Situational Judgement explanations should explain the principle that makes the keyed response best and why alternatives are less appropriate where useful.',
} as const

const CORE_RULES = `Explanation teaching standard:
- Independently solve and verify the keyed answer before explaining it. Do not invent facts unsupported by the stem or question.
- Write as a helpful tutor teaching the student how to solve this particular question. Keep the explanation concrete and proportionate to the reasoning required.
- Choose the presentation that communicates the reasoning most clearly. Short paragraphs, calculations, headings, lists, tables, equations, elimination grids, or ordered slots are all available when they materially help.
- Across the question-level explanation and any useful option-level explanations, explain why the correct answer is correct and why material distractors fail without repeating the same teaching.
- Only for a very difficult or time-consuming question where skipping would be the better real-exam decision, briefly advise the student to skip and return later.
- Use Australian English spelling and clean human editorial prose. Avoid em dashes, double hyphens, canned transitions, false starts, self-correction, and phrases such as "it is important to note".`

const OUTPUT_CONTRACT = `Explanation output contract:
- Use ordinary prose for ordinary text. Do not expose raw formatting or maths commands to the student.
- Wrap inline LaTeX in \\(...\\) and display LaTeX in \\[...\\]. A currency symbol such as $ is ordinary text, not a maths delimiter.
- Prefer familiar rendered symbols such as ÷, ×, ±, ≈, ≤, and ≥ in simple prose calculations. Use delimited LaTeX when richer mathematical notation materially improves readability.`

function sectionRule(sectionName: string | null | undefined): string | null {
  if (sectionName === 'Decision Making') return SECTION_RULES.decision_making
  if (sectionName === 'Quantitative Reasoning') return SECTION_RULES.quantitative_reasoning
  if (sectionName === 'Verbal Reasoning') return SECTION_RULES.verbal_reasoning
  if (sectionName === 'Situational Judgement') return SECTION_RULES.situational_judgement
  return null
}

function resolveResponseType(params: ExplanationPolicyParams): ExplanationResponseType | null {
  return params.responseType ?? null
}

/**
 * Canonical student-facing explanation policy shared by generation, fill, and review.
 * When a section is known, the returned prompt contains only its relevant section rule.
 */
export function buildUcatExplanationPolicy(params: ExplanationPolicyParams = {}): string {
  const responseType = resolveResponseType(params)
  const responseTypeRules = responseType
    ? [RESPONSE_TYPE_RULES[responseType]]
    : Object.values(RESPONSE_TYPE_RULES)
  const selectedSectionRule = sectionRule(params.sectionName)
  const sectionRules = selectedSectionRule
    ? [selectedSectionRule]
    : Object.values(SECTION_RULES)

  return [CORE_RULES, ...responseTypeRules, ...sectionRules, OUTPUT_CONTRACT].join('\n')
}

export const UCAT_EXPLANATION_POLICY_PROMPT = buildUcatExplanationPolicy()

/** @deprecated Use buildUcatExplanationPolicy for section-aware prompts. */
export const EXPLANATION_TEACHING_RUBRIC = UCAT_EXPLANATION_POLICY_PROMPT
