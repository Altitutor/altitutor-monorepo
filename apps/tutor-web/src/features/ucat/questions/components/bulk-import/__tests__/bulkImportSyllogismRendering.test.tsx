import React from 'react'
import type { Json } from '@altitutor/shared'
import { render, screen } from '@testing-library/react'

jest.mock('@/shared/utils', () => ({
  cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(' '),
}))
jest.mock('@/features/ucat/question-engine-preview/UcatRichContentBlock', () => ({
  UcatRichContentBlock: ({ plainText }: { plainText: string }) => <span>{plainText}</span>,
}))

function collectPlainText(value: Json | null | undefined): string {
  if (!value || typeof value !== 'object') return ''
  const rec = value as Record<string, unknown>
  if (typeof rec.text === 'string') return rec.text
  const content = rec.content
  if (!Array.isArray(content)) return ''
  return content.map((child) => collectPlainText(child as Json)).join('')
}

jest.mock('../BulkImportRichTextPreview', () => ({
  BulkImportRichTextPreview: ({
    json,
    emptyFallback,
  }: {
    json?: Json | null
    emptyFallback?: React.ReactNode
  }) => {
    const plain = collectPlainText(json ?? null).trim()
    if (!plain) return emptyFallback ?? <span />
    return <span>{plain}</span>
  },
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
          responseType: 'drag_and_drop', answerScheme: 'decision_making_binary_placement',
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
        isPlacement: true,
        optionCount: 1,
      },
      questionText: "Place 'Yes' if the conclusion does follow.",
      questionTextDoc: doc("Place 'Yes' if the conclusion does follow."),
      options: [{ label: 'a', answerTextDoc: doc('All physicians are insured.'), isKeyed: false }],
      answerLetter: null,
      placementPattern: 'N',
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

  it('does not show raw [[B:]] tokens in the parsed question preview', () => {
    render(
      <CollapsibleParsedQuestionCard
        question={{
          number: 1,
          text: '[[B:]]She says that the probability that her next baby will be a boy is 50%. Is she correct?[[/B:]]',
          options: [{ label: 'A', text: '[[B:]]Yes[[/B:]], independent births' }],
        }}
        index={0}
        expanded
        onToggle={jest.fn()}
      />,
    )

    expect(screen.queryByText(/\[\[B:\]\]/)).not.toBeInTheDocument()
    expect(
      screen.getByText(
        'She says that the probability that her next baby will be a boy is 50%. Is she correct?'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('Yes, independent births')).toBeInTheDocument()
  })
})
