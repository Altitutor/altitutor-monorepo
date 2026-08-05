import React from 'react'
import type { Json } from '@altitutor/shared'
import { render, screen } from '@testing-library/react'

jest.mock('@/shared/utils', () => ({
  cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(' '),
}))
jest.mock('@/features/ucat/question-engine-preview/UcatRichContentBlock', () => ({
  UcatRichContentBlock: ({ plainText }: { plainText: string }) => <span>{plainText}</span>,
}))
jest.mock('../BulkImportRichTextPreview', () => ({
  BulkImportRichTextPreview: ({ emptyFallback }: { emptyFallback?: React.ReactNode }) =>
    emptyFallback ?? <span />,
}))

import { CollapsibleAnswerQuestionCard } from '../CollapsibleAnswerQuestionCard'
import { CollapsibleParsedQuestionCard } from '../CollapsibleParsedQuestionCard'
import type { QuestionAnswerPreview } from '../bulkImportBulkAnswers'

function doc(text: string): Json {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  }
}

describe('bulk-import syllogism rendering', () => {
  it('renders parsed syllogism statements as bullets instead of MCQ labels', () => {
    render(
      <CollapsibleParsedQuestionCard
        question={{
          number: 6,
          text: "Place 'Yes' if the conclusion does follow.",
          questionType: 'syllogism',
          options: [{ label: 'A', text: 'All physicians are insured.' }],
        }}
        index={0}
        expanded
        onToggle={jest.fn()}
      />,
    )

    expect(screen.getByText('•')).toBeInTheDocument()
    expect(screen.queryByText('A)')).not.toBeInTheDocument()
  })

  it('renders answer-preview syllogism statements as bullets instead of MCQ labels', () => {
    const preview: QuestionAnswerPreview = {
      row: {
        stemId: 'stem-1',
        stemIndex: 0,
        questionIndex: 0,
        globalIndex: 0,
        label: 'Stem 1 · Q1',
        isSyllogism: true,
        optionCount: 1,
      },
      questionText: "Place 'Yes' if the conclusion does follow.",
      questionTextDoc: doc("Place 'Yes' if the conclusion does follow."),
      options: [{ label: 'a', answerTextDoc: doc('All physicians are insured.'), isAnswer: false }],
      answerLetter: null,
      syllogismPattern: 'N',
      explanationPreview: null,
      explanationPreviewDoc: null,
      hasExplanation: false,
      isParsed: false,
    }

    render(
      <CollapsibleAnswerQuestionCard
        preview={preview}
        expanded
        onToggle={jest.fn()}
      />,
    )

    expect(screen.getByText('•')).toBeInTheDocument()
    expect(screen.queryByText('A)')).not.toBeInTheDocument()
  })
})
