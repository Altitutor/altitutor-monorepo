'use client'

import type { Json } from '@altitutor/shared'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'

type OptionInput = {
  answerText: Json
  answerExplanation?: Json | null
}

/**
 * Read-only preview of a single question in the same layout as ucat-web question-engine
 * content area: stem text, question number + question text (list style), options indented
 * (with optional per-option explanation to the right), and optional question-level
 * answer explanation at the bottom. For syllogisms, options are shown as statement + Yes/No.
 */
export function QuestionPreviewContent({
  questionNumber,
  stemTextJson,
  questionTextJson,
  questionAnswerExplanationJson,
  options,
  correctOptionIndex,
  isSyllogism = false,
  syllogismPattern = null,
}: {
  /** Display number for this question (e.g. 1–40 in bulk import). UI-only, not persisted. */
  questionNumber: number
  stemTextJson: Json | null | undefined
  questionTextJson: Json | null | undefined
  /** ucat_questions.answer_explanation – shown below all options when present */
  questionAnswerExplanationJson?: Json | null
  options: OptionInput[]
  correctOptionIndex: number
  /** When true and syllogismPattern is set, show each statement with Yes/No instead of A. B. C. */
  isSyllogism?: boolean
  syllogismPattern?: string | null
}) {
  const questionText = proseMirrorToPlainText(questionTextJson)?.trim() ?? ''
  const questionExplanation = questionAnswerExplanationJson
    ? proseMirrorToPlainText(questionAnswerExplanationJson)?.trim()
    : ''
  const optionLabels = ['A', 'B', 'C', 'D', 'E']
  /** Show syllogism table (Statement | Answer | Explanation) whenever question is syllogism; use pattern for Yes/No when set, else "—". */
  const showSyllogismStyle = isSyllogism
  const hasAnyOptionExplanation = options.some(
    (opt) => opt.answerExplanation && proseMirrorToPlainText(opt.answerExplanation)?.trim()
  )

  return (
    <div className="rounded-md border border-border bg-muted/30 text-[11pt] leading-relaxed">
      <div className="space-y-4 p-4">
        {stemTextJson ? (
          <article className="space-y-2">
            <UcatRichTextEditor
              value={stemTextJson as Json}
              onChange={undefined}
              editable={false}
              minHeight="0"
            />
          </article>
        ) : null}
        <section className="space-y-2">
          <h4 className="text-[12pt] font-medium">
            {questionNumber}. {questionText}
          </h4>
          {showSyllogismStyle ? (
            <div className="pl-4 overflow-x-auto">
              <table className="w-full border-collapse text-[11pt]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 pr-4 font-medium text-muted-foreground">Statement</th>
                    <th className="text-left py-1.5 pr-4 w-16 font-medium text-muted-foreground">Answer</th>
                    {hasAnyOptionExplanation ? (
                      <th className="text-left py-1.5 font-medium text-muted-foreground">Explanation</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {options.map((opt, index) => {
                    const optionExplanation = opt.answerExplanation
                      ? proseMirrorToPlainText(opt.answerExplanation)?.trim()
                      : ''
                    const char = syllogismPattern?.charAt(index)
                    const yn = char === 'Y' ? 'Yes' : char === 'N' ? 'No' : '—'
                    return (
                      <tr key={index} className="border-b border-border/60">
                        <td className="py-1.5 pr-4 align-top whitespace-pre-wrap">
                          <UcatRichTextEditor
                            value={opt.answerText as Json}
                            onChange={undefined}
                            editable={false}
                            minHeight="0"
                          />
                        </td>
                        <td className="py-1.5 pr-4 align-top font-medium text-muted-foreground">{yn}</td>
                        {hasAnyOptionExplanation ? (
                          <td className="py-1.5 align-top text-[10pt] text-muted-foreground whitespace-pre-wrap">
                            {optionExplanation || '—'}
                          </td>
                        ) : null}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-1.5 pl-8">
              {options.map((opt, index) => {
                const optionExplanation = opt.answerExplanation
                  ? proseMirrorToPlainText(opt.answerExplanation)?.trim()
                  : ''
                const isCorrect = index === correctOptionIndex
                const letter = optionLabels[index] ?? String(index + 1)

                return (
                  <div
                    key={index}
                    className="flex items-start gap-3 gap-y-0"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <span className="inline-block w-8 shrink-0">
                        {letter}.{isCorrect ? ' ✓' : ''}
                      </span>
                      <div className="whitespace-pre-wrap flex-1">
                        <UcatRichTextEditor
                          value={opt.answerText as Json}
                          onChange={undefined}
                          editable={false}
                          minHeight="0"
                        />
                      </div>
                    </div>
                    {optionExplanation ? (
                      <div className="w-[45%] shrink-0 border-l border-border pl-3 text-[10pt] text-muted-foreground">
                        <span className="whitespace-pre-wrap">{optionExplanation}</span>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
          {questionExplanation ? (
            <div className="mt-3 border-t border-border pt-3 text-[10pt] text-muted-foreground">
              <span className="whitespace-pre-wrap">{questionExplanation}</span>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
