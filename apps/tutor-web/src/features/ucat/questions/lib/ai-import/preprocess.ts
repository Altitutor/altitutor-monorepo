import type { Json } from '@altitutor/shared'
import {
  getBulkImportLogicalLines,
  type BulkImportParseSection,
} from '@/features/ucat/questions/components/bulk-import/bulkImportLogicalLines'
import type { AiImportSectionKey } from '@/features/ucat/questions/lib/ai-import/schema'

export type AiImportSourceBlock = {
  id: string
  text: string
}

export type AiImportPreprocessResult = {
  blocks: AiImportSourceBlock[]
  summary: {
    estimatedQuestions: number
    estimatedAnswerRows: number
    imageCount: number
    blockCount: number
    firstImageBlockIndex: number | null
    questionMarkersBeforeFirstImage: number
    imageTokenSanitizeCount: number
    imageTokenCharsSaved: number
  }
}

function sanitizeImageTokensForAi(input: string): {
  text: string
  replacements: number
  charsSaved: number
} {
  let replacements = 0
  let charsSaved = 0
  const text = input.replace(/\[\[IMG:[^\]]+\]\]/g, (token) => {
    replacements += 1
    const replacement = '[[IMG]]'
    charsSaved += Math.max(0, token.length - replacement.length)
    return replacement
  })
  return { text, replacements, charsSaved }
}

function sectionToBulkParseSection(section: AiImportSectionKey): BulkImportParseSection {
  switch (section) {
    case 'verbal_reasoning':
    case 'decision_making':
    case 'quantitative_reasoning':
    case 'situational_judgement':
      return section
  }
}

function estimateQuestionCount(lines: string[]): number {
  const questionStart = lines.filter(
    (line) => /^\s*\d+[\.\)]\s+/u.test(line) || /^\s*\d+[\.\)]\s*$/u.test(line)
  ).length
  return questionStart
}

function estimateAnswerRowCount(lines: string[]): number {
  const answerRows = lines.filter(
    (line) =>
      /^\s*[A-Ea-e][\.\)]\s+/u.test(line) ||
      /^\s*\d+\s*\t\s*[A-Ea-e]/u.test(line) ||
      /^\s*[A-Ea-e]\s*\t/u.test(line) ||
      /^\s*[YyNn]\s*$/u.test(line)
  ).length
  return answerRows
}

function countImagesInNode(node: unknown): number {
  if (!node || typeof node !== 'object') return 0
  const rec = node as Record<string, unknown>
  let count = rec.type === 'image' ? 1 : 0
  const content = rec.content
  if (Array.isArray(content)) {
    for (const child of content) {
      count += countImagesInNode(child)
    }
  }
  return count
}

export function preprocessAiImportDocument(
  doc: Json | null | undefined,
  section: AiImportSectionKey
): AiImportPreprocessResult {
  const lines = getBulkImportLogicalLines(doc, sectionToBulkParseSection(section))
  let imageTokenSanitizeCount = 0
  let imageTokenCharsSaved = 0
  const blocks = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((text, index) => {
      const sanitized = sanitizeImageTokensForAi(text)
      imageTokenSanitizeCount += sanitized.replacements
      imageTokenCharsSaved += sanitized.charsSaved
      return {
        id: `b${index + 1}`,
        text: sanitized.text,
      }
    })
  const firstImageBlockIndex = blocks.findIndex((block) => block.text.includes('[[IMG:'))
  const beforeImageSlice =
    firstImageBlockIndex >= 0 ? blocks.slice(0, firstImageBlockIndex) : blocks
  const questionMarkersBeforeFirstImage = beforeImageSlice.filter(
    (block) =>
      /^\s*\d+[\.\)]\s+/u.test(block.text) || /^\s*\d+[\.\)]\s*$/u.test(block.text)
  ).length

  return {
    blocks,
    summary: {
      estimatedQuestions: estimateQuestionCount(lines),
      estimatedAnswerRows: estimateAnswerRowCount(lines),
      imageCount: countImagesInNode(doc),
      blockCount: blocks.length,
      firstImageBlockIndex: firstImageBlockIndex >= 0 ? firstImageBlockIndex : null,
      questionMarkersBeforeFirstImage,
      imageTokenSanitizeCount,
      imageTokenCharsSaved,
    },
  }
}

export function stringifyAiImportSourceBlocks(blocks: AiImportSourceBlock[]): string {
  return blocks.map((block) => `[${block.id}] ${block.text}`).join('\n')
}
