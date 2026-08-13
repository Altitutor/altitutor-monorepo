import React, { type ReactNode } from 'react'
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { Json } from '@altitutor/shared'
import { hasRichContent } from '@/features/ucat/shared/pdf/rich-content'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

export type UcatPdfAnswerOption = {
  id: string
  answer_text: Json
  answer_explanation: Json | null
  index: number
  is_answer: boolean
  answer_key_value: 'correct' | 'yes' | 'no' | 'most' | 'least' | null
}

export type UcatPdfQuestion = {
  id: string
  question_text: Json
  answer_explanation: Json | null
  index: number
  question_type: 'multiple_choice' | 'syllogism'
  response_type: 'multiple_choice' | 'drag_and_drop'
  answer_scheme: 'single_choice' | 'situational_judgement_rating' | 'decision_making_binary_placement' | 'situational_judgement_most_least'
  answer_options: UcatPdfAnswerOption[]
}

export type UcatPdfStem = {
  id: string
  section_name: string
  stem_text: Json
  questions: UcatPdfQuestion[]
}

export type UcatPdfGroup = {
  id: string
  title: string
  stems: UcatPdfStem[]
}

const colours = {
  ink: '#172033',
  muted: '#5f6b7a',
  line: '#d7dde5',
  soft: '#f4f6f8',
  brand: '#204c63',
  answer: '#e8f4ed',
  answerInk: '#185c37',
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 42,
    paddingTop: 38,
    paddingBottom: 44,
    color: colours.ink,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.45,
  },
  documentTitle: { fontSize: 21, fontWeight: 700, marginBottom: 5 },
  meta: { color: colours.muted, fontSize: 9, marginBottom: 22 },
  groupTitle: {
    borderBottomColor: colours.brand,
    borderBottomWidth: 1.5,
    color: colours.brand,
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 16,
    paddingBottom: 6,
  },
  stem: {
    backgroundColor: colours.soft,
    borderLeftColor: colours.brand,
    borderLeftWidth: 2,
    marginBottom: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  stemLabel: {
    color: colours.muted,
    fontSize: 8,
    fontWeight: 700,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  question: { marginBottom: 20 },
  questionHeading: { fontSize: 11, fontWeight: 700, marginBottom: 7 },
  paragraph: { marginBottom: 5 },
  heading1: { fontSize: 15, fontWeight: 700, marginBottom: 6, marginTop: 3 },
  heading2: { fontSize: 13, fontWeight: 700, marginBottom: 5, marginTop: 3 },
  heading3: { fontSize: 11, fontWeight: 700, marginBottom: 4, marginTop: 2 },
  listItem: { flexDirection: 'row', marginBottom: 3 },
  listMarker: { width: 18 },
  listBody: { flexGrow: 1, flexBasis: 0 },
  option: { flexDirection: 'row', marginBottom: 6 },
  optionMarker: { color: colours.muted, fontWeight: 700, width: 22 },
  optionBody: { flexGrow: 1, flexBasis: 0 },
  syllogismOption: {
    borderBottomColor: colours.line,
    borderBottomWidth: 0.6,
    marginBottom: 8,
    paddingBottom: 7,
  },
  responseLine: { color: colours.muted, fontSize: 9, marginTop: 4 },
  answerBox: {
    backgroundColor: colours.answer,
    marginTop: 7,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  answerLabel: {
    color: colours.answerInk,
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 3,
  },
  explanation: { color: '#304354', fontSize: 9 },
  image: {
    marginBottom: 7,
    marginTop: 3,
    maxHeight: 260,
    maxWidth: 500,
    objectFit: 'contain',
  },
  table: {
    borderColor: colours.line,
    borderLeftWidth: 0.7,
    borderTopWidth: 0.7,
    marginBottom: 7,
  },
  tableRow: { flexDirection: 'row' },
  tableCell: {
    borderBottomWidth: 0.7,
    borderColor: colours.line,
    borderRightWidth: 0.7,
    flexGrow: 1,
    flexBasis: 0,
    padding: 5,
  },
  rule: {
    borderBottomColor: colours.line,
    borderBottomWidth: 0.7,
    marginBottom: 7,
    marginTop: 2,
  },
  footer: {
    bottom: 18,
    color: colours.muted,
    fontSize: 8,
    left: 42,
    position: 'absolute',
    right: 42,
    textAlign: 'center',
  },
  notice: {
    backgroundColor: '#fff6dd',
    color: '#6f4d00',
    fontSize: 8,
    marginBottom: 14,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
})

type RichNode = Record<string, unknown>

function nodeChildren(node: RichNode): RichNode[] {
  return Array.isArray(node.content)
    ? node.content.filter((child): child is RichNode => child != null && typeof child === 'object')
    : []
}

function textStyle(node: RichNode) {
  const marks = Array.isArray(node.marks) ? node.marks : []
  const types = new Set(
    marks.flatMap((mark) =>
      mark && typeof mark === 'object' && typeof (mark as RichNode).type === 'string'
        ? [String((mark as RichNode).type)]
        : [],
    ),
  )
  return {
    fontStyle: types.has('italic') ? ('italic' as const) : ('normal' as const),
    fontWeight: types.has('bold') ? 700 : 400,
    textDecoration: types.has('underline') ? ('underline' as const) : ('none' as const),
  }
}

function InlineNodes({ nodes }: { nodes: RichNode[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        if (node.type === 'text') {
          return (
            <Text key={index} style={textStyle(node)}>
              {typeof node.text === 'string' ? node.text : ''}
            </Text>
          )
        }
        if (node.type === 'hardBreak') return <Text key={index}>{'\n'}</Text>
        return <InlineNodes key={index} nodes={nodeChildren(node)} />
      })}
    </>
  )
}

function RichBlocks({ value }: { value: Json | null | undefined }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const root = value as RichNode
  const nodes = root.type === 'doc' ? nodeChildren(root) : [root]
  return (
    <>
      {nodes.map((node, index) => (
        <RichBlock key={index} node={node} />
      ))}
    </>
  )
}

function RichBlock({ node }: { node: RichNode }): ReactNode {
  const children = nodeChildren(node)

  if (node.type === 'paragraph') {
    return (
      <Text style={styles.paragraph}>
        <InlineNodes nodes={children} />
      </Text>
    )
  }
  if (node.type === 'heading') {
    const level = Number((node.attrs as RichNode | undefined)?.level ?? 2)
    return (
      <Text style={level === 1 ? styles.heading1 : level === 3 ? styles.heading3 : styles.heading2}>
        <InlineNodes nodes={children} />
      </Text>
    )
  }
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    const start = Number((node.attrs as RichNode | undefined)?.start ?? 1)
    return (
      <View>
        {children.map((child, index) => (
          <View key={index} style={styles.listItem}>
            <Text style={styles.listMarker}>{node.type === 'orderedList' ? `${start + index}.` : '•'}</Text>
            <View style={styles.listBody}>
              {nodeChildren(child).map((item, itemIndex) => (
                <RichBlock key={itemIndex} node={item} />
              ))}
            </View>
          </View>
        ))}
      </View>
    )
  }
  if (node.type === 'image') {
    const attrs = node.attrs && typeof node.attrs === 'object' ? (node.attrs as RichNode) : null
    const src = typeof attrs?.src === 'string' ? attrs.src : null
    // react-pdf's Image is not a DOM image and does not expose an alt prop.
    // eslint-disable-next-line jsx-a11y/alt-text
    return src ? <Image src={src} style={styles.image} /> : null
  }
  if (node.type === 'table') {
    return (
      <View style={styles.table}>
        {children.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.tableRow} wrap={false}>
            {nodeChildren(row).map((cell, cellIndex) => (
              <View key={cellIndex} style={styles.tableCell}>
                {nodeChildren(cell).map((content, contentIndex) => (
                  <RichBlock key={contentIndex} node={content} />
                ))}
              </View>
            ))}
          </View>
        ))}
      </View>
    )
  }
  if (node.type === 'horizontalRule') return <View style={styles.rule} />
  if (node.type === 'text')
    return (
      <Text style={styles.paragraph}>
        <InlineNodes nodes={[node]} />
      </Text>
    )
  return children.length > 0 ? (
    <>
      {children.map((child, index) => (
        <RichBlock key={index} node={child} />
      ))}
    </>
  ) : null
}

function Explanation({ value }: { value: Json | null | undefined }) {
  if (!hasRichContent(value)) return null
  return (
    <View style={styles.explanation}>
      <RichBlocks value={value} />
    </View>
  )
}

function StemBlock({ stem, stemNumber }: { stem: UcatPdfStem; stemNumber: number }) {
  return (
    <View style={styles.stem}>
      <Text style={styles.stemLabel}>Stem {stemNumber}</Text>
      <RichBlocks value={stem.stem_text} />
    </View>
  )
}

function MultipleChoiceOptions({ question, includeAnswers }: { question: UcatPdfQuestion; includeAnswers: boolean }) {
  const sortedOptions = [...question.answer_options].sort((left, right) => left.index - right.index)
  const correctLabels = sortedOptions
    .map((option, index) => (option.answer_key_value === 'correct' || option.is_answer ? String.fromCharCode(65 + index) : null))
    .filter((label): label is string => label != null)

  return (
    <>
      {sortedOptions.map((option, index) => (
        <View key={option.id} style={styles.option}>
          <Text style={styles.optionMarker}>{String.fromCharCode(65 + index)}.</Text>
          <View style={styles.optionBody}>
            <RichBlocks value={option.answer_text} />
            {includeAnswers && hasRichContent(option.answer_explanation) ? (
              <View style={styles.answerBox}>
                <Text style={styles.answerLabel}>{option.answer_key_value === 'correct' || option.is_answer ? 'Correct option' : 'Option explanation'}</Text>
                <Explanation value={option.answer_explanation} />
              </View>
            ) : null}
          </View>
        </View>
      ))}
      {includeAnswers ? (
        <View style={styles.answerBox}>
          <Text style={styles.answerLabel}>Answer: {correctLabels.join(', ') || 'No answer set'}</Text>
          <Explanation value={question.answer_explanation} />
        </View>
      ) : null}
    </>
  )
}

function SyllogismOptions({ question, includeAnswers }: { question: UcatPdfQuestion; includeAnswers: boolean }) {
  return (
    <View>
      {[...question.answer_options]
        .sort((left, right) => left.index - right.index)
        .map((option, index) => (
          <View key={option.id} style={styles.syllogismOption}>
            <Text style={styles.questionHeading}>Statement {index + 1}</Text>
            <RichBlocks value={option.answer_text} />
            <Text style={styles.responseLine}>
              {includeAnswers ? `Answer: ${option.answer_key_value === 'yes' || option.is_answer ? 'Yes' : 'No'}` : 'Response:  Yes  /  No'}
            </Text>
            {includeAnswers ? <Explanation value={option.answer_explanation} /> : null}
          </View>
        ))}
      {includeAnswers && hasRichContent(question.answer_explanation) ? (
        <View style={styles.answerBox}>
          <Text style={styles.answerLabel}>Explanation</Text>
          <Explanation value={question.answer_explanation} />
        </View>
      ) : null}
    </View>
  )
}

function MostLeastOptions({ question, includeAnswers }: { question: UcatPdfQuestion; includeAnswers: boolean }) {
  return (
    <View>
      {[...question.answer_options]
        .sort((left, right) => left.index - right.index)
        .map((option, index) => (
          <View key={option.id} style={styles.syllogismOption}>
            <Text style={styles.questionHeading}>Action {index + 1}</Text>
            <RichBlocks value={option.answer_text} />
            <Text style={styles.responseLine}>
              {includeAnswers
                ? `Answer: ${option.answer_key_value === 'most' ? 'Most appropriate' : option.answer_key_value === 'least' ? 'Least appropriate' : 'Not selected'}`
                : 'Response:  Most appropriate  /  Least appropriate'}
            </Text>
          </View>
        ))}
      {includeAnswers ? <Explanation value={question.answer_explanation} /> : null}
    </View>
  )
}

function QuestionBlock({
  question,
  questionNumber,
  includeAnswers,
}: {
  question: UcatPdfQuestion
  questionNumber: number
  includeAnswers: boolean
}) {
  return (
    <View style={styles.question}>
      <Text style={styles.questionHeading} minPresenceAhead={45}>
        Question {questionNumber}
      </Text>
      <RichBlocks value={question.question_text} />
      {question.answer_scheme === 'decision_making_binary_placement' ? (
        <SyllogismOptions question={question} includeAnswers={includeAnswers} />
      ) : question.answer_scheme === 'situational_judgement_most_least' ? (
        <MostLeastOptions question={question} includeAnswers={includeAnswers} />
      ) : (
        <MultipleChoiceOptions question={question} includeAnswers={includeAnswers} />
      )}
    </View>
  )
}

function imageCount(value: Json | null | undefined): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0
  const node = value as RichNode
  return (node.type === 'image' ? 1 : 0) + nodeChildren(node).reduce((sum, child) => sum + imageCount(child as Json), 0)
}

function questionFitsOnOnePage(question: UcatPdfQuestion, includeAnswers: boolean) {
  const values = [
    question.question_text,
    ...question.answer_options.map((option) => option.answer_text),
    ...(includeAnswers
      ? [
          question.answer_explanation,
          ...question.answer_options.map((option) => option.answer_explanation),
        ]
      : []),
  ]
  const characters = values.reduce<number>((sum, value) => sum + proseMirrorToPlainText(value ?? null).length, 0)
  const images = values.reduce<number>((sum, value) => sum + imageCount(value), 0)
  const estimatedLines = Math.ceil(characters / 75) + question.answer_options.length * 2 + images * 18
  return estimatedLines <= 40
}

function GroupContent({
  group,
  includeAnswers,
  repeatStems,
  avoidQuestionPageBreaks,
}: {
  group: UcatPdfGroup
  includeAnswers: boolean
  repeatStems: boolean
  avoidQuestionPageBreaks: boolean
}) {
  let questionNumber = 0
  return (
    <>
      {group.stems.map((stem, stemIndex) => (
        <View key={stem.id}>
          {!repeatStems ? <StemBlock stem={stem} stemNumber={stemIndex + 1} /> : null}
          {[...stem.questions]
            .sort((left, right) => left.index - right.index)
            .map((question) => {
              questionNumber += 1
              return (
                <React.Fragment key={question.id}>
                  {repeatStems ? <StemBlock stem={stem} stemNumber={stemIndex + 1} /> : null}
                  <View wrap={!avoidQuestionPageBreaks || !questionFitsOnOnePage(question, includeAnswers)}>
                    <QuestionBlock question={question} questionNumber={questionNumber} includeAnswers={includeAnswers} />
                  </View>
                </React.Fragment>
              )
            })}
        </View>
      ))}
    </>
  )
}

export function UcatQuestionExportDocument({
  title,
  groups,
  includeAnswers,
  repeatStems,
  avoidQuestionPageBreaks,
  notice,
}: {
  title: string
  groups: UcatPdfGroup[]
  includeAnswers: boolean
  repeatStems: boolean
  avoidQuestionPageBreaks: boolean
  notice?: string
}) {
  const exportedAt = new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'long',
  }).format(new Date())
  return (
    <Document title={title} author="Altitutor" subject="UCAT question export">
      {groups.map((group, index) => (
        <Page key={group.id} size="A4" style={styles.page}>
          {index === 0 ? (
            <>
              <Text style={styles.documentTitle}>{title}</Text>
              <Text style={styles.meta}>
                {includeAnswers ? 'Questions, answers and explanations' : 'Questions'} · Exported {exportedAt}
              </Text>
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            </>
          ) : null}
          <Text style={styles.groupTitle}>{group.title}</Text>
          <GroupContent
            group={group}
            includeAnswers={includeAnswers}
            repeatStems={repeatStems}
            avoidQuestionPageBreaks={avoidQuestionPageBreaks}
          />
          <Text style={styles.footer} fixed>Altitutor UCAT export</Text>
        </Page>
      ))}
    </Document>
  )
}
