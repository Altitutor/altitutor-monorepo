import type { QuestionItem } from '@/features/question-engine/model/types'
import { UCAT_COLORS, UCAT_FONTS } from '@altitutor/ui/src/components/ucat/ucat-theme'

export function QuestionContent({
  question,
  selectedOptionId,
  onSelectOption,
}: {
  question: QuestionItem
  selectedOptionId?: string
  onSelectOption: (optionId: string) => void
}) {
  const isTwoColumn = question.sectionDisplayColumns === 2

  if (isTwoColumn) {
    return (
      <div className={`flex h-full min-h-0 gap-4 font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed`}>
        <article
          className="flex-[3] h-full min-w-0 overflow-y-auto border-r-[6px] pr-4 py-4 sm:py-5"
          style={{ borderRightColor: UCAT_COLORS.primaryBlue }}
        >
          <div className="space-y-3">
            <p>{question.stemText}</p>
          </div>
        </article>
        <section className="flex-[2] h-full min-w-0 overflow-y-auto pl-2 pr-1 py-4 sm:py-5">
          <div className="space-y-3">
            <h4 className="font-medium text-[12pt]">{question.questionText}</h4>
            <div className="space-y-2 pl-6">
              {question.options.map((option, index) => {
                const letter = String.fromCharCode(65 + index)
                return (
                  <label key={option.id} className="flex items-start gap-2">
                    <input
                      type="radio"
                      name={question.id}
                      checked={selectedOptionId === option.id}
                      onChange={() => onSelectOption(option.id)}
                      className="mt-1 h-4 w-4"
                    />
                    <span className="flex">
                      <span className="inline-block w-8">{letter}.</span>
                      <span className="ml-4">{option.text}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className={`h-full overflow-auto font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed`}>
      <div className="space-y-4 py-4 sm:py-5">
        <article className="space-y-3">
          <p>{question.stemText}</p>
        </article>
        <section className="space-y-3">
          <h4 className="font-medium text-[12pt]">{question.questionText}</h4>
          <div className="space-y-2 pl-6">
            {question.options.map((option, index) => {
              const letter = String.fromCharCode(65 + index)
              return (
                <label key={option.id} className="flex items-start gap-2">
                  <input
                    type="radio"
                    name={question.id}
                    checked={selectedOptionId === option.id}
                    onChange={() => onSelectOption(option.id)}
                    className="mt-1 h-4 w-4"
                  />
                  <span className="flex">
                    <span className="inline-block w-8">{letter}.</span>
                    <span className="ml-4">{option.text}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
