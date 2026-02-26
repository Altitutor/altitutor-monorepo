'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ArrowLeft, ArrowRight, Calculator, Flag, LogOut, Navigation } from 'lucide-react'
import { UcatExamActionButton, UcatExamShell } from '@altitutor/ui'
import { UCAT_COLORS } from '@altitutor/ui/src/components/ucat/ucat-theme'
import { useQuestionEngineData } from '@/features/question-engine/hooks/use-question-engine-data'
import { useQuestionEngineState } from '@/features/question-engine/hooks/use-question-engine-state'
import { CalculatorPanel } from '@/features/question-engine/components/calculator-panel'
import { EndExamDialog } from '@/features/question-engine/components/end-exam-dialog'
import { EngineIntroDialog } from '@/features/question-engine/components/engine-intro-dialog'
import { NavigatorPanel } from '@/features/question-engine/components/navigator-panel'
import { QuestionContent } from '@/features/question-engine/components/question-content'
import type { QuestionEngineMode, QuestionStemWithQuestions } from '@/features/question-engine/model/types'
import { mapQuestionStemsToItems } from '@/features/question-engine/model/types'
import { QUESTION_ENGINE_SHORTCUT_MAP } from '@/features/question-engine/model/shortcuts'

export function QuestionEnginePage({
  mode,
  sourceId,
  questionStems,
}: {
  mode: QuestionEngineMode
  sourceId?: string
  questionStems?: QuestionStemWithQuestions[]
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
        }
      : query.data

  const {
    state,
    setState,
    currentQuestion,
    questions,
    isLastQuestion,
    submittedCount,
    goNext,
    goPrevious,
    setQuestionByIndex,
    toggleFlagCurrent,
    setAnswer,
  } = useQuestionEngineState(exam)
  const router = useRouter()

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

      // When a Yes/No dialog is open, Alt+Y and Alt+N trigger Yes/No (not Next)
      const overlayActive = state.phase === 'intro' || state.showEndExamDialog
      if (overlayActive && (shortcutKey === 'alt+y' || shortcutKey === 'alt+n')) {
        event.preventDefault()
        if (shortcutKey === 'alt+y') {
          if (state.phase === 'intro') {
            setState((current) => ({ ...current, phase: 'question' }))
          } else if (state.showEndExamDialog) {
            setState((current) => ({
              ...current,
              phase: 'intro',
              currentIndex: 0,
              showEndExamDialog: false,
            }))
          }
        } else {
          if (state.phase === 'intro') {
            router.back()
          } else if (state.showEndExamDialog) {
            setState((current) => ({ ...current, showEndExamDialog: false }))
          }
        }
        return
      }

      // When the navigator is open, Alt+C closes it instead of toggling the calculator
      if (state.showNavigator && shortcutKey === 'alt+c') {
        event.preventDefault()
        setState((current) => ({ ...current, showNavigator: false }))
        return
      }

      const action = QUESTION_ENGINE_SHORTCUT_MAP[shortcutKey]

      if (!action) {
        return
      }

      event.preventDefault()

      switch (action) {
        case 'toggleCalculator':
          setState((current) => ({ ...current, showCalculator: !current.showCalculator }))
          break
        case 'toggleFlagForReview':
          toggleFlagCurrent()
          break
        case 'endExam':
          setState((current) => ({ ...current, showEndExamDialog: true }))
          break
        case 'previousQuestion':
          goPrevious()
          break
        case 'openNavigator':
          setState((current) => ({ ...current, showNavigator: !current.showNavigator }))
          break
        case 'nextQuestion':
          goNext()
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
  }, [state.phase, state.showEndExamDialog, state.showNavigator, setState, goNext, goPrevious, toggleFlagCurrent, router])

  if (mode !== 'questionStem' && query.isLoading) {
    return <div className="rounded-xl bg-card text-card-foreground p-4 shadow-sm text-sm text-muted-foreground">Loading exam...</div>
  }

  if ((mode !== 'questionStem' && query.error) || !exam || exam.questions.length === 0) {
    return (
      <div className="rounded-xl bg-card text-card-foreground p-4 shadow-sm text-sm text-red-600 dark:text-red-400">
        Unable to load questions for this {mode}. Ensure student has access via UCAT views and the selected source contains questions.
      </div>
    )
  }

  const flaggedCurrent = currentQuestion ? state.flaggedIds.includes(currentQuestion.id) : false
  const questionLabel = `${Math.min(state.currentIndex + 1, questions.length)} of ${questions.length}`

  const overlayActive = state.phase === 'intro' || state.showEndExamDialog

  const overlay = overlayActive ? (
    <>
      {state.phase === 'intro' ? (
        <div className="absolute inset-0 z-30 grid place-items-center p-6">
          <EngineIntroDialog
            title={mode === 'mock' ? 'Ready to Begin Exam' : 'Ready to Begin Practice Set'}
            description="If you are ready to begin the exam, select the Yes button. Otherwise, select the No button to return to the previous screen."
            onStart={() => setState((current) => ({ ...current, phase: 'question' }))}
            onCancel={() => setState((current) => ({ ...current, phase: 'intro' }))}
          />
        </div>
      ) : null}

      {state.showEndExamDialog ? (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/20 p-6">
          <EndExamDialog
            onConfirm={() =>
              setState((current) => ({
                ...current,
                phase: 'intro',
                currentIndex: 0,
                showEndExamDialog: false,
              }))
            }
            onCancel={() => setState((current) => ({ ...current, showEndExamDialog: false }))}
          />
        </div>
      ) : null}

      {state.showNavigator ? null : null}
    </>
  ) : null

  return (
    <>
      <UcatExamShell
        sectionTitle={currentQuestion?.sectionName ?? exam.title}
        sectionTitleRight={<span className="text-[12pt]">{questionLabel}</span>}
        toolLeft={
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-[var(--ucat-highlight-yellow)]"
            onClick={() => setState((current) => ({ ...current, showCalculator: !current.showCalculator }))}
          >
            <Calculator className="h-4 w-4" />
            <span className="text-[13pt]">
              <span className="underline">C</span>alculator
            </span>
          </button>
        }
        toolRight={
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-[var(--ucat-highlight-yellow)]"
            onClick={toggleFlagCurrent}
          >
            {flaggedCurrent ? (
              <span
                className="inline-flex items-center rounded-sm px-0.5 py-0.5"
                style={{ backgroundColor: UCAT_COLORS.highlightYellow, color: UCAT_COLORS.primaryBlueDark }}
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
        }
        footerLeft={
          <UcatExamActionButton
            onClick={() => setState((current) => ({ ...current, showEndExamDialog: true }))}
            icon={<LogOut className="h-4 w-4" />}
          >
            <span className="text-[14pt]">
              <span className="underline">E</span>nd Exam
            </span>
          </UcatExamActionButton>
        }
        footerRight={
          <>
            <UcatExamActionButton onClick={goPrevious} icon={<ArrowLeft className="h-4 w-4" />}>
              <span className="text-[14pt]">
                <span className="underline">P</span>revious
              </span>
            </UcatExamActionButton>
            <UcatExamActionButton
              onClick={() => setState((current) => ({ ...current, showNavigator: !current.showNavigator }))}
              icon={<Navigation className="h-4 w-4" />}
            >
              <span className="text-[14pt]">
                Na<span className="underline">v</span>igator
              </span>
            </UcatExamActionButton>
            <UcatExamActionButton
              onClick={goNext}
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
        }
        overlay={overlay}
      >
        {currentQuestion ? (
          <QuestionContent
            question={currentQuestion}
            selectedOptionId={state.selectedAnswers[currentQuestion.id]}
            onSelectOption={setAnswer}
          />
        ) : null}
      </UcatExamShell>

      {state.showCalculator ? (
        <CalculatorPanel onClose={() => setState((current) => ({ ...current, showCalculator: false }))} />
      ) : null}

      {state.showNavigator ? (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="absolute left-1/2 top-24 -translate-x-1/2 pointer-events-auto">
            <NavigatorPanel
              questions={questions}
              currentIndex={state.currentIndex}
              flaggedIds={state.flaggedIds}
              selectedAnswers={state.selectedAnswers}
              onSelect={setQuestionByIndex}
              onClose={() => setState((current) => ({ ...current, showNavigator: false }))}
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
