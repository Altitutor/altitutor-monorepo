'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  Flag,
  LogOut,
  Navigation,
  Search,
  X,
} from 'lucide-react'
import { UcatExamActionButton, UcatExamShell } from '@altitutor/ui'
import { UCAT_COLORS } from '@altitutor/ui/src/components/ucat/ucat-theme'
import { useQuestionEngineData } from '@/features/question-engine/hooks/use-question-engine-data'
import { useQuestionEngineState } from '@/features/question-engine/hooks/use-question-engine-state'
import { useUcatLag } from '@/features/question-engine/context/ucat-lag-context'
import { CalculatorPanel } from '@/features/question-engine/components/calculator-panel'
import { EndExamDialog } from '@/features/question-engine/components/end-exam-dialog'
import { EndReviewDialog } from '@/features/question-engine/components/end-review-dialog'
import { EngineIntroDialog } from '@/features/question-engine/components/engine-intro-dialog'
import { InstructionsContent } from '@/features/question-engine/components/instructions-content'
import { NavigatorPanel } from '@/features/question-engine/components/navigator-panel'
import { QuestionContent } from '@/features/question-engine/components/question-content'
import { ReviewBody } from '@/features/question-engine/components/review-body'
import { ReviewInstructionsDialog } from '@/features/question-engine/components/review-instructions-dialog'
import { TimeExpiredDialog } from '@/features/question-engine/components/time-expired-dialog'
import { getIncompleteCount } from '@/features/question-engine/lib/review'
import {
  formatTimeRemaining,
  getCurrentMockSegment,
  getCurrentSegmentTimeLimitSeconds,
  getNextMockSegment,
  getRemainingSeconds,
} from '@/features/question-engine/lib/timing'
import type { QuestionEngineMode, QuestionEngineQuestion, QuestionStemWithQuestions } from '@/features/question-engine/model/types'
import { mapQuestionStemsToItems, mapQuestionsToItems } from '@/features/question-engine/model/types'
import { QUESTION_ENGINE_SHORTCUT_MAP } from '@/features/question-engine/model/shortcuts'
import { useQuestionEnginePersistence } from '@/features/question-engine/hooks/use-question-engine-persistence'

export function QuestionEnginePage({
  mode,
  sourceId,
  questionStems,
  standaloneQuestions,
}: {
  mode: QuestionEngineMode
  sourceId?: string
  questionStems?: QuestionStemWithQuestions[]
  standaloneQuestions?: QuestionEngineQuestion[]
}) {
  const query = useQuestionEngineData({
    mode,
    setId: mode === 'set' ? sourceId : undefined,
    mockId: mode === 'mock' ? sourceId : undefined,
  })

  const exam =
    mode === 'questionStem'
      ? questionStems && {
          sourceType: mode,
          sourceId: sourceId ?? 'question-stem',
          title: 'Question Stems',
          questions: mapQuestionStemsToItems(questionStems),
          instructionsScreens: [],
        }
      : mode === 'questions'
        ? standaloneQuestions && {
            sourceType: mode,
            sourceId: sourceId ?? 'questions',
            title: 'Questions',
            questions: mapQuestionsToItems(standaloneQuestions),
            instructionsScreens: [],
          }
        : query.data

  const instructionsScreens =
    exam && 'instructionsScreens' in exam ? exam.instructionsScreens : []

  const {
    state,
    setState,
    currentQuestion,
    questions,
    isLastQuestion,
    submittedCount,
    effectiveCurrentIndex,
    reviewFilterIndices,
    reviewListRows,
    goNext,
    goPrevious,
    setQuestionByIndex,
    toggleFlagCurrent,
    toggleFlagById,
    setAnswer,
    goToReviewScreen,
    startReviewFilter,
    goToReviewQuestionByGlobalIndex,
  } = useQuestionEngineState(exam)
  const router = useRouter()
  const { isLagging, runWithLag } = useUcatLag()
  const [, setTick] = useState(0)
  const timeExpiredFiredRef = useRef<string | null>(null)

  const { recordAnswer, handleExamCompleted } = useQuestionEnginePersistence({
    mode,
    exam,
    state,
  })

  const isSetOrMock = exam && (exam.sourceType === 'set' || exam.sourceType === 'mock')
  const currentSegmentTimeLimit = isSetOrMock
    ? getCurrentSegmentTimeLimitSeconds(exam!, state)
    : null
  const isTimed = currentSegmentTimeLimit != null && currentSegmentTimeLimit > 0
  const remainingSeconds = isSetOrMock && isTimed
    ? getRemainingSeconds(exam!, state, state.timerStartedAt)
    : null
  const segmentKey =
    exam?.sourceType === 'mock'
      ? getCurrentMockSegment(exam, state)?.segmentIndex ?? `${state.phase}-${state.instructionsIndex}-${state.currentIndex}`
      : `${state.phase}-${state.instructionsIndex}-${state.currentIndex}`

  useEffect(() => {
    if (!isTimed) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [isTimed])

  useEffect(() => {
    if (!isSetOrMock || remainingSeconds === null) return
    if (remainingSeconds > 0) {
      timeExpiredFiredRef.current = null
      return
    }
    if (timeExpiredFiredRef.current === String(segmentKey)) return
    timeExpiredFiredRef.current = String(segmentKey)

    if (state.phase === 'instructions') {
      setState((prev) => {
        const next = { ...prev, phase: 'question' as const }
        if (exam!.sourceType === 'set') {
          next.currentIndex = 0
          next.timerStartedAt =
            (exam!.setModeTiming?.setTimeLimitSeconds ?? 0) > 0 ? Date.now() : null
        } else {
          const nextSeg = getNextMockSegment(exam!, prev)
          if (nextSeg?.type === 'questions') {
            next.currentIndex = nextSeg.questionStartIndex
            next.timerStartedAt =
              (nextSeg.timeLimitSeconds ?? 0) > 0 ? Date.now() : null
          } else {
            next.currentIndex = prev.currentIndex
          }
        }
        return next
      })
      return
    }

    const now = Date.now()
    setState((prev) => {
      const next = { ...prev, showTimeExpiredDialog: true }
      if (exam!.sourceType === 'mock') {
        next.nextSegmentTimerStartedAt = now
      }
      return next
    })
  }, [isSetOrMock, remainingSeconds, segmentKey, state.phase, exam?.sourceType, setState])

  // Warn before leaving the UCAT exam page (tab close, reload, or navigation)
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const anchor = target?.closest?.('a')
      if (!anchor || !anchor.href) return

      // Ignore clicks that don't change location
      const nextUrl = new URL(anchor.href, window.location.href)
      if (nextUrl.href === window.location.href) return

      const confirmLeave = window.confirm(
        'Are you sure you want to leave this UCAT exam? Your current progress may be lost.'
      )
      if (!confirmLeave) {
        event.preventDefault()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('click', handleClick, true)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('click', handleClick, true)
    }
  }, [])

  // Disable copy, cut, paste, and enable UCAT keyboard shortcuts while the UCAT engine is open
  useEffect(() => {
    const preventDefault = (event: Event) => {
      event.preventDefault()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName
      const isEditable =
        target?.isContentEditable ||
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT'

      const key = event.key.toLowerCase()

      // Block common clipboard shortcuts
      if ((event.ctrlKey || event.metaKey) && ['c', 'x', 'v', 'a'].includes(key)) {
        event.preventDefault()
        return
      }

      if (isEditable) {
        return
      }

      // Answer selection: a/b/c/d/e/f select option A/B/C/D/E/F when viewing a question (no modifiers)
      const overlayActive =
        state.phase === 'intro' ||
        state.showReadyDialog ||
        state.showEndExamDialog ||
        state.showTimeExpiredDialog ||
        state.showEndReviewDialog ||
        state.showReviewInstructionsDialog
      const isQuestionView =
        (state.phase === 'question' || (state.phase === 'review' && state.reviewFilter)) &&
        currentQuestion &&
        !overlayActive
      if (isQuestionView && !event.altKey && !event.ctrlKey && !event.metaKey) {
        const answerKeys = ['a', 'b', 'c', 'd', 'e', 'f']
        const keyIndex = answerKeys.indexOf(key)
        if (keyIndex >= 0 && currentQuestion.options[keyIndex]) {
          const optionId = currentQuestion.options[keyIndex].id
          const flaggedCurrent = state.flaggedIds.includes(currentQuestion.id)
          event.preventDefault()
          void runWithLag(() => {
            setAnswer(optionId)
            recordAnswer(currentQuestion.id, optionId, flaggedCurrent)
          })
          return
        }
      }

      // Handle UCAT engine shortcuts (Alt/Option + key).
      // On macOS, Option+letter yields a composed character in event.key (e.g. Option+C → "ç").
      // Use event.code (physical key, e.g. "KeyC") so shortcuts work regardless of keyboard layout.
      const parts: string[] = []
      if (event.altKey) {
        parts.push('alt')
      }
      const letterForShortcut =
        event.altKey && event.code.startsWith('Key') && event.code.length === 4
          ? event.code.slice(3).toLowerCase()
          : key
      parts.push(letterForShortcut)
      const shortcutKey = parts.join('+')

      // When Ready to Begin dialog is open (on instructions or intro), Alt+Y / Alt+N = Yes / No
      const readyOrEndOverlay = state.phase === 'intro' || state.showReadyDialog || state.showEndExamDialog
      if (readyOrEndOverlay && (shortcutKey === 'alt+y' || shortcutKey === 'alt+n')) {
        event.preventDefault()
        if (shortcutKey === 'alt+y') {
          if (state.phase === 'intro' || state.showReadyDialog) {
            setState((current) => ({ ...current, phase: 'question', showReadyDialog: false }))
          } else if (state.showEndExamDialog) {
            setState((current) => ({
              ...current,
              phase: 'intro',
              currentIndex: 0,
              showEndExamDialog: false,
            }))
          }
        } else {
          if (state.showReadyDialog) {
            setState((current) => ({ ...current, showReadyDialog: false }))
          } else if (state.phase === 'intro') {
            if (instructionsScreens.length > 0) {
              setState((current) => ({
                ...current,
                phase: 'instructions',
                instructionsIndex: instructionsScreens.length - 1,
              }))
            } else {
              router.back()
            }
          } else if (state.showEndExamDialog) {
            setState((current) => ({ ...current, showEndExamDialog: false }))
          }
        }
        return
      }

      // When in instructions phase (and no Ready dialog), only Next/Previous apply
      if (state.phase === 'instructions') {
        if (shortcutKey === 'alt+n') {
          event.preventDefault()
          goNext()
        } else if (shortcutKey === 'alt+p' && state.instructionsIndex > 0) {
          event.preventDefault()
          goPrevious()
        }
        return
      }

      // When the navigator is open, Alt+C closes it instead of toggling the calculator
      if (state.showNavigator && shortcutKey === 'alt+c') {
        event.preventDefault()
        setState((current) => ({ ...current, showNavigator: false }))
        return
      }

      // In review mode, Alt+S returns to review screen
      if (state.phase === 'review' && state.reviewFilter && shortcutKey === 'alt+s') {
        event.preventDefault()
        goToReviewScreen()
        return
      }

      const action = QUESTION_ENGINE_SHORTCUT_MAP[shortcutKey]

      if (!action) {
        return
      }

      event.preventDefault()

      switch (action) {
        case 'toggleCalculator':
          void runWithLag(() =>
            setState((current) => ({ ...current, showCalculator: !current.showCalculator }))
          )
          break
        case 'toggleFlagForReview':
          void runWithLag(() => {
            toggleFlagCurrent()
          })
          break
        case 'endExam':
          void runWithLag(() =>
            setState((current) => ({ ...current, showEndExamDialog: true }))
          )
          break
        case 'previousQuestion':
          void runWithLag(() => {
            goPrevious()
          })
          break
        case 'openNavigator':
          void runWithLag(() =>
            setState((current) => ({ ...current, showNavigator: !current.showNavigator }))
          )
          break
        case 'nextQuestion':
          void runWithLag(() => {
            goNext()
          })
          break
        case 'reviewScreen':
          if (state.phase === 'review' && state.reviewFilter) {
            void runWithLag(() => goToReviewScreen())
          }
          break
      }
    }

    document.addEventListener('copy', preventDefault)
    document.addEventListener('cut', preventDefault)
    document.addEventListener('paste', preventDefault)
    document.addEventListener('contextmenu', preventDefault)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('copy', preventDefault)
      document.removeEventListener('cut', preventDefault)
      document.removeEventListener('paste', preventDefault)
      document.removeEventListener('contextmenu', preventDefault)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    state.phase,
    state.instructionsIndex,
    state.showReadyDialog,
    state.showEndExamDialog,
    state.showNavigator,
    state.reviewFilter,
    state.showTimeExpiredDialog,
    state.showEndReviewDialog,
    state.showReviewInstructionsDialog,
    state.flaggedIds,
    currentQuestion,
    setState,
    setAnswer,
    recordAnswer,
    goNext,
    goPrevious,
    toggleFlagCurrent,
    goToReviewScreen,
    runWithLag,
    router,
    instructionsScreens.length,
  ])

  if ((mode === 'set' || mode === 'mock') && query.isLoading) {
    return <div className="rounded-xl bg-card text-card-foreground p-4 shadow-sm text-sm text-muted-foreground">Loading exam...</div>
  }

  if (((mode === 'set' || mode === 'mock') && query.error) || !exam || exam.questions.length === 0) {
    return (
      <div className="rounded-xl bg-card text-card-foreground p-4 shadow-sm text-sm text-red-600 dark:text-red-400">
        Unable to load questions for this {mode}. Ensure student has access via UCAT views and the selected source contains questions.
      </div>
    )
  }

  const flaggedCurrent = currentQuestion ? state.flaggedIds.includes(currentQuestion.id) : false
  const currentInstructionsScreen =
    state.phase === 'instructions' && instructionsScreens[state.instructionsIndex]
  const isInstructionsPhase = state.phase === 'instructions'
  const isReviewPhase = state.phase === 'review'
  const isReviewScreen = isReviewPhase && !state.reviewFilter
  const isReviewMode = isReviewPhase && state.reviewFilter
  const questionLabel =
    isReviewMode && reviewFilterIndices.length > 0
      ? `${effectiveCurrentIndex + 1} of ${questions.length}`
      : `${Math.min(effectiveCurrentIndex + 1, questions.length)} of ${questions.length}`
  const hasPreviousInstructions = state.instructionsIndex > 0
  const showReadyToBeginDialog = state.phase === 'intro' || state.showReadyDialog
  const overlayActive =
    showReadyToBeginDialog ||
    state.showEndExamDialog ||
    state.showTimeExpiredDialog ||
    state.showEndReviewDialog ||
    state.showReviewInstructionsDialog

  const incompleteCount = getIncompleteCount(
    questions,
    state.visitedQuestionIds,
    state.selectedAnswers
  )

  function handleTimeExpiredOk() {
    if (!exam || (exam.sourceType !== 'set' && exam.sourceType !== 'mock')) return
    if (exam.sourceType === 'set') {
      void runWithLag(() => {
        handleExamCompleted()
        setState((current) => ({
          ...current,
          showTimeExpiredDialog: false,
          phase: 'intro',
          currentIndex: 0,
        }))
        router.back()
      })
      return
    }
    const nextSeg = getNextMockSegment(exam, state)
    if (!nextSeg) {
      void runWithLag(() => {
        handleExamCompleted()
        setState((current) => ({
          ...current,
          showTimeExpiredDialog: false,
          phase: 'intro',
          currentIndex: 0,
        }))
        router.back()
      })
      return
    }
    const timerStartedAt = state.nextSegmentTimerStartedAt ?? Date.now()
    void runWithLag(() => {
      setState((current) => {
        const next: typeof current = {
          ...current,
          showTimeExpiredDialog: false,
          nextSegmentTimerStartedAt: null,
          timerStartedAt,
        }
        if (nextSeg.type === 'instructions') {
          next.phase = 'instructions'
          next.instructionsIndex = nextSeg.instructionsIndex
        } else {
          next.phase = 'question'
          next.currentIndex = nextSeg.questionStartIndex
        }
        return next
      })
    })
  }

  const overlay =
    overlayActive || isLagging ? (
      <>
        {showReadyToBeginDialog ? (
          <div className="absolute inset-0 z-30 grid place-items-center p-6">
            <EngineIntroDialog
              title={mode === 'mock' ? 'Ready to Begin Exam' : 'Ready to Begin Practice Set'}
              description="If you are ready to begin the exam, select the Yes button. Otherwise, select the No button to return to the previous screen."
              onStart={() =>
                void runWithLag(() => {
                  const questionsSegmentTimed =
                    exam &&
                    (exam.sourceType === 'set'
                      ? (exam.setModeTiming?.setTimeLimitSeconds ?? 0) > 0
                      : (() => {
                          const seg = getCurrentMockSegment(exam, {
                            ...state,
                            phase: 'question',
                            currentIndex: 0,
                          })
                          return (seg?.timeLimitSeconds ?? 0) > 0
                        })())
                  setState((current) => ({
                    ...current,
                    phase: 'question',
                    showReadyDialog: false,
                    timerStartedAt: questionsSegmentTimed ? Date.now() : null,
                  }))
                })
              }
              onCancel={() =>
                void runWithLag(() =>
                  setState((current) =>
                    current.showReadyDialog
                      ? { ...current, showReadyDialog: false }
                      : instructionsScreens.length > 0
                        ? {
                            ...current,
                            phase: 'instructions',
                            instructionsIndex: instructionsScreens.length - 1,
                          }
                        : { ...current, phase: 'intro' }
                  )
                )
              }
            />
          </div>
        ) : null}

        {state.showTimeExpiredDialog ? (
          <div className="absolute inset-0 z-[35] grid place-items-center bg-black/20 p-6">
            <TimeExpiredDialog
              isSetMode={exam?.sourceType === 'set'}
              onOk={() => void runWithLag(handleTimeExpiredOk)}
            />
          </div>
        ) : null}

        {state.showEndExamDialog ? (
          <div className="absolute inset-0 z-40 grid place-items-center bg-black/20 p-6">
            <EndExamDialog
              onConfirm={() =>
                void runWithLag(() => {
                  handleExamCompleted()
                  setState((current) => ({
                    ...current,
                    phase: 'intro',
                    currentIndex: 0,
                    showEndExamDialog: false,
                  }))
                })
              }
              onCancel={() =>
                void runWithLag(() =>
                  setState((current) => ({ ...current, showEndExamDialog: false }))
                )
              }
            />
          </div>
        ) : null}

        {state.showEndReviewDialog ? (
          <div className="absolute inset-0 z-40 grid place-items-center bg-black/20 p-6">
            <EndReviewDialog
              incompleteCount={incompleteCount}
              onConfirm={() =>
                void runWithLag(() => {
                  handleExamCompleted()
                  setState((current) => ({
                    ...current,
                    phase: 'intro',
                    currentIndex: 0,
                    showEndReviewDialog: false,
                    reviewFilter: null,
                    reviewFilterIndex: 0,
                  }))
                  router.back()
                })
              }
              onCancel={() =>
                void runWithLag(() =>
                  setState((current) => ({ ...current, showEndReviewDialog: false }))
                )
              }
            />
          </div>
        ) : null}

        {state.showReviewInstructionsDialog ? (
          <div className="absolute inset-0 z-40 grid place-items-center bg-black/20 p-6">
            <ReviewInstructionsDialog
              onClose={() =>
                void runWithLag(() =>
                  setState((current) => ({ ...current, showReviewInstructionsDialog: false }))
                )
              }
            />
          </div>
        ) : null}

        {isLagging ? (
          <div className="absolute inset-0 z-50 cursor-wait bg-transparent" aria-hidden="true" />
        ) : null}
      </>
    ) : null

  const headerRight = (
    <div className="flex flex-col items-end gap-0.5">
      {isTimed && remainingSeconds !== null ? (
        <div
          className="text-[12pt] font-normal"
          role="timer"
          aria-label={`Time remaining ${formatTimeRemaining(remainingSeconds)}`}
        >
          <span className="mr-1">Time Remaining</span>
          <span>{formatTimeRemaining(remainingSeconds)}</span>
        </div>
      ) : null}
      {!isInstructionsPhase && !isReviewScreen ? (
        <span className="text-[12pt] font-normal">{questionLabel}</span>
      ) : null}
    </div>
  )

  return (
    <>
      <UcatExamShell
        sectionTitle={
          isReviewScreen ? exam.title : (currentQuestion?.sectionName ?? exam.title)
        }
        sectionTitleRight={
          isReviewScreen
            ? isTimed && remainingSeconds !== null
              ? headerRight
              : null
            : !isInstructionsPhase || isTimed
              ? headerRight
              : null
        }
        toolLeft={
          isReviewScreen ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 hover:text-[#fffd6f]"
              onClick={() =>
                void runWithLag(() =>
                  setState((current) => ({ ...current, showReviewInstructionsDialog: true }))
                )
              }
            >
              <span className="text-[13pt]">Instructions</span>
            </button>
          ) : isInstructionsPhase ? null : (
            <button
              type="button"
              className="inline-flex items-center gap-1 hover:text-[#fffd6f]"
              onClick={() =>
                void runWithLag(() =>
                  setState((current) => ({ ...current, showCalculator: !current.showCalculator }))
                )
              }
            >
              <Calculator className="h-4 w-4" />
              <span className="text-[13pt]">
                <span className="underline">C</span>alculator
              </span>
            </button>
          )
        }
        toolRight={
          isReviewScreen || isInstructionsPhase ? null : (
            <button
              type="button"
              className="inline-flex items-center gap-1 hover:text-[#fffd6f]"
              onClick={() =>
                void runWithLag(() => {
                  toggleFlagCurrent()
                })
              }
            >
              {flaggedCurrent ? (
                <span
                  className="inline-flex items-center rounded-sm px-0.5 py-0.5"
                  style={{
                    backgroundColor: UCAT_COLORS.highlightYellow,
                    color: UCAT_COLORS.primaryBlueDark,
                  }}
                >
                  <Flag className="h-4 w-4" />
                </span>
              ) : (
                <Flag className="h-4 w-4" />
              )}
              <span className="text-[13pt]">
                <span className="underline">F</span>lag for Review
              </span>
            </button>
          )
        }
        footerLeft={
          isReviewScreen ? (
            <UcatExamActionButton
              onClick={() =>
                void runWithLag(() => {
                  if (incompleteCount > 0) {
                    setState((current) => ({ ...current, showEndReviewDialog: true }))
                  } else {
                    handleExamCompleted()
                    setState((current) => ({
                      ...current,
                      phase: 'intro',
                      currentIndex: 0,
                      reviewFilter: null,
                      reviewFilterIndex: 0,
                    }))
                    router.back()
                  }
                })
              }
              icon={<LogOut className="h-4 w-4" />}
            >
              <span className="text-[14pt]">
                <span className="underline">E</span>nd Review
              </span>
            </UcatExamActionButton>
          ) : isReviewMode ? (
            <UcatExamActionButton
              onClick={() => void runWithLag(() => goToReviewScreen())}
              icon={<Navigation className="h-4 w-4" />}
            >
              <span className="text-[14pt]">
                Review <span className="underline">S</span>creen
              </span>
            </UcatExamActionButton>
          ) : isInstructionsPhase ? null : (
            <UcatExamActionButton
              onClick={() =>
                void runWithLag(() =>
                  setState((current) => ({ ...current, showEndExamDialog: true }))
                )
              }
              icon={<LogOut className="h-4 w-4" />}
            >
              <span className="text-[14pt]">
                <span className="underline">E</span>nd Exam
              </span>
            </UcatExamActionButton>
          )
        }
        footerRight={
          isReviewScreen ? (
            <>
              <UcatExamActionButton
                onClick={() => void runWithLag(() => startReviewFilter('all'))}
                borders="all"
                icon={<Search className="h-4 w-4" />}
              >
                <span className="text-[14pt]">Review <span className="underline">A</span>ll</span>
              </UcatExamActionButton>
              <UcatExamActionButton
                onClick={() => void runWithLag(() => startReviewFilter('incomplete'))}
                borders="all"
                icon={<X className="h-4 w-4" />}
              >
                <span className="text-[14pt]">Review <span className="underline">I</span>ncomplete</span>
              </UcatExamActionButton>
              <UcatExamActionButton
                onClick={() => void runWithLag(() => startReviewFilter('flagged'))}
                borders="all"
                icon={<Flag className="h-4 w-4" />}
              >
                <span className="text-[14pt]">Re<span className="underline">v</span>iew Flagged</span>
              </UcatExamActionButton>
            </>
          ) : isReviewMode ? (
            <>
              {state.reviewFilterIndex > 0 ? (
                <UcatExamActionButton
                  onClick={() => void runWithLag(() => goPrevious())}
                  icon={<ArrowLeft className="h-4 w-4" />}
                >
                  <span className="text-[14pt]">
                    <span className="underline">P</span>revious
                  </span>
                </UcatExamActionButton>
              ) : null}
              <UcatExamActionButton
                onClick={() => void runWithLag(() => goNext())}
                variant="highlight"
                icon={<ArrowRight className="h-4 w-4" />}
                iconRight
              >
                <span className="text-[14pt]">
                  <span className="underline">N</span>ext
                </span>
              </UcatExamActionButton>
            </>
          ) : isInstructionsPhase ? (
            <>
              {hasPreviousInstructions ? (
                <UcatExamActionButton
                  onClick={() => void runWithLag(() => goPrevious())}
                  icon={<ArrowLeft className="h-4 w-4" />}
                >
                  <span className="text-[14pt]">
                    <span className="underline">P</span>revious
                  </span>
                </UcatExamActionButton>
              ) : null}
              <UcatExamActionButton
                onClick={() => void runWithLag(() => goNext())}
                variant="highlight"
                icon={<ArrowRight className="h-4 w-4" />}
                iconRight
              >
                <span className="text-[14pt]">
                  <span className="underline">N</span>ext
                </span>
              </UcatExamActionButton>
            </>
          ) : (
            <>
              <UcatExamActionButton
                onClick={() =>
                  void runWithLag(() => {
                    goPrevious()
                  })
                }
                icon={<ArrowLeft className="h-4 w-4" />}
              >
                <span className="text-[14pt]">
                  <span className="underline">P</span>revious
                </span>
              </UcatExamActionButton>
              <UcatExamActionButton
                onClick={() =>
                  void runWithLag(() =>
                    setState((current) => ({ ...current, showNavigator: !current.showNavigator }))
                  )
                }
                icon={<Navigation className="h-4 w-4" />}
              >
                <span className="text-[14pt]">
                  Na<span className="underline">v</span>igator
                </span>
              </UcatExamActionButton>
              <UcatExamActionButton
                onClick={() =>
                  void runWithLag(() => {
                    goNext()
                  })
                }
                variant="highlight"
                icon={<ArrowRight className="h-4 w-4" />}
                iconRight
              >
                {isLastQuestion ? (
                  <span className="text-[14pt]">Review</span>
                ) : (
                  <span className="text-[14pt]">
                    <span className="underline">N</span>ext
                  </span>
                )}
              </UcatExamActionButton>
            </>
          )
        }
        overlay={overlay}
      >
        {isInstructionsPhase && currentInstructionsScreen ? (
          <InstructionsContent screen={currentInstructionsScreen} />
        ) : isReviewScreen ? (
          <ReviewBody
            sectionTitle={exam.title}
            incompleteCount={incompleteCount}
            rows={reviewListRows}
            flaggedIds={state.flaggedIds}
            onToggleFlag={toggleFlagById}
            onSelectQuestion={goToReviewQuestionByGlobalIndex}
          />
        ) : currentQuestion ? (
          <QuestionContent
            question={currentQuestion}
            selectedOptionId={state.selectedAnswers[currentQuestion.id]}
            onSelectOption={(optionId) => {
              setAnswer(optionId)
              recordAnswer(currentQuestion.id, optionId, flaggedCurrent)
            }}
          />
        ) : null}
      </UcatExamShell>

      {state.showCalculator ? (
        <CalculatorPanel
          onClose={() =>
            void runWithLag(() =>
              setState((current) => ({ ...current, showCalculator: false }))
            )
          }
        />
      ) : null}

      {state.showNavigator ? (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="absolute left-1/2 top-24 -translate-x-1/2 pointer-events-auto">
            <NavigatorPanel
              questions={questions}
              currentIndex={state.currentIndex}
              flaggedIds={state.flaggedIds}
              selectedAnswers={state.selectedAnswers}
              onSelect={(index: number) =>
                void runWithLag(() => {
                  setQuestionByIndex(index)
                })
              }
              onClose={() =>
                void runWithLag(() =>
                  setState((current) => ({ ...current, showNavigator: false }))
                )
              }
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
