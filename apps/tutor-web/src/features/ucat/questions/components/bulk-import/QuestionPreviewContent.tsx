'use client'

import type { Json } from '@altitutor/shared'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

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
  const stemPlain = proseMirrorToPlainText(stemTextJson)?.trim() ?? ''
  const stemParagraphs = stemPlain ? stemPlain.split('\n') : []
  const questionText = proseMirrorToPlainText(questionTextJson)?.trim() ?? ''
  const questionExplanation = questionAnswerExplanationJson
    ? proseMirrorToPlainText(questionAnswerExplanationJson)?.trim()
    : ''
  const optionLabels = ['A', 'B', 'C', 'D', 'E']
  const showSyllogismStyle = isSyllogism && syllogismPattern && syllogismPattern.length >= options.length

  return (
    <div className="rounded-md border border-border bg-muted/30 text-[11pt] leading-relaxed">
      <div className="space-y-4 p-4">
        {stemParagraphs.length > 0 ? (
          <article className="space-y-2">
            {stemParagraphs.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </article>
        ) : null}
        <section className="space-y-2">
          <h4 className="text-[12pt] font-medium">
            {questionNumber}. {questionText}
          </h4>
          <div className="space-y-1.5 pl-8">
            {options.map((opt, index) => {
              const text = proseMirrorToPlainText(opt.answerText)?.trim() ?? ''
              const optionExplanation = opt.answerExplanation
                ? proseMirrorToPlainText(opt.answerExplanation)?.trim()
                : ''
              const isCorrect = index === correctOptionIndex
              const yn = showSyllogismStyle
                ? (syllogismPattern?.charAt(index) === 'Y' ? 'Yes' : 'No')
                : null
              const letter = optionLabels[index] ?? String(index + 1)

              return (
                <div
                  key={index}
                  className="flex items-start gap-3 gap-y-0"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    {showSyllogismStyle ? (
                      <>
                        <span className="whitespace-pre-wrap">{text}</span>
                        <span className="shrink-0 font-medium text-muted-foreground">
                          {yn}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="inline-block w-8 shrink-0">
                          {letter}.{isCorrect ? ' ✓' : ''}
                        </span>
                        <span className="whitespace-pre-wrap">{text}</span>
                      </>
                    )}
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
