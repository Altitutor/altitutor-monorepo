'use client'

import { useCallback, useId, useState } from 'react'
import {
  UcatExamShell,
  UcatExamActionButton,
  UcatFloatingPanel,
} from '@altitutor/ui'
import { ArrowLeft, ArrowRight, Calculator, Flag, Navigation } from 'lucide-react'
import { UCAT_COLORS, UCAT_FONTS } from '@altitutor/ui/src/components/ucat/ucat-theme'

type UcatTutorStemPreviewExamChromeProps = {
  /** UCAT section name (e.g. Verbal Reasoning). */
  sectionTitle: string
  /** Number of questions in this stem (preview navigation range). */
  questionCount: number
  /** 0-based index of the question shown in the preview body. */
  currentQuestionIndex: number
  onQuestionIndexChange: (index: number) => void
  children: React.ReactNode
}

/**
 * Tutor-only chrome matching ucat-web UcatExamShell: blue headers/toolbars/footer,
 * calculator + flag (disabled preview affordances), navigator overlay, previous/next.
 */
export function UcatTutorStemPreviewExamChrome({
  sectionTitle,
  questionCount,
  currentQuestionIndex,
  onQuestionIndexChange,
  children,
}: UcatTutorStemPreviewExamChromeProps) {
  const [navigatorOpen, setNavigatorOpen] = useState(false)
  const titleId = useId()

  const safeIndex =
    questionCount > 0 ? Math.min(Math.max(0, currentQuestionIndex), questionCount - 1) : 0

  const questionTitleRight =
    questionCount > 0 ? (
      <span className="text-[12pt] font-normal">
        Question {safeIndex + 1} of {questionCount}
      </span>
    ) : null

  const handleSelectNavigator = useCallback(
    (index: number) => {
      onQuestionIndexChange(index)
      setNavigatorOpen(false)
    },
    [onQuestionIndexChange]
  )

  const hasPrevious = questionCount > 1 && safeIndex > 0
  const hasNext = questionCount > 1 && safeIndex < questionCount - 1

  const navigatorOverlay =
    navigatorOpen && questionCount > 0 ? (
      <div
        role="presentation"
        className="flex h-full w-full items-center justify-center bg-black/20 p-4"
        onClick={() => setNavigatorOpen(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="pointer-events-auto max-w-lg flex-[0_1_520px]"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <UcatFloatingPanel
            title="Navigator"
            titleIcon={<Navigation className="h-5 w-5" />}
            onClose={() => setNavigatorOpen(false)}
            contentClassName="p-0"
          >
            <div
              className={`max-h-[min(280px,50vh)] overflow-y-auto bg-white font-[${UCAT_FONTS.body}] text-[11pt] text-black`}
            >
              <table className="w-full border-collapse">
                <thead
                  className="sticky top-0 z-10 text-white"
                  style={{ backgroundColor: UCAT_COLORS.toolbarBlue }}
                >
                  <tr>
                    <th id={titleId} className="border border-[#9ba9bd] px-2 py-1.5 text-left font-normal">
                      Question #
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: questionCount }).map((_, index) => {
                    const isCurrent = index === safeIndex
                    return (
                      <tr key={index} className="border-b border-[#9ba9bd]">
                        <td className="px-0 py-0">
                          <button
                            type="button"
                            className={`w-full px-3 py-2 text-left text-black hover:bg-[#e8ecf0] ${
                              isCurrent ? 'bg-[#dde8f7] font-medium' : ''
                            }`}
                            onClick={() => handleSelectNavigator(index)}
                          >
                            Question {index + 1}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </UcatFloatingPanel>
        </div>
      </div>
    ) : null

  return (
    <UcatExamShell
      sectionTitle={sectionTitle.trim() || 'UCAT'}
      sectionTitleRight={questionTitleRight}
      toolLeft={
        <button
          type="button"
          disabled
          className="inline-flex cursor-default items-center gap-1 text-white opacity-90 disabled:cursor-default disabled:text-white disabled:opacity-90"
          aria-label="Calculator (preview only)"
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
          disabled
          className="inline-flex cursor-default items-center gap-1 text-white opacity-90 disabled:cursor-default disabled:text-white disabled:opacity-90"
          aria-label="Flag for review (preview only)"
        >
          <Flag className="h-4 w-4" />
          <span className="text-[13pt]">
            <span className="underline">F</span>lag for Review
          </span>
        </button>
      }
      footerLeft={null}
      footerRight={
        questionCount >= 1 ? (
          <>
            {hasPrevious ? (
              <UcatExamActionButton
                type="button"
                onClick={() => onQuestionIndexChange(safeIndex - 1)}
                icon={<ArrowLeft className="h-4 w-4" />}
              >
                <span className="text-[14pt]">
                  <span className="underline">P</span>revious
                </span>
              </UcatExamActionButton>
            ) : null}
            <UcatExamActionButton
              type="button"
              onClick={() => setNavigatorOpen(true)}
              icon={<Navigation className="h-4 w-4" />}
            >
              <span className="text-[14pt]">
                Na<span className="underline">v</span>igator
              </span>
            </UcatExamActionButton>
            {hasNext ? (
              <UcatExamActionButton
                type="button"
                variant="highlight"
                icon={<ArrowRight className="h-4 w-4" />}
                iconRight
                onClick={() => onQuestionIndexChange(safeIndex + 1)}
              >
                <span className="text-[14pt]">
                  <span className="underline">N</span>ext
                </span>
              </UcatExamActionButton>
            ) : null}
          </>
        ) : null
      }
      overlay={navigatorOverlay}
    >
      {children}
    </UcatExamShell>
  )
}
