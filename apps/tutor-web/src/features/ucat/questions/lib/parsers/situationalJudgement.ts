import type { Json } from '@altitutor/shared'
import {
  tokenizedPlainTextToProseMirror,
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

export type SituationalJudgementParserConfig = ParserConfig

export type SituationalJudgementCategoryName = 'How Important' | 'How Appropriate'

/**
 * Get Situational Judgement category name from parsed stem content.
 * Rules: "How Important" if question text contains it; "How Appropriate" if question text contains it.
 * Case insensitive. First match wins. Returns null if neither matches.
 */
export function getSituationalJudgementStemCategoryName(
  stem: ParsedStem
): SituationalJudgementCategoryName | null {
  const textParts = [stem.stemText, ...stem.questions.map((q) => q.text)]
  for (const text of textParts) {
    const lower = text.toLowerCase()
    if (lower.includes('how important')) return 'How Important'
    if (lower.includes('how appropriate')) return 'How Appropriate'
  }
  return null
}

function toRichText(text: string): Json {
  return tokenizedPlainTextToProseMirror(text) as Json
}

export type SituationalJudgementToFormOptions = {
  sectionId: string
  categoryId?: string | null
  getCategoryIdForStem?: (stem: ParsedStem) => string | null
  getTagIdsForQuestion?: (args: {
    stem: ParsedStem
    question: ParsedStem['questions'][number]
  }) => string[]
  isPrivate?: boolean
}

export function parseSituationalJudgementFromLines(
  rawLines: string[],
  configOverrides?: Partial<ParserConfig>
): ParsedStem[] {
  return parseFromLines(rawLines, configOverrides)
}

export function parseSituationalJudgementPlainText(
  input: string,
  configOverrides?: Partial<ParserConfig>
): ParsedStem[] {
  const rawLines = input.split(/\r?\n/u)
  return parseFromLines(rawLines, configOverrides)
}

export function parseSituationalJudgementFromDoc(
  doc: Json | null | undefined,
  configOverrides?: Partial<ParserConfig>
): ParsedStem[] {
  const logicalLines = collectLogicalLinesFromDoc(doc, {
    detectNestedQuestionTables: true,
  })
  return parseFromLines(logicalLines, configOverrides)
}

/**
 * Map parsed Situational Judgement stems into UcatQuestionStemFormValues.
 * All questions are multiple_choice.
 */
export function mapParsedSituationalJudgementToFormValues(
  stems: ParsedStem[],
  options: SituationalJudgementToFormOptions
): UcatQuestionStemFormValues[] {
  const {
    sectionId,
    categoryId = null,
    getCategoryIdForStem,
    getTagIdsForQuestion,
    isPrivate = false,
  } = options

  const result: UcatQuestionStemFormValues[] = []

  for (const stem of stems) {
    if (stem.stemText.trim().length === 0 || stem.questions.length === 0) continue

    const questions = stem.questions
      .filter((q) => q.text.trim().length > 0 && q.options.length > 0)
      .map((q) => ({
        questionText: toRichText(q.text),
        questionType: 'multiple_choice' as const,
        answerExplanation: null,
        difficulty: null,
        timeBurdenSeconds: '',
        tagIds: getTagIdsForQuestion?.({ stem, question: q }) ?? [],
        options: q.options.map((opt) => ({
          answerText: toRichText(opt.text),
          answerExplanation: null,
          isAnswer: false,
        })),
      }))

    if (questions.length === 0) continue

    const resolvedCategoryId =
      getCategoryIdForStem != null ? getCategoryIdForStem(stem) : categoryId

    result.push({
      sectionId,
      categoryId: resolvedCategoryId ?? null,
      stemText: tokenizedPlainTextToProseMirrorWithLineBreaks(stem.stemText) as Json,
      isPrivate,
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

type SituationalJudgementTagRule = {
  path: string[]
  patterns?: Array<string | RegExp>
  matches?: (args: {
    text: string
    stemText: string
    questionText: string
    optionText: string
  }) => boolean
}

const SJ_TAG_RULES: SituationalJudgementTagRule[] = [
  {
    path: ['Patient welfare and safety', 'Patient safety'],
    patterns: [
      /\bpatient safety\b/,
      /\bpatient(?:s)? (?:at )?risk\b/,
      /\bpatient(?:s)?\b.{0,80}\brisk\b/,
      /\brisk to (?:the )?patient\b/,
      /\bcompromise patient safety\b/,
      /\bharm\b/,
      /\bunsafe\b/,
      /\bwound\b/,
      /\bsuturing\b/,
      /\ba&e\b/,
    ],
  },
  {
    path: ['Patient welfare and safety', 'Infection risk'],
    patterns: [
      /\binfection\b/,
      /\binfectious\b/,
      /\billness\b/,
      /\bill\b/,
      /\btonsillitis\b/,
      /\bcontagious\b/,
      /\bsterile\b/,
      /\bsurgery\b/,
      /\bhospital when (?:they|he|she) (?:have|has) been ill\b/,
    ],
  },
  {
    path: ['Patient welfare and safety', 'Scope of competence'],
    patterns: [
      /\bnot (?:actively )?participate\b/,
      /\bnot allowed\b/,
      /\bisn'?t allowed\b/,
      /\boutside (?:his|her|their)? ?(?:scope|competence)\b/,
      /\bscope of (?:practice|competence)\b/,
      /\binduction\b/,
      /\bobserve\b/,
    ],
  },
  {
    path: ['Patient welfare and safety', 'Escalating concerns'],
    patterns: [
      /\balert\b/,
      /\bescalat(?:e|ing)\b/,
      /\breport\b/,
      /\btell (?:the )?(?:professor|demonstrator|supervisor|consultant|doctor|clinical staff|faculty)\b/,
      /\bconcern\b/,
    ],
  },
  {
    path: ['Professional conduct', 'Professionalism'],
    patterns: [
      /\bprofessional(?:ism|ly)?\b/,
      /\bappearance\b/,
      /\bdishevelled\b/,
      /\buntidy\b/,
      /\breputation\b/,
      /\bimage\b/,
      /\bconduct\b/,
    ],
  },
  {
    path: ['Professional conduct', 'Honesty and accountability'],
    patterns: [
      /\bmistake\b/,
      /\berror\b/,
      /\baccountab(?:le|ility)\b/,
      /\bhonest(?:y)?\b/,
      /\badmit\b/,
      /\bcover up\b/,
      /\bplagiar/,
      /\bbreach\b/,
      /\binvalidated\b/,
    ],
  },
  {
    path: ['Professional conduct', 'Confidentiality'],
    patterns: [
      /\bconfidentiality\b/,
      /\bconfidential\b/,
      /\bpatient data\b/,
      /\bpatient information\b/,
      /\breveal(?:ed|ing)?\b/,
      /\bshared?\b.*\b(?:data|information)\b/,
    ],
  },
  {
    path: ['Professional conduct', 'Respect and dignity'],
    patterns: [
      /\brespect\b/,
      /\bdignity\b/,
      /\bembarrass(?:ed|ing|ment)?\b/,
      /\battention\b/,
      /\bcadaver\b/,
      /\bbody\b/,
      /\bprivately\b/,
    ],
  },
  {
    path: ['Professional conduct', 'Following protocol'],
    patterns: [
      /\bprotocol\b/,
      /\brules?\b/,
      /\bguidelines?\b/,
      /\binstruct(?:ed|ion|ions)\b/,
      /\bpolicy\b/,
      /\blab coats?\b/,
      /\bsafety glasses\b/,
      /\bhealth and safety\b/,
    ],
  },
  {
    path: ['Teamwork and communication', 'Speaking up'],
    patterns: [
      /\bspeak (?:to|up)\b/,
      /\bconfront\b/,
      /\bchallenge\b/,
      /\btell\b.*\b(?:that|about)\b/,
      /\bexplain\b/,
      /\bask\b.*\bif\b/,
    ],
  },
  {
    path: ['Teamwork and communication', 'Peer concern'],
    patterns: [
      /\bpeer\b/,
      /\bclassmate\b/,
      /\bfriends?\b/,
      /\bcolleague\b/,
      /\blooks? (?:unwell|tired|pale)\b/,
      /\bfeeling okay\b/,
      /\bget (?:him|her|them) a glass of water\b/,
    ],
  },
  {
    path: ['Teamwork and communication', 'Conflict with colleague'],
    patterns: [
      /\bannoyed\b/,
      /\bfriendship\b/,
      /\brapport\b/,
      /\brelationship\b/,
      /\bcolleague\b/,
      /\bconsultant\b/,
      /\bteam lead\b/,
      /\bcoach\b/,
    ],
  },
  {
    path: ['Teamwork and communication', 'Seeking senior support'],
    patterns: [
      /\bsenior\b/,
      /\bsupervisor\b/,
      /\bprofessor\b/,
      /\bdemonstrator\b/,
      /\bconsultant\b/,
      /\bdoctor\b/,
      /\bnurse\b/,
      /\bfaculty\b/,
      /\badministrator\b/,
      /\bclinical staff\b/,
    ],
  },
  {
    path: ['Teamwork and communication', 'Patient interaction'],
    patterns: [
      /\bpatient interaction\b/,
      /\bpatient contact\b/,
      /\bask the patient\b/,
      /\bexplain to (?:the )?patient\b/,
      /\bpatient raises\b/,
      /\bpatients?\b/,
    ],
  },
  {
    path: ['Personal judgement', 'Workload and prioritisation'],
    patterns: [
      /\bworkload\b/,
      /\bprioritis(?:e|ing|ation)\b/,
      /\bdeadline\b/,
      /\bexams?\b/,
      /\brevision\b/,
      /\bstudy\b/,
      /\bproject\b/,
      /\bextension\b/,
      /\bmanage (?:his|her|their)? ?time\b/,
    ],
  },
  {
    path: ['Personal judgement', 'Wellbeing and mental health'],
    patterns: [
      /\bwellbeing\b/,
      /\bmental health\b/,
      /\bstress\b/,
      /\bstruggling\b/,
      /\bworried\b/,
      /\btiredness\b/,
      /\btired\b/,
      /\bdizzy\b/,
      /\bunwell\b/,
      /\bdrinking\b/,
    ],
  },
  {
    path: ['Personal judgement', 'Managing commitments'],
    patterns: [
      /\bcommitments?\b/,
      /\btraining sessions?\b/,
      /\bmatch\b/,
      /\bsocial\b/,
      /\btrip\b/,
      /\btour\b/,
      /\bfootball\b/,
      /\blacrosse\b/,
      /\bcricket\b/,
      /\bcancel\b/,
      /\breschedule\b/,
      /\breturn early\b/,
    ],
  },
  {
    path: ['Personal judgement', 'Career opportunity vs responsibility'],
    patterns: [
      /\bcareer\b/,
      /\bopportunit(?:y|ies)\b/,
      /\bpublication\b/,
      /\bpaper\b/,
      /\binterview\b/,
      /\bresearch\b/,
      /\bscientist\b/,
      /\bexperimental technique\b/,
      /\bdevelop (?:his|her|their)? ?(?:technique|skills?)\b/,
      /\badd value\b/,
      /\bsurgery\b/,
      /\bfuture\b/,
    ],
  },
  {
    path: ['Personal judgement', 'Peer pressure'],
    patterns: [
      /\bpeer pressure\b/,
      /\bfriends? may\b/,
      /\bclassmates?\b/,
      /\bsome of (?:his|her|their) friends\b/,
      /\beveryone\b/,
      /\bothers?\b.*\b(?:doing|done|gone)\b/,
    ],
  },
  {
    path: ['Ethical principles', 'Beneficence'],
    patterns: [
      /\bbenefit\b/,
      /\bhelp\b/,
      /\bsupport\b/,
      /\bbest interests?\b/,
      /\bwellbeing\b/,
      /\bneeds?\b/,
      /\bcare\b/,
    ],
  },
  {
    path: ['Ethical principles', 'Non-maleficence'],
    patterns: [
      /\bharm\b/,
      /\brisk\b/,
      /\bunsafe\b/,
      /\bpatient safety\b/,
      /\binfection\b/,
      /\billness\b/,
      /\bcompromise\b/,
      /\bcorrosive\b/,
    ],
  },
  {
    path: ['Ethical principles', 'Autonomy'],
    patterns: [
      /\bautonomy\b/,
      /\bchoice\b/,
      /\bconsent\b/,
      /\brefuse\b/,
      /\bdecision\b/,
      /\bask the patient\b/,
    ],
  },
  {
    path: ['Ethical principles', 'Justice'],
    patterns: [
      /\bjustice\b/,
      /\bfair(?:ness)?\b/,
      /\bequal\b/,
      /\bgrade\b/,
      /\bopportunit(?:y|ies)\b/,
      /\bextension\b/,
      /\breschedule\b/,
    ],
  },
  {
    path: ['Ethical principles', 'Consent'],
    patterns: [
      /\bconsent\b/,
      /\bpermission\b/,
      /\bagree(?:d|ment)?\b/,
      /\bpatient (?:agrees?|refuses?)\b/,
    ],
  },
  {
    path: ['Ethical principles', 'Confidentiality'],
    patterns: [
      /\bconfidentiality\b/,
      /\bconfidential\b/,
      /\bpatient data\b/,
      /\bpatient information\b/,
    ],
  },
]

export function getSituationalJudgementTagPathsForQuestion(args: {
  stem: ParsedStem
  question: ParsedStem['questions'][number]
}): string[][] {
  const optionText = args.question.options.map((opt) => opt.text).join(' ')
  const stemText = normalizedText(args.stem.stemText)
  const questionText = normalizedText(args.question.text)
  const text = normalizedText(`${args.stem.stemText} ${args.question.text} ${optionText}`)
  const matched = SJ_TAG_RULES.filter((rule) => {
    const patternMatches = rule.patterns ? hasAny(text, rule.patterns) : false
    const predicateMatches = rule.matches?.({
      text,
      stemText,
      questionText,
      optionText: normalizedText(optionText),
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
