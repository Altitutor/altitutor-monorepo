export type BlueprintSectionCode =
  | 'verbal_reasoning'
  | 'decision_making'
  | 'quantitative_reasoning'
  | 'situational_judgement'

export type StemPresentationFormat =
  | 'passage'
  | 'table'
  | 'graph_or_chart'
  | 'diagram_or_image'
  | 'mixed'
  | 'other'

export type BlueprintAnswerScheme =
  | 'single_choice'
  | 'situational_judgement_rating'
  | 'decision_making_binary_placement'
  | 'situational_judgement_most_least'

export interface BlueprintQuestion {
  id: string
  answerScheme: BlueprintAnswerScheme
  optionCount: number
  requiredPlacementCount: number
}

export interface BlueprintStem {
  id: string
  category: string
  presentationFormat: StemPresentationFormat | null
  questions: BlueprintQuestion[]
}

export interface BlueprintSectionComposition {
  section: BlueprintSectionCode
  answeringTimeSeconds: number
  instructionTimeSeconds: number
  stems: BlueprintStem[]
}

export interface BlueprintComposition {
  purpose: 'full_mock' | 'focused_practice'
  sections: BlueprintSectionComposition[]
}

interface Range {
  min: number
  max: number
  preferred?: number
}

type CategoryRule = Range & { unit: 'questions' | 'stems' } & (
  | { category: string; answerScheme?: never; label?: string }
  | { category?: never; answerScheme: BlueprintAnswerScheme; label: string }
)

interface PresentationRule extends Range {
  category: string
  formats: StemPresentationFormat[]
  unit: 'questions'
}

type StructureRule = Range & (
  | {
    kind: 'stem_count'
    label: string
    questionCardinality: 'single' | 'multiple'
  }
  | {
    kind: 'questions_per_stem'
    label: string
  }
)

interface ResponseContractRule {
  answerScheme: BlueprintAnswerScheme
  section: BlueprintSectionCode
  questionsPerStem: number
  optionCount: number
  requiredPlacementCount: number
}

export interface UcatBlueprint {
  readonly id: string
  readonly testYear: number
  readonly version: number
  readonly official: {
    readonly label: string
    readonly sections: readonly {
      readonly section: BlueprintSectionCode
      readonly questionCount: number
      readonly answeringTimeSeconds: number
      readonly instructionTimeSeconds: number
    }[]
  }
  readonly altitutorPolicy: {
    readonly label: string
    readonly sectionRules: readonly {
      readonly section: BlueprintSectionCode
      readonly exactStemCount?: number
      readonly categoryRules?: readonly CategoryRule[]
      readonly presentationRules?: readonly PresentationRule[]
      readonly structureRules?: readonly StructureRule[]
      readonly responseContractRules?: readonly ResponseContractRule[]
    }[]
  }
}

const sectionLabels: Record<BlueprintSectionCode, string> = {
  verbal_reasoning: 'Verbal Reasoning',
  decision_making: 'Decision Making',
  quantitative_reasoning: 'Quantitative Reasoning',
  situational_judgement: 'Situational Judgement',
}

const deepFreeze = <T extends object>(value: T): Readonly<T> => {
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child)
    }
  }
  return Object.freeze(value)
}

export const UCAT_ANZ_2026_V1 = deepFreeze<UcatBlueprint>({
  id: 'ucat-anz-2026-v1',
  testYear: 2026,
  version: 1,
  official: {
    label: 'Official UCAT ANZ 2026 exact totals and timings',
    sections: [
      { section: 'verbal_reasoning', questionCount: 44, answeringTimeSeconds: 1320, instructionTimeSeconds: 90 },
      { section: 'decision_making', questionCount: 35, answeringTimeSeconds: 2220, instructionTimeSeconds: 90 },
      { section: 'quantitative_reasoning', questionCount: 36, answeringTimeSeconds: 1560, instructionTimeSeconds: 120 },
      { section: 'situational_judgement', questionCount: 69, answeringTimeSeconds: 1560, instructionTimeSeconds: 90 },
    ],
  },
  altitutorPolicy: {
    label: 'Altitutor-authored composition policy',
    sectionRules: [
      {
        section: 'verbal_reasoning',
        exactStemCount: 11,
        categoryRules: [
          { category: 'Reading Comprehension', unit: 'stems', min: 7, max: 9 },
          { category: "True, False, Can't Tell", unit: 'stems', min: 2, max: 4 },
        ],
      },
      {
        section: 'decision_making',
        categoryRules: [
          { category: 'Syllogisms', unit: 'questions', min: 5, max: 7 },
          { category: 'Logical Puzzles', unit: 'questions', min: 5, max: 6 },
          { category: 'Recognising Assumptions', unit: 'questions', min: 3, max: 5, preferred: 4 },
          { category: 'Interpreting Information and Drawing Conclusions', unit: 'questions', min: 5, max: 6 },
          { category: 'Venn Diagrams', unit: 'questions', min: 7, max: 9, preferred: 8 },
          { category: 'Probabilistic and Statistical Reasoning', unit: 'questions', min: 4, max: 6, preferred: 5 },
        ],
        presentationRules: [
          {
            category: 'Interpreting Information and Drawing Conclusions',
            formats: ['passage'],
            unit: 'questions',
            min: 3,
            max: 4,
          },
          {
            category: 'Interpreting Information and Drawing Conclusions',
            formats: ['table', 'graph_or_chart'],
            unit: 'questions',
            min: 1,
            max: 2,
          },
        ],
      },
      {
        section: 'quantitative_reasoning',
        structureRules: [
          { kind: 'stem_count', label: 'Multi-question stems', questionCardinality: 'multiple', min: 7, max: 8 },
          { kind: 'stem_count', label: 'Single-question stems', questionCardinality: 'single', min: 4, max: 8 },
        ],
      },
      {
        section: 'situational_judgement',
        categoryRules: [
          { category: 'Most/Least Appropriate', unit: 'questions', min: 2, max: 4, preferred: 3 },
          { answerScheme: 'situational_judgement_rating', label: 'Rating questions', unit: 'questions', min: 65, max: 67, preferred: 66 },
        ],
        structureRules: [
          { kind: 'questions_per_stem', label: 'Questions in scenario stem', min: 1, max: 6 },
        ],
        responseContractRules: [
          {
            answerScheme: 'situational_judgement_most_least',
            section: 'situational_judgement',
            questionsPerStem: 1,
            optionCount: 3,
            requiredPlacementCount: 2,
          },
        ],
      },
    ],
  },
})

export type BlueprintReasonCode =
  | 'FOCUSED_PRACTICE_EXEMPT'
  | 'SECTION_MISSING'
  | 'SECTION_DUPLICATE'
  | 'SECTION_ORDER_INVALID'
  | 'QUESTION_TOTAL_MISMATCH'
  | 'ANSWERING_TIME_MISMATCH'
  | 'INSTRUCTION_TIME_MISMATCH'
  | 'STEM_TOTAL_MISMATCH'
  | 'CATEGORY_QUESTION_COUNT_OUT_OF_RANGE'
  | 'CATEGORY_STEM_COUNT_OUT_OF_RANGE'
  | 'PRESENTATION_QUESTION_COUNT_OUT_OF_RANGE'
  | 'QR_MULTI_STEM_COUNT_OUT_OF_RANGE'
  | 'QR_SINGLE_STEM_COUNT_OUT_OF_RANGE'
  | 'SJT_SCENARIO_QUESTION_LIMIT_EXCEEDED'
  | 'MOST_LEAST_STEM_QUESTION_COUNT_INVALID'
  | 'MOST_LEAST_ACTION_COUNT_INVALID'
  | 'MOST_LEAST_REQUIRED_PLACEMENTS_INVALID'
  | 'DUPLICATE_STEM_ID'
  | 'DUPLICATE_QUESTION_ID'

export interface BlueprintReason {
  code: BlueprintReasonCode
  severity: 'error' | 'information'
  message: string
  section?: BlueprintSectionCode
  stemId?: string
  questionId?: string
  actual?: number
  minimum?: number
  maximum?: number
  expected?: number
}

export interface BlueprintSectionEvaluation {
  section: BlueprintSectionCode
  questions: number
  stems: number
  placements: number
}

export interface BlueprintCheck {
  code: Exclude<BlueprintReasonCode,
    | 'FOCUSED_PRACTICE_EXEMPT'
    | 'SECTION_MISSING'
    | 'SECTION_DUPLICATE'
    | 'SECTION_ORDER_INVALID'
    | 'DUPLICATE_STEM_ID'
    | 'DUPLICATE_QUESTION_ID'>
  source: 'official' | 'altitutor'
  section: BlueprintSectionCode
  label: string
  unit: 'questions' | 'stems' | 'seconds' | 'actions' | 'placements'
  actual: number
  compliant: boolean
  expected?: number
  minimum?: number
  maximum?: number
  stemId?: string
  questionId?: string
}

export interface BlueprintEvaluation {
  applicable: boolean
  compliant: boolean
  blueprintId: string
  totals: { questions: number; stems: number; placements: number }
  sections: BlueprintSectionEvaluation[]
  checks: BlueprintCheck[]
  reasons: BlueprintReason[]
}

const formatNumber = (value: number): string => value.toLocaleString('en-AU')

const totalQuestions = (stems: BlueprintStem[]): number =>
  stems.reduce((total, stem) => total + stem.questions.length, 0)

const totalPlacements = (stems: BlueprintStem[]): number =>
  stems.reduce(
    (stemTotal, stem) =>
      stemTotal + stem.questions.reduce((questionTotal, question) => questionTotal + question.requiredPlacementCount, 0),
    0,
  )

const rangeReason = (
  code: Extract<BlueprintReasonCode,
    | 'CATEGORY_QUESTION_COUNT_OUT_OF_RANGE'
    | 'CATEGORY_STEM_COUNT_OUT_OF_RANGE'
    | 'PRESENTATION_QUESTION_COUNT_OUT_OF_RANGE'
    | 'QR_MULTI_STEM_COUNT_OUT_OF_RANGE'
    | 'QR_SINGLE_STEM_COUNT_OUT_OF_RANGE'>,
  section: BlueprintSectionCode,
  label: string,
  actual: number,
  range: Range,
): BlueprintReason => ({
  code,
  severity: 'error',
  section,
  actual,
  minimum: range.min,
  maximum: range.max,
  message: `${sectionLabels[section]} ${label} must be between ${range.min} and ${range.max}; found ${actual}.`,
})

export function evaluateBlueprint(
  blueprint: UcatBlueprint,
  composition: BlueprintComposition,
): BlueprintEvaluation {
  const sections = composition.sections.map(section => ({
    section: section.section,
    questions: totalQuestions(section.stems),
    stems: section.stems.length,
    placements: totalPlacements(section.stems),
  }))
  const totals = sections.reduce(
    (result, section) => ({
      questions: result.questions + section.questions,
      stems: result.stems + section.stems,
      placements: result.placements + section.placements,
    }),
    { questions: 0, stems: 0, placements: 0 },
  )

  if (composition.purpose === 'focused_practice') {
    return {
      applicable: false,
      compliant: true,
      blueprintId: blueprint.id,
      totals,
      sections,
      checks: [],
      reasons: [{
        code: 'FOCUSED_PRACTICE_EXEMPT',
        severity: 'information',
        message: 'Focused practice sets are outside full-mock blueprint compliance.',
      }],
    }
  }

  const reasons: BlueprintReason[] = []
  const checks: BlueprintCheck[] = []
  const expectedOrder = blueprint.official.sections.map(section => section.section)
  const actualOrder = composition.sections.map(section => section.section)
  if (actualOrder.join('|') !== expectedOrder.join('|')) {
    reasons.push({
      code: 'SECTION_ORDER_INVALID',
      severity: 'error',
      message: `Full mocks must contain sections in this order: ${expectedOrder.map(section => sectionLabels[section]).join(', ')}.`,
    })
  }

  for (const official of blueprint.official.sections) {
    const matches = composition.sections.filter(section => section.section === official.section)
    if (matches.length === 0) {
      reasons.push({
        code: 'SECTION_MISSING',
        severity: 'error',
        section: official.section,
        message: `${sectionLabels[official.section]} is missing from the full mock.`,
      })
      continue
    }
    if (matches.length > 1) {
      reasons.push({
        code: 'SECTION_DUPLICATE',
        severity: 'error',
        section: official.section,
        actual: matches.length,
        expected: 1,
        message: `${sectionLabels[official.section]} must appear once; found ${matches.length} sections.`,
      })
      continue
    }

    const section = matches[0]
    if (!section) continue
    const questionCount = totalQuestions(section.stems)
    checks.push({
      code: 'QUESTION_TOTAL_MISMATCH',
      source: 'official',
      section: official.section,
      label: 'Candidate-visible question total',
      unit: 'questions',
      actual: questionCount,
      expected: official.questionCount,
      compliant: questionCount === official.questionCount,
    })
    if (questionCount !== official.questionCount) {
      reasons.push({
        code: 'QUESTION_TOTAL_MISMATCH',
        severity: 'error',
        section: official.section,
        actual: questionCount,
        expected: official.questionCount,
        message: `${sectionLabels[official.section]} must contain exactly ${official.questionCount} candidate-visible questions; found ${questionCount}.`,
      })
    }
    if (section.answeringTimeSeconds !== official.answeringTimeSeconds) {
      reasons.push({
        code: 'ANSWERING_TIME_MISMATCH',
        severity: 'error',
        section: official.section,
        actual: section.answeringTimeSeconds,
        expected: official.answeringTimeSeconds,
        message: `${sectionLabels[official.section]} answering time must be exactly ${formatNumber(official.answeringTimeSeconds)} seconds; found ${formatNumber(section.answeringTimeSeconds)}.`,
      })
    }
    checks.push({
      code: 'ANSWERING_TIME_MISMATCH',
      source: 'official',
      section: official.section,
      label: 'Answering time',
      unit: 'seconds',
      actual: section.answeringTimeSeconds,
      expected: official.answeringTimeSeconds,
      compliant: section.answeringTimeSeconds === official.answeringTimeSeconds,
    })
    if (section.instructionTimeSeconds !== official.instructionTimeSeconds) {
      reasons.push({
        code: 'INSTRUCTION_TIME_MISMATCH',
        severity: 'error',
        section: official.section,
        actual: section.instructionTimeSeconds,
        expected: official.instructionTimeSeconds,
        message: `${sectionLabels[official.section]} instruction time must be exactly ${formatNumber(official.instructionTimeSeconds)} seconds; found ${formatNumber(section.instructionTimeSeconds)}.`,
      })
    }
    checks.push({
      code: 'INSTRUCTION_TIME_MISMATCH',
      source: 'official',
      section: official.section,
      label: 'Instruction time',
      unit: 'seconds',
      actual: section.instructionTimeSeconds,
      expected: official.instructionTimeSeconds,
      compliant: section.instructionTimeSeconds === official.instructionTimeSeconds,
    })

    const policy = blueprint.altitutorPolicy.sectionRules.find(rule => rule.section === official.section)
    if (!policy) continue
    if (policy.exactStemCount !== undefined && section.stems.length !== policy.exactStemCount) {
      reasons.push({
        code: 'STEM_TOTAL_MISMATCH',
        severity: 'error',
        section: official.section,
        actual: section.stems.length,
        expected: policy.exactStemCount,
        message: `${sectionLabels[official.section]} must contain exactly ${policy.exactStemCount} stems; found ${section.stems.length}.`,
      })
    }
    if (policy.exactStemCount !== undefined) {
      checks.push({
        code: 'STEM_TOTAL_MISMATCH',
        source: 'altitutor',
        section: official.section,
        label: 'Stem total',
        unit: 'stems',
        actual: section.stems.length,
        expected: policy.exactStemCount,
        compliant: section.stems.length === policy.exactStemCount,
      })
    }
    for (const rule of policy.categoryRules ?? []) {
      const label = rule.label ?? rule.category ?? 'Answer-scheme questions'
      const actual = rule.answerScheme === undefined
        ? (() => {
            const matchingStems = section.stems.filter(stem => stem.category === rule.category)
            return rule.unit === 'stems' ? matchingStems.length : totalQuestions(matchingStems)
          })()
        : section.stems.reduce(
            (count, stem) => count + (rule.unit === 'stems'
              ? Number(stem.questions.some(question => question.answerScheme === rule.answerScheme))
              : stem.questions.filter(question => question.answerScheme === rule.answerScheme).length),
            0,
          )
      checks.push({
        code: rule.unit === 'stems' ? 'CATEGORY_STEM_COUNT_OUT_OF_RANGE' : 'CATEGORY_QUESTION_COUNT_OUT_OF_RANGE',
        source: 'altitutor',
        section: official.section,
        label,
        unit: rule.unit,
        actual,
        minimum: rule.min,
        maximum: rule.max,
        compliant: actual >= rule.min && actual <= rule.max,
      })
      if (actual < rule.min || actual > rule.max) {
        reasons.push(rangeReason(
          rule.unit === 'stems' ? 'CATEGORY_STEM_COUNT_OUT_OF_RANGE' : 'CATEGORY_QUESTION_COUNT_OUT_OF_RANGE',
          official.section,
          `${label} ${rule.unit}`,
          actual,
          rule,
        ))
      }
    }
    for (const rule of policy.presentationRules ?? []) {
      const matching = section.stems.filter(
        stem => stem.category === rule.category && stem.presentationFormat !== null && rule.formats.includes(stem.presentationFormat),
      )
      const actual = totalQuestions(matching)
      checks.push({
        code: 'PRESENTATION_QUESTION_COUNT_OUT_OF_RANGE',
        source: 'altitutor',
        section: official.section,
        label: `${rule.category}: ${rule.formats.join(' or ')}`,
        unit: 'questions',
        actual,
        minimum: rule.min,
        maximum: rule.max,
        compliant: actual >= rule.min && actual <= rule.max,
      })
      if (actual < rule.min || actual > rule.max) {
        reasons.push(rangeReason(
          'PRESENTATION_QUESTION_COUNT_OUT_OF_RANGE',
          official.section,
          `${rule.category} ${rule.formats.join(' or ')} questions`,
          actual,
          rule,
        ))
      }
    }

    for (const rule of policy.structureRules ?? []) {
      if (rule.kind === 'stem_count') {
        const actual = section.stems.filter(stem =>
          rule.questionCardinality === 'single'
            ? stem.questions.length === 1
            : stem.questions.length > 1,
        ).length
        const code = rule.questionCardinality === 'single'
          ? 'QR_SINGLE_STEM_COUNT_OUT_OF_RANGE'
          : 'QR_MULTI_STEM_COUNT_OUT_OF_RANGE'
        checks.push({
          code,
          source: 'altitutor',
          section: official.section,
          label: rule.label,
          unit: 'stems',
          actual,
          minimum: rule.min,
          maximum: rule.max,
          compliant: actual >= rule.min && actual <= rule.max,
        })
        if (actual < rule.min || actual > rule.max) {
          reasons.push(rangeReason(code, official.section, rule.label.toLocaleLowerCase('en-AU'), actual, rule))
        }
        continue
      }

      for (const stem of section.stems) {
        const compliant = stem.questions.length >= rule.min && stem.questions.length <= rule.max
        checks.push({
          code: 'SJT_SCENARIO_QUESTION_LIMIT_EXCEEDED', source: 'altitutor', section: official.section,
          label: rule.label, unit: 'questions', stemId: stem.id, actual: stem.questions.length,
          minimum: rule.min, maximum: rule.max, compliant,
        })
        if (!compliant) {
          reasons.push({
            code: 'SJT_SCENARIO_QUESTION_LIMIT_EXCEEDED', severity: 'error', section: official.section,
            stemId: stem.id, actual: stem.questions.length, minimum: rule.min, maximum: rule.max,
            message: `${sectionLabels[official.section]} stem ${stem.id} must contain between ${rule.min} and ${rule.max} questions; found ${stem.questions.length}.`,
          })
        }
      }
    }

    for (const rule of (policy.responseContractRules ?? []).filter(rule => rule.section === official.section)) {
      for (const stem of section.stems) {
        const matchingQuestions = stem.questions.filter(question => question.answerScheme === rule.answerScheme)
        if (matchingQuestions.length === 0) continue
        const stemCompliant = stem.questions.length === rule.questionsPerStem
        checks.push({
          code: 'MOST_LEAST_STEM_QUESTION_COUNT_INVALID', source: 'altitutor', section: official.section,
          label: 'Most/Least questions per stem', unit: 'questions', stemId: stem.id,
          actual: stem.questions.length, expected: rule.questionsPerStem, compliant: stemCompliant,
        })
        if (!stemCompliant) {
          reasons.push({
            code: 'MOST_LEAST_STEM_QUESTION_COUNT_INVALID',
            severity: 'error',
            section: official.section,
            stemId: stem.id,
            actual: stem.questions.length,
            expected: rule.questionsPerStem,
            message: `Most/Least Appropriate stem ${stem.id} must contain exactly ${rule.questionsPerStem} candidate-visible question; found ${stem.questions.length}.`,
          })
        }
        for (const question of matchingQuestions) {
          checks.push(
            {
              code: 'MOST_LEAST_ACTION_COUNT_INVALID',
              source: 'altitutor',
              section: official.section,
              label: 'Most/Least actions',
              unit: 'actions',
              stemId: stem.id,
              questionId: question.id,
              actual: question.optionCount,
              expected: rule.optionCount,
              compliant: question.optionCount === rule.optionCount,
            },
            {
              code: 'MOST_LEAST_REQUIRED_PLACEMENTS_INVALID',
              source: 'altitutor',
              section: official.section,
              label: 'Most/Least required placements',
              unit: 'placements',
              stemId: stem.id,
              questionId: question.id,
              actual: question.requiredPlacementCount,
              expected: rule.requiredPlacementCount,
              compliant: question.requiredPlacementCount === rule.requiredPlacementCount,
            },
          )
          if (question.optionCount !== rule.optionCount) {
            reasons.push({
              code: 'MOST_LEAST_ACTION_COUNT_INVALID',
              severity: 'error',
              section: official.section,
              stemId: stem.id,
              questionId: question.id,
              actual: question.optionCount,
              expected: rule.optionCount,
              message: `Most/Least Appropriate question ${question.id} must contain exactly ${rule.optionCount} actions; found ${question.optionCount}.`,
            })
          }
          if (question.requiredPlacementCount !== rule.requiredPlacementCount) {
            reasons.push({
              code: 'MOST_LEAST_REQUIRED_PLACEMENTS_INVALID',
              severity: 'error',
              section: official.section,
              stemId: stem.id,
              questionId: question.id,
              actual: question.requiredPlacementCount,
              expected: rule.requiredPlacementCount,
              message: `Most/Least Appropriate question ${question.id} must require ${rule.requiredPlacementCount} distinct placements; found ${question.requiredPlacementCount}.`,
            })
          }
        }
      }
    }
  }

  const stemIds = new Set<string>()
  const questionIds = new Set<string>()
  for (const section of composition.sections) {
    for (const stem of section.stems) {
      if (stemIds.has(stem.id)) {
        reasons.push({ code: 'DUPLICATE_STEM_ID', severity: 'error', stemId: stem.id, message: `Stem ${stem.id} appears more than once.` })
      }
      stemIds.add(stem.id)
      for (const question of stem.questions) {
        if (questionIds.has(question.id)) {
          reasons.push({ code: 'DUPLICATE_QUESTION_ID', severity: 'error', questionId: question.id, message: `Question ${question.id} appears more than once.` })
        }
        questionIds.add(question.id)
      }
    }
  }

  return {
    applicable: true,
    compliant: reasons.length === 0 && checks.every(check => check.compliant),
    blueprintId: blueprint.id,
    totals,
    sections,
    checks,
    reasons,
  }
}
