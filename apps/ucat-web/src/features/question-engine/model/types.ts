export type QuestionEngineMode = 'set' | 'mock' | 'questionStem' | 'questions'

export type AnswerOption = {
  id: string
  index: number
  text: string
  /** True if this option is the correct answer. Used for marking display. */
  isAnswer?: boolean
  /** Option-level answer explanation (shown in results review). */
  answerExplanation?: string
  /** Number of students who selected this option. From DB aggregation. */
  selectionCount?: number
  /** Total students who answered this question. From DB aggregation. */
  totalAnswered?: number
  /** Percentage (0–100) of students who selected this option. */
  percentage?: number
}

export type QuestionItem = {
  id: string
  index: number
  questionSetId: string
  stemId: string
  sectionName: string
  sectionDisplayColumns: 1 | 2
  stemText: string
  questionText: string
  questionType: 'multiple_choice' | 'syllogism'
  options: AnswerOption[]
  /** ID of the correct answer option. Used for marking. */
  correctOptionId?: string
  /** Question-level answer explanation (shown below options in results review). */
  answerExplanation?: string
}

/** One screen of instructions (tiptap/prosemirror JSON). Shown before questions when applicable. */
export type InstructionsScreen = {
  instructionsJson: Record<string, unknown> | null
}

/** Time limit for current segment. If set is untimed (questions time null), instructions are also untimed. */
export type SetModeTiming = {
  /** Question set time limit. Null = untimed (no timer in instructions or questions). */
  setTimeLimitSeconds: number | null
  /** Section instructions time limit. Only shown when set is timed. */
  instructionsTimeLimitSeconds: number | null
}

/** One segment in mock (instructions screen or block of questions). Used for timer and time-expired flow. */
export type MockTimingSegment =
  | { type: 'instructions'; instructionsIndex: number; timeLimitSeconds: number | null }
  | {
      type: 'questions'
      setIndex: number
      questionStartIndex: number
      questionEndIndex: number
      timeLimitSeconds: number | null
    }

export type QuestionEngineExam = {
  sourceType: QuestionEngineMode
  sourceId: string
  title: string
  questions: QuestionItem[]
  /** Ordered list of instruction screens. Set/mock mode only. Empty = no instructions phase. */
  instructionsScreens: InstructionsScreen[]
  /** Set mode only. When null, exam is untimed. */
  setModeTiming?: SetModeTiming | null
  /** Mock mode only. Ordered segments for timer and expiry. */
  mockTimingSegments?: MockTimingSegment[]
  /** Mock mode only. Per-set summaries for mock score display. */
  mockSetSummaries?: Array<{
    setIndex: number
    name: string
    questionStartIndex: number
    questionEndIndex: number
  }>
}

export type QuestionStemWithQuestions = {
  id: string
  questionSetId: string
  sectionName: string
  sectionDisplayColumns: 1 | 2
  stemText: string
  questions: {
    id: string
    index: number
    questionText: string
    questionType: 'multiple_choice' | 'syllogism'
    options: AnswerOption[]
  }[]
}

export function mapQuestionStemsToItems(stems: QuestionStemWithQuestions[]): QuestionItem[] {
  const items: QuestionItem[] = []
  let runningIndex = 0

  for (const stem of stems) {
    const sortedQuestions = [...stem.questions].sort((a, b) => a.index - b.index)

    for (const question of sortedQuestions) {
      const sortedOptions = [...question.options].sort((a, b) => a.index - b.index)
      const correctOption = sortedOptions.find((o) => o.isAnswer)

      items.push({
        id: question.id,
        index: runningIndex++,
        questionSetId: stem.questionSetId,
        stemId: stem.id,
        sectionName: stem.sectionName,
        sectionDisplayColumns: stem.sectionDisplayColumns,
        stemText: stem.stemText,
        questionText: question.questionText,
        questionType: question.questionType,
        options: sortedOptions,
        correctOptionId: correctOption?.id,
      })
    }
  }

  return items
}

export type QuestionEngineQuestion = {
  id: string
  stemId: string
  sectionName: string
  sectionDisplayColumns: 1 | 2
  stemText: string
  questionText: string
  questionType: 'multiple_choice' | 'syllogism'
  options: AnswerOption[]
}

export function mapQuestionsToItems(questions: QuestionEngineQuestion[]): QuestionItem[] {
  return questions.map((question, index) => {
    const sortedOptions = [...question.options].sort((a, b) => a.index - b.index)
    const correctOption = sortedOptions.find((o) => o.isAnswer)
    return {
      id: question.id,
      index,
      questionSetId: 'questions-mode',
      stemId: question.stemId,
      sectionName: question.sectionName,
      sectionDisplayColumns: question.sectionDisplayColumns,
      stemText: question.stemText,
      questionText: question.questionText,
      questionType: question.questionType,
      options: sortedOptions,
      correctOptionId: correctOption?.id,
    }
  })
}

/** Filter for review mode: which subset of questions to step through. */
export type ReviewFilter = 'all' | 'incomplete' | 'flagged'

export type QuestionEngineState = {
  /** 'instructions' | 'intro' | 'question' | 'review' | 'marking' | 'mockScore' | 'practiceAnswer' | 'practiceComplete' */
  phase:
    | 'instructions'
    | 'intro'
    | 'question'
    | 'review'
    | 'marking'
    | 'mockScore'
    | 'practiceAnswer'
    | 'practiceComplete'
  /** Mock only: which set we're in (0-based). Used when in review to scope to current set. */
  mockCurrentSetIndex?: number
  /** Which instructions screen (0-based). Only relevant when phase === 'instructions'. */
  instructionsIndex: number
  /** When true, Ready to Begin dialog is shown on top of current screen (e.g. instructions). No = dismiss only. */
  showReadyDialog: boolean
  /** When the current segment's timer started (ms). Null when untimed or timer not started. */
  timerStartedAt: number | null
  /** When true, show "Time Expired" dialog. On OK: set mode = end set; mock mode = advance to next segment. */
  showTimeExpiredDialog: boolean
  /** Mock only: when we showed time expired, the next segment's timer was started at this time (ms). */
  nextSegmentTimerStartedAt: number | null
  currentIndex: number
  /** Question ids the user has visited (for Unseen vs Incomplete status in review). */
  visitedQuestionIds: string[]
  flaggedIds: string[]
  selectedAnswers: Record<string, string>
  /** For syllogism questions: map of questionId -> optionId -> true (Yes) / false (No). */
  syllogismSnapshots?: Record<string, Record<string, boolean>>
  showNavigator: boolean
  showCalculator: boolean
  showEndExamDialog: boolean
  /** When phase === 'review': null = review screen (list); non-null = review mode (stepping through filtered list). */
  reviewFilter: ReviewFilter | null
  /** Index into the filtered list when in review mode. Only relevant when reviewFilter !== null. */
  reviewFilterIndex: number
  showReviewInstructionsDialog: boolean
  showEndReviewDialog: boolean
  /** When phase === 'marking': index of question being viewed in fullscreen, or null for results table. */
  viewingQuestionIndex: number | null
  /** When true, show Exit Results confirmation dialog. */
  showExitResultsDialog: boolean
  /** Practice mode only: unit being reviewed. viewingQuestionIndex is the current question in this range. */
  practiceAnswerUnitStartIndex?: number
  practiceAnswerUnitEndIndex?: number
}
