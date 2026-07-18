import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import {
  UcatQuestionExportDocument,
  type UcatPdfGroup,
} from '@/features/ucat/shared/pdf/UcatQuestionExportDocument'

const richText = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

const group: UcatPdfGroup = {
  id: 'group-1',
  title: 'Large set',
  stems: Array.from({ length: 30 }, (_, stemIndex) => ({
    id: `stem-${stemIndex}`,
    section_name: 'Verbal Reasoning',
    stem_text: richText(`Passage ${stemIndex + 1} `.repeat(80)),
    questions: Array.from({ length: 4 }, (_, questionIndex) => ({
      id: `question-${stemIndex}-${questionIndex}`,
      index: questionIndex,
      question_type: 'multiple_choice' as const,
      question_text: richText(`Question ${questionIndex + 1}`),
      answer_explanation: richText('Explanation '.repeat(25)),
      answer_options: Array.from({ length: 4 }, (_, optionIndex) => ({
        id: `option-${stemIndex}-${questionIndex}-${optionIndex}`,
        index: optionIndex,
        is_answer: optionIndex === 0,
        answer_text: richText(`Option ${optionIndex + 1} `.repeat(8)),
        answer_explanation: richText('Option explanation '.repeat(8)),
      })),
    })),
  })),
}

async function main() {
  const buffer = await renderToBuffer(
    <UcatQuestionExportDocument
      title="Stress test"
      groups={[group]}
      includeAnswers
      repeatStems
    />,
  )

  if (buffer.subarray(0, 4).toString() !== '%PDF') throw new Error('Invalid PDF')
  console.log(`Rendered ${buffer.length} bytes`)
}

void main()
