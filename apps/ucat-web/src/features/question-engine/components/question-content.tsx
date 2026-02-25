import type { QuestionItem } from '@/features/question-engine/model/types'

export function QuestionContent({
  question,
  selectedOptionId,
  onSelectOption,
}: {
  question: QuestionItem
  selectedOptionId?: string
  onSelectOption: (optionId: string) => void
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[3fr,2fr]">
      <article className="space-y-3 border-r-4 border-[#0b6ca2] pr-4 text-base">
        <h3 className="text-lg font-semibold">{question.sectionName}</h3>
        <p className="leading-relaxed">{question.stemText}</p>
      </article>
      <section className="space-y-3 text-base">
        <h4 className="text-lg font-medium">{question.questionText}</h4>
        <div className="space-y-2">
          {question.options.map((option, index) => (
            <label key={option.id} className="flex items-start gap-2">
              <input
                type="radio"
                name={question.id}
                checked={selectedOptionId === option.id}
                onChange={() => onSelectOption(option.id)}
                className="mt-1 h-4 w-4"
              />
              <span>
                {String.fromCharCode(65 + index)}. {option.text}
              </span>
            </label>
          ))}
        </div>
      </section>
    </div>
  )
}
