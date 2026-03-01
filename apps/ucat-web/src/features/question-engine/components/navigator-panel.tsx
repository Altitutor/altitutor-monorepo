import { Flag, Navigation } from 'lucide-react'
import { UcatExamActionButton, UcatFloatingPanel } from '@altitutor/ui'
import { UCAT_COLORS, UCAT_FONTS } from '@altitutor/ui/src/components/ucat/ucat-theme'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { QuestionItem } from '@/features/question-engine/model/types'
import { useDraggablePanel } from '@/features/question-engine/hooks/use-draggable-panel'

export function NavigatorPanel({
  questions,
  currentIndex,
  flaggedIds,
  selectedAnswers,
  onSelect,
  onClose,
}: {
  questions: QuestionItem[]
  currentIndex: number
  flaggedIds: string[]
  selectedAnswers: Record<string, string>
  onSelect: (index: number) => void
  onClose: () => void
}) {
  const { position, handleMouseDown, setPosition } = useDraggablePanel()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null)
  const [hoveredTextRowIndex, setHoveredTextRowIndex] = useState<number | null>(null)
  const [sortField, setSortField] = useState<'question' | 'status' | 'flagged'>('question')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const unseenOrIncompleteCount = questions.reduce((count, question) => {
    const answered = Boolean(selectedAnswers[question.id])
    return answered ? count : count + 1
  }, 0)

  // Keep navigator panel fully within the UCAT exam shell
  useEffect(() => {
    const shell = document.querySelector('[data-ucat-shell-root="true"]') as HTMLElement | null
    const panel = panelRef.current
    if (!shell || !panel) return

    const shellRect = shell.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()

    let dx = 0
    let dy = 0

    if (panelRect.left < shellRect.left) {
      dx = shellRect.left - panelRect.left
    } else if (panelRect.right > shellRect.right) {
      dx = shellRect.right - panelRect.right
    }

    if (panelRect.top < shellRect.top) {
      dy = shellRect.top - panelRect.top
    } else if (panelRect.bottom > shellRect.bottom) {
      dy = shellRect.bottom - panelRect.bottom
    }

    if (dx !== 0 || dy !== 0) {
      setPosition((current) => ({
        x: current.x + dx,
        y: current.y + dy,
      }))
    }
  }, [position.x, position.y, setPosition])

  const sortedRows = useMemo(() => {
    const base = questions.map((question, index) => {
      const flagged = flaggedIds.includes(question.id)
      const answered = Boolean(selectedAnswers[question.id])
      const statusLabel = answered ? '' : 'Unseen'
      const statusRank = answered ? 1 : 0
      const flaggedRank = flagged ? 0 : 1

      return {
        question,
        index,
        flagged,
        answered,
        statusLabel,
        statusRank,
        flaggedRank,
      }
    })

    const directionFactor = sortDirection === 'asc' ? 1 : -1

    return base.sort((a, b) => {
      if (sortField === 'question') {
        return (a.index - b.index) * directionFactor
      }

      if (sortField === 'status') {
        if (a.statusRank !== b.statusRank) {
          return (a.statusRank - b.statusRank) * directionFactor
        }
        // tie-breaker by question index
        return (a.index - b.index) * directionFactor
      }

      // sortField === 'flagged'
      if (a.flaggedRank !== b.flaggedRank) {
        return (a.flaggedRank - b.flaggedRank) * directionFactor
      }
      return (a.index - b.index) * directionFactor
    })
  }, [questions, flaggedIds, selectedAnswers, sortField, sortDirection])

  const handleHeaderClick = (field: 'question' | 'status' | 'flagged') => {
    if (sortField === field) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const renderSortIndicator = (field: 'question' | 'status' | 'flagged') => {
    if (sortField !== field) return <span className="inline-block w-3" />
    return (
      <span className="inline-block w-3 text-[9px] align-middle">
        {sortDirection === 'asc' ? '▲' : '▼'}
      </span>
    )
  }

  return (
    <div
      ref={panelRef}
      className="pointer-events-auto"
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
    >
      <UcatFloatingPanel
        title="Navigator - select a question to go to it"
        titleIcon={<Navigation className="h-5 w-5" />}
        onDragMouseDown={handleMouseDown}
        className="w-full max-w-[640px] resize min-w-[320px] min-h-[240px] overflow-auto"
      >
        <div
          className={`overflow-hidden font-[${UCAT_FONTS.message}] text-[11pt] text-black`}
          style={{ backgroundColor: 'white' }}
        >
          <table className="w-full border-collapse">
            <thead style={{ backgroundColor: UCAT_COLORS.toolbarBlue }} className="text-white">
              <tr>
                <th
                  className="cursor-pointer border border-[#9ba9bd] px-2 py-1.5 text-left font-normal select-none"
                  onClick={() => handleHeaderClick('question')}
                >
                  <span>Question #</span> {renderSortIndicator('question')}
                </th>
                <th
                  className="cursor-pointer border border-[#9ba9bd] px-2 py-1.5 text-left font-normal select-none"
                  onClick={() => handleHeaderClick('status')}
                >
                  <span>Status</span> {renderSortIndicator('status')}
                </th>
                <th
                  className="cursor-pointer border border-[#9ba9bd] px-2 py-1.5 text-left font-normal select-none"
                  onClick={() => handleHeaderClick('flagged')}
                >
                  <span>Flagged</span> {renderSortIndicator('flagged')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => {
                const isCurrent = row.index === currentIndex
                const isRowHovered = hoveredRowIndex === row.index
                const isTextHovered = hoveredTextRowIndex === row.index
                const backgroundColor =
                  isCurrent || isRowHovered ? UCAT_COLORS.highlightYellow : UCAT_COLORS.mutedGray
                return (
                  <tr
                    key={row.question.id}
                    className={`group border-b ${
                      isRowHovered ? 'border-[#1b4c7d]' : 'border-transparent'
                    }`}
                    style={{ backgroundColor }}
                    onMouseEnter={() => setHoveredRowIndex(row.index)}
                    onMouseLeave={() => setHoveredRowIndex(null)}
                  >
                    <td
                      className="cursor-pointer border border-[#9ba9bd] px-2 py-1.5"
                      onDoubleClick={() => onSelect(row.index)}
                    >
                      <span
                        className={isTextHovered ? 'underline' : undefined}
                        onMouseEnter={() => setHoveredTextRowIndex(row.index)}
                        onMouseLeave={() => setHoveredTextRowIndex((current) =>
                          current === row.index ? null : current
                        )}
                      >
                        Question {row.index + 1}
                      </span>
                    </td>
                    <td className="border border-[#9ba9bd] px-2 py-1.5 text-[#d90000]">
                      {row.answered ? '' : 'Unseen'}
                    </td>
                    <td className="border border-[#9ba9bd] px-2 py-1.5 text-center align-middle">
                      {row.flagged ? (
                        <span className="inline-flex items-center justify-center">
                          <Flag className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">Flagged for review</span>
                        </span>
                      ) : (
                        ''
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-col gap-15">
          <div className="text-left text-[11pt]">
            {unseenOrIncompleteCount} Unseen/Incomplete
          </div>
          <div className="flex justify-end">
            <UcatExamActionButton borders="all" onClick={onClose}>
              <span>
                <span className="underline">C</span>lose
              </span>
            </UcatExamActionButton>
          </div>
        </div>
      </UcatFloatingPanel>
    </div>
  )
}

