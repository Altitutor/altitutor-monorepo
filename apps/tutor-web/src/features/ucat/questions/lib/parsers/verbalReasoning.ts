import type { Json } from '@altitutor/shared'
import {
  tokenizedPlainTextToProseMirrorWithLineBreaks,
} from '@/features/ucat/shared/lib/rich-text'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
  collectLogicalLinesFromDoc,
  parseFromLines,
  type ParsedStem,
  type ParserConfig,
} from '@/features/ucat/questions/lib/parsers/core'

export type { ParsedStem, ParsedOption, ParsedQuestion } from '@/features/ucat/questions/lib/parsers/core'
export { collectLogicalLinesFromDoc } from '@/features/ucat/questions/lib/parsers/core'

export type VerbalReasoningParserConfig = ParserConfig

function toRichText(text: string): Json {
  return tokenizedPlainTextToProseMirrorWithLineBreaks(text) as Json
}

const APOSTROPHE_LIKE_RE = /[\u0027\u2018\u2019\u201A\u201B\u2032\u2035]/g

function normaliseOptionTextForCategory(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(APOSTROPHE_LIKE_RE, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * For Verbal Reasoning: if any question in the stem has answer options exactly
 * "True", "False", and "Can't Tell" (ignoring case, spaces, punctuation, order),
 * return "True, False, Can't Tell"; otherwise "Reading Comprehension".
 */
export function getVerbalReasoningStemCategoryName(
  stem: ParsedStem
): 'True, False, Can\'t Tell' | 'Reading Comprehension' {
  for (const q of stem.questions) {
    const optionSet = new Set(q.options.map((opt) => normaliseOptionTextForCategory(opt.text)))
    if (
      optionSet.size === 3 &&
      optionSet.has('true') &&
      optionSet.has('false') &&
      optionSet.has('cant tell')
    ) {
      return 'True, False, Can\'t Tell'
    }
  }
  return 'Reading Comprehension'
}

export type VerbalReasoningToFormOptions = {
  sectionId: string
  categoryId?: string | null
  getCategoryIdForStem?: (stem: ParsedStem) => string | null
  getTagIdsForQuestion?: (args: {
    stem: ParsedStem
    question: ParsedStem['questions'][number]
  }) => string[]
  accessScope?: 'public' | 'private'
}

export function parseVerbalReasoningFromLines(
  rawLines: string[],
  configOverrides?: Partial<ParserConfig>
): ParsedStem[] {
  return parseFromLines(rawLines, configOverrides)
}

export function parseVerbalReasoningPlainText(
  input: string,
  configOverrides?: Partial<ParserConfig>
): ParsedStem[] {
  const rawLines = input.split(/\r?\n/u)
  return parseFromLines(rawLines, configOverrides)
}

export function parseVerbalReasoningFromDoc(
  doc: Json | null | undefined,
  configOverrides?: Partial<ParserConfig>
): ParsedStem[] {
  const logicalLines = collectLogicalLinesFromDoc(doc, {
    detectNestedQuestionTables: true,
  })
  return parseFromLines(logicalLines, configOverrides)
}

/**
 * Map parsed Verbal Reasoning stems into UcatQuestionStemFormValues.
 * All questions are multiple_choice; category comes from getVerbalReasoningStemCategoryName.
 */
export function mapParsedVerbalReasoningToFormValues(
  stems: ParsedStem[],
  options: VerbalReasoningToFormOptions
): UcatQuestionStemFormValues[] {
  const {
    sectionId,
    categoryId = null,
    getCategoryIdForStem,
    getTagIdsForQuestion,
    accessScope = 'public',
  } = options

  const result: UcatQuestionStemFormValues[] = []

  for (const stem of stems) {
    if (stem.stemText.trim().length === 0 || stem.questions.length === 0) continue

    const questions = stem.questions
      .filter((q) => q.text.trim().length > 0 && q.options.length > 0)
      .map((q) => ({
        questionText: toRichText(q.text),
        responseType: 'multiple_choice' as const,
        answerScheme: 'single_choice' as const,
        answerExplanation: null,
        difficulty: null,
        timeBurdenSeconds: '',
        tagIds: getTagIdsForQuestion?.({ stem, question: q }) ?? [],
        options: q.options.map((opt) => ({
          answerText: toRichText(opt.text),
          answerExplanation: null,
          answerKeyValue: null,
        })),
      }))

    if (questions.length === 0) continue

    const resolvedCategoryId =
      getCategoryIdForStem != null ? getCategoryIdForStem(stem) : categoryId

    result.push({
      sectionId,
      categoryId: resolvedCategoryId ?? null,
      stemText: tokenizedPlainTextToProseMirrorWithLineBreaks(stem.stemText) as Json,
      accessScope,
      questions,
    })
  }

  return result
}

function normalizedText(value: string): string {
  return value
    .replace(/[−–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function hasAny(text: string, patterns: Array<string | RegExp>): boolean {
  return patterns.some((pattern) =>
    typeof pattern === 'string' ? text.includes(pattern.toLowerCase()) : pattern.test(text)
  )
}

function hasScanAnchor(rawText: string): boolean {
  const withoutLeadingQuestionWord = rawText.replace(
    /^\s*(?:Which|What|When|Where|Why|How|If|Suppose)\b/,
    ''
  )
  return (
    /\b\d+(?:[.,]\d+)?%?\b/.test(withoutLeadingQuestionWord) ||
    /["'][^"']+["']/.test(withoutLeadingQuestionWord) ||
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/.test(withoutLeadingQuestionWord)
  )
}

type VerbalReasoningTagRule = {
  path: string[]
  patterns?: Array<string | RegExp>
  matches?: (args: {
    text: string
    questionText: string
    rawQuestionText: string
    optionText: string
    stemText: string
  }) => boolean
}

const VR_TAG_RULES: VerbalReasoningTagRule[] = [
  {
    path: ['Evidence handling', 'Detail retrieval'],
    patterns: [
      /\baccording to (?:the )?(?:passage|text|author|paragraph)\b/,
      /\b(?:states?|mentions?|describes?|identifies?|reports?|explains?)\b/,
      /\bwhich (?:of the following )?(?:statement|option|detail|event|person|group|factor)\b/,
      /\bwhat (?:does|did|was|were|is|are)\b/,
    ],
    matches: ({ questionText, rawQuestionText }) =>
      hasScanAnchor(rawQuestionText) &&
      !hasAny(questionText, [
        /\b(?:paragraphs?|paras?)\s+\d+\s+(?:and|to|through|-)\s+\d+\b/,
        /\bacross (?:the )?(?:passage|text|paragraphs?)\b/,
        /\bthe passage as a whole\b/,
      ]),
  },
  {
    path: ['Evidence handling', 'Paraphrasing'],
    patterns: [
      /\b(?:closest|nearest) in meaning\b/,
      /\bbest (?:expresses|captures|describes|matches|reflects|restates)\b/,
      /\b(?:paraphrase|restatement|rewording|equivalent)\b/,
      /\bcan be understood as\b/,
    ],
  },
  {
    path: ['Evidence handling', 'Inference'],
    patterns: [
      /\b(?:infer|inferred|inference|implies|implied|suggests?|suggested)\b/,
      /\b(?:conclude|concluded|conclusion|deduce|deduced)\b/,
      /\bmost likely\b/,
      /\bcan be taken to mean\b/,
    ],
  },
  {
    path: ['Evidence handling', "Insufficient information / Can't tell"],
    patterns: [
      /\bcan'?t tell\b/,
      /\bcannot (?:be )?(?:tell|told|determine|conclude|inferred?)\b/,
      /\bnot (?:given|stated|provided|enough information)\b/,
      /\binsufficient information\b/,
    ],
  },
  {
    path: ['Evidence handling', 'Word or phrase reference'],
    patterns: [
      /\b(?:word|phrase|term|expression)\b.*\b(?:mean|means|meaning|refer|refers|reference)\b/,
      /\b(?:it|this|that|they|them|these|those)\b.*\b(?:refer|refers|reference)\b/,
      /\bthe quoted (?:word|phrase|term)\b/,
    ],
  },
  {
    path: ['Evidence handling', 'Cross-paragraph evidence'],
    patterns: [
      /\b(?:paragraphs?|paras?)\s+\d+\s+(?:and|to|through|-)\s+\d+\b/,
      /\bacross (?:the )?(?:passage|text|paragraphs?)\b/,
      /\bin more than one paragraph\b/,
      /\bmultiple (?:parts|paragraphs|sections)\b/,
      /\bthe passage as a whole\b/,
    ],
  },
  {
    path: ['Author and passage meaning', 'Main idea / summary'],
    patterns: [
      /\bmain (?:idea|point|theme|message)\b/,
      /\bbest (?:summary|summarises|summarizes|title)\b/,
      /\boverall (?:meaning|message|point)\b/,
      /\bthe passage is mainly about\b/,
      /\bprimary focus\b/,
    ],
  },
  {
    path: ['Author and passage meaning', 'Author purpose or attitude'],
    patterns: [
      /\bauthor'?s (?:purpose|attitude|tone|view|opinion|intention|stance)\b/,
      /\bwriter'?s (?:purpose|attitude|tone|view|opinion|intention|stance)\b/,
      /\bthe author (?:believes|argues|claims|suggests|intends|seems)\b/,
      /\btone of (?:the )?(?:passage|author|writer)\b/,
    ],
  },
  {
    path: ['Author and passage meaning', 'Opinion vs fact'],
    patterns: [
      /\bopinion\b/,
      /\bfact\b/,
      /\bobjective\b/,
      /\bsubjective\b/,
      /\bclaim\b/,
    ],
  },
  {
    path: ['Author and passage meaning', 'Argument support'],
    patterns: [
      /\b(?:support|supports|supported|supporting)\b/,
      /\b(?:strengthen|strengthens|weaken|weakens)\b/,
      /\b(?:argument|claim|evidence|reasoning)\b/,
      /\bbest evidence\b/,
    ],
  },
  {
    path: ['Question wording traps', 'Qualifiers'],
    patterns: [
      /\b(?:all|always|never|only|none|no|every|must|necessarily|entirely|solely)\b/,
      /\b(?:most|some|many|few|mainly|generally|usually|at least|at most|no more than|no less than)\b/,
    ],
  },
  {
    path: ['Question wording traps', 'Negatives'],
    patterns: [
      /\b(?:not|except|least|false|incorrect|cannot|doesn'?t|isn'?t|aren'?t|wasn'?t|weren'?t)\b/,
      /\bwhich .* is not\b/,
    ],
  },
  {
    path: ['Question wording traps', 'Long statement'],
    matches: ({ questionText }) => questionText.length >= 130,
  },
  {
    path: ['Question wording traps', 'No clear keyword'],
    patterns: [
      /\bwhich (?:of the following )?(?:statements?|options?) is (?:best|most) (?:supported|accurate|likely)\b/,
      /\bwhat can be (?:inferred|concluded)\b/,
      /\bthe passage as a whole\b/,
    ],
    matches: ({ rawQuestionText }) => !hasScanAnchor(rawQuestionText),
  },
  {
    path: ['Application', 'New information'],
    patterns: [
      /\bnew information\b/,
      /\badditional information\b/,
      /\bnew evidence\b/,
      /\bnew finding\b/,
      /\bif it (?:were|was) found that\b/,
    ],
  },
  {
    path: ['Application', 'Hypothetical application'],
    patterns: [
      /\bif\b.*\b(?:would|could|might|should)\b/,
      /\bsuppose\b/,
      /\bhypothetical\b/,
      /\bscenario\b/,
      /\bwere to\b/,
    ],
  },
]

export function getVerbalReasoningTagPathsForQuestion(args: {
  stem: ParsedStem
  question: ParsedStem['questions'][number]
}): string[][] {
  const rawQuestionText = args.question.text.trim()
  const optionText = args.question.options.map((opt) => opt.text).join(' ')
  const text = normalizedText(`${args.stem.stemText} ${rawQuestionText} ${optionText}`)
  const questionText = normalizedText(rawQuestionText)
  const matched = VR_TAG_RULES.filter((rule) => {
    const patternMatches = rule.patterns ? hasAny(questionText, rule.patterns) : false
    const predicateMatches = rule.matches?.({
      text,
      questionText,
      rawQuestionText,
      optionText: normalizedText(optionText),
      stemText: normalizedText(args.stem.stemText),
    }) ?? false
    if (rule.patterns && rule.matches) return patternMatches && predicateMatches
    return patternMatches || predicateMatches
  }).map((rule) => rule.path)

  return matched.filter(
    (path) =>
      !matched.some(
        (other) =>
          other.length > path.length &&
          path.every((part, index) => other[index] === part)
      )
  )
}
