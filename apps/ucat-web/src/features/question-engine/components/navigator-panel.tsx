import { Navigation } from 'lucide-react'
import { UcatExamActionButton, UcatFloatingPanel } from '@altitutor/ui'
import type { QuestionItem } from '@/features/question-engine/model/types'

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
  return (
    <UcatFloatingPanel
      title="Navigator - select a question to go to it"
      titleIcon={<Navigation className="h-5 w-5" />}
      onClose={onClose}
      className="w-full max-w-5xl"
    >
      <div className="overflow-hidden rounded border border-[#9ba9bd] bg-[#dcdcdc] text-sm">
        <table className="w-full">
          <thead className="bg-[#4f7ec1] text-white">
            <tr>
              <th className="border border-[#9ba9bd] px-2 py-1.5 text-left">Question #</th>
              <th className="border border-[#9ba9bd] px-2 py-1.5 text-left">Status</th>
              <th className="border border-[#9ba9bd] px-2 py-1.5 text-left">Flagged - Review</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((question, index) => {
              const isCurrent = index === currentIndex
              const flagged = flaggedIds.includes(question.id)
              const answered = Boolean(selectedAnswers[question.id])
              return (
                <tr
                  key={question.id}
                  className={isCurrent ? 'bg-[#f0ef69]' : 'bg-[#dcdcdc]'}
                  onClick={() => onSelect(index)}
                >
                  <td className="cursor-pointer border border-[#9ba9bd] px-2 py-1.5">Question {index + 1}</td>
                  <td className="border border-[#9ba9bd] px-2 py-1.5 text-[#d10f0f]">
                    {answered ? 'Complete' : 'Unseen'}
                  </td>
                  <td className="border border-[#9ba9bd] px-2 py-1.5">{flagged ? 'Flagged' : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex justify-end">
        <UcatExamActionButton onClick={onClose}>Close</UcatExamActionButton>
      </div>
    </UcatFloatingPanel>
  )
}
