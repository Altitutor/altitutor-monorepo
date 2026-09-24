import type { Json } from '@altitutor/shared'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import type { UcatPdfGroup, UcatPdfStem } from '@/features/ucat/shared/pdf/UcatQuestionExportDocument'

type RichNode = Record<string, unknown>

function normalizeText(value: Json | null): string {
  return proseMirrorToPlainText(value)
    .normalize('NFC')
    .replace(/\u00ad/gu, '')
    .replace(/[\u200b-\u200d\u2060\ufeff]/gu, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, '')
    .replace(/\t/gu, '  |  ')
}

function collectImages(value: Json | null): Json[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  const images: Json[] = []

  function walk(node: RichNode) {
    if (node.type === 'image' && node.attrs && typeof node.attrs === 'object') {
      const attrs = node.attrs as RichNode
      if (typeof attrs.src === 'string' && attrs.src.length > 0) {
        images.push({
          type: 'image',
          attrs: {
            src: attrs.src,
            alt: typeof attrs.alt === 'string' ? attrs.alt : '',
          },
        })
      }
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        if (child && typeof child === 'object' && !Array.isArray(child)) walk(child as RichNode)
      }
    }
  }

  walk(value as RichNode)
  return images
}

export function simplifyRichText(value: Json | null, includeImages: boolean): Json {
  const text = normalizeText(value)
  const paragraphs: Json[] = text.split(/\r?\n/gu).map((line) => ({
    type: 'paragraph',
    content: line ? [{ type: 'text', text: line }] : [],
  }))

  return {
    type: 'doc',
    content: [...paragraphs, ...(includeImages ? collectImages(value) : [])],
  }
}

function simplifyStem(stem: UcatPdfStem, includeImages: boolean): UcatPdfStem {
  return {
    ...stem,
    stem_text: simplifyRichText(stem.stem_text, includeImages),
    questions: stem.questions.map((question) => ({
      ...question,
      question_text: simplifyRichText(question.question_text, includeImages),
      answer_explanation: question.answer_explanation
        ? simplifyRichText(question.answer_explanation, includeImages)
        : null,
      answer_options: question.answer_options.map((option) => ({
        ...option,
        answer_text: simplifyRichText(option.answer_text, includeImages),
        answer_explanation: option.answer_explanation
          ? simplifyRichText(option.answer_explanation, includeImages)
          : null,
      })),
    })),
  }
}

export function simplifyPdfGroups(groups: UcatPdfGroup[], includeImages: boolean): UcatPdfGroup[] {
  return groups.map((group) => ({
    ...group,
    stems: group.stems.map((stem) => simplifyStem(stem, includeImages)),
  }))
}
