'use client'

import { ArrowLeft, ArrowRight, Calculator, Flag, LogOut, Navigation } from 'lucide-react'
import { UcatExamActionButton, UcatExamShell } from '@altitutor/ui'
import { useQuestionEngineData } from '@/features/question-engine/hooks/use-question-engine-data'
import { useQuestionEngineState } from '@/features/question-engine/hooks/use-question-engine-state'
import { CalculatorPanel } from '@/features/question-engine/components/calculator-panel'
import { EndExamDialog } from '@/features/question-engine/components/end-exam-dialog'
import { EngineIntroDialog } from '@/features/question-engine/components/engine-intro-dialog'
import { NavigatorPanel } from '@/features/question-engine/components/navigator-panel'
import { QuestionContent } from '@/features/question-engine/components/question-content'
import type { QuestionEngineMode } from '@/features/question-engine/model/types'

export function QuestionEnginePage({
  mode,
  sourceId,
}: {
  mode: QuestionEngineMode
  sourceId?: string
}) {
  const query = useQuestionEngineData({
    mode,
    setId: mode === 'set' ? sourceId : undefined,
    mockId: mode === 'mock' ? sourceId : undefined,
  })

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
  } = useQuestionEngineState(query.data)

  if (query.isLoading) {
    return <div className="rounded-xl bg-card text-card-foreground p-4 shadow-sm text-sm text-muted-foreground">Loading exam...</div>
  }

  if (query.error || !query.data || query.data.questions.length === 0) {
    return (
      <div className="rounded-xl bg-card text-card-foreground p-4 shadow-sm text-sm text-red-600 dark:text-red-400">
        Unable to load questions for this {mode}. Ensure student has access via UCAT views and the selected set/mock contains questions.
      </div>
    )
  }

  const flaggedCurrent = currentQuestion ? state.flaggedIds.includes(currentQuestion.id) : false
  const questionLabel = `${Math.min(state.currentIndex + 1, questions.length)} of ${questions.length}`

  const overlay = (
    <>
      {state.phase === 'intro' ? (
        <div className="absolute inset-0 z-30 grid place-items-start p-6">
          <EngineIntroDialog
            title={mode === 'mock' ? 'Ready to Begin Exam' : 'Ready to Begin Practice Set'}
            description="If you are ready to begin the exam, select the Yes button. Otherwise, select the No button to return to the previous screen."
            onStart={() => setState((current) => ({ ...current, phase: 'question' }))}
            onCancel={() => setState((current) => ({ ...current, phase: 'intro' }))}
          />
        </div>
      ) : null}

      {state.showEndExamDialog ? (
        <div className="absolute inset-0 z-40 grid place-items-start bg-black/20 p-6">
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

      {state.showNavigator ? (
        <div className="absolute inset-0 z-40 grid place-items-start bg-black/15 p-4">
          <NavigatorPanel
            questions={questions}
            currentIndex={state.currentIndex}
            flaggedIds={state.flaggedIds}
            selectedAnswers={state.selectedAnswers}
            onSelect={setQuestionByIndex}
            onClose={() => setState((current) => ({ ...current, showNavigator: false }))}
          />
        </div>
      ) : null}

      {state.showCalculator ? (
        <div className="absolute left-4 top-20 z-40 w-full max-w-sm">
          <CalculatorPanel onClose={() => setState((current) => ({ ...current, showCalculator: false }))} />
        </div>
      ) : null}
    </>
  )

  return (
    <UcatExamShell
      sectionTitle={currentQuestion?.sectionName ?? query.data.title}
      toolLeft={
        <>
          <button
            type="button"
            className="inline-flex items-center gap-1 underline"
            onClick={() => setState((current) => ({ ...current, showCalculator: !current.showCalculator }))}
          >
            <Calculator className="h-4 w-4" />
            Calculator
          </button>
          <button type="button" className="inline-flex items-center gap-1 underline" onClick={toggleFlagCurrent}>
            <Flag className="h-4 w-4" />
            {flaggedCurrent ? 'Unflag' : 'Flag for Review'}
          </button>
        </>
      }
      toolRight={<span className="text-sm">{questionLabel}</span>}
      footerLeft={
        <UcatExamActionButton
          onClick={() => setState((current) => ({ ...current, showEndExamDialog: true }))}
          icon={<LogOut className="h-4 w-4" />}
        >
          End Exam
        </UcatExamActionButton>
      }
      footerRight={
        <>
          <UcatExamActionButton onClick={goPrevious} icon={<ArrowLeft className="h-4 w-4" />}>
            Previous
          </UcatExamActionButton>
          <UcatExamActionButton
            onClick={() => setState((current) => ({ ...current, showNavigator: !current.showNavigator }))}
            icon={<Navigation className="h-4 w-4" />}
          >
            Navigator
          </UcatExamActionButton>
          <UcatExamActionButton onClick={goNext} variant="highlight" icon={<ArrowRight className="h-4 w-4" />} iconRight>
            {isLastQuestion ? 'Review' : 'Next'}
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
      <p className="mt-4 text-sm text-black/70">
        Completed: {submittedCount}/{questions.length}
      </p>
    </UcatExamShell>
  )
}
