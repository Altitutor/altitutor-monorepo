import type { Json } from '@altitutor/shared'
import {
  bulkImportSectionFromUcatName,
  type BulkImportParseSection,
} from '@/features/ucat/questions/components/bulk-import/bulkImportLogicalLines'
import type { ParsedStem } from '@/features/ucat/questions/lib/parsers/core'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
  getDecisionMakingTagPathsForQuestion,
  getDecisionMakingStemCategoryName,
  isSyllogismQuestionText,
  type ParsedDecisionMakingStem,
} from '@/features/ucat/questions/lib/parsers/decisionMaking'
import {
  getQuantitativeReasoningStemCategoryName,
  getQuantitativeReasoningTagPathsForQuestion,
} from '@/features/ucat/questions/lib/parsers/quantitativeReasoning'
import {
  getSituationalJudgementStemCategoryName,
  getSituationalJudgementTagPathsForQuestion,
} from '@/features/ucat/questions/lib/parsers/situationalJudgement'
import {
  getVerbalReasoningStemCategoryName,
  getVerbalReasoningTagPathsForQuestion,
} from '@/features/ucat/questions/lib/parsers/verbalReasoning'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

export type BulkImportCategoryRow = {
  id?: string | null
  ucat_section_id?: string | null
  name?: string | null
}

export type BulkImportTagRow = {
  id?: string | null
  name?: string | null
  parent_question_tag_id?: string | null
  ucat_section_id?: string | null
}

export type ManualStemMetadataRecommendation = {
  sectionId: string | null
  categoryId: string | null
  questionType: 'multiple_choice' | 'syllogism' | null
  tagIdsByQuestionIndex: Record<number, string[]>
}

export type ManualStemMetadataSectionRow = {
  id?: string | null
  name?: string | null
}

type ResolvedTagRow = BulkImportTagRow & { id: string; name: string }

function getCategoryIdByName(categories: BulkImportCategoryRow[], sectionId: string, name: string | null): string | null {
  if (!name) return null
  return categories.find((c) => (c.ucat_section_id ?? null) === sectionId && (c.name ?? '').trim() === name)?.id ?? null
}

function toDecisionMakingStem(stem: ParsedStem): ParsedDecisionMakingStem {
  return {
    stemText: stem.stemText,
    questions: stem.questions.map((q) => ({
      number: q.number,
      text: q.text,
      options: q.options,
      questionType: isSyllogismQuestionText(q.text) ? 'syllogism' : 'multiple_choice',
    })),
  }
}

function inferCategoryNameForParsedStem(
  stem: ParsedStem,
  section: BulkImportParseSection
): string | null {
  switch (section) {
    case 'verbal_reasoning':
      return getVerbalReasoningStemCategoryName(stem)
    case 'decision_making':
      return getDecisionMakingStemCategoryName(toDecisionMakingStem(stem))
    case 'quantitative_reasoning':
      return getQuantitativeReasoningStemCategoryName(stem)
    case 'situational_judgement':
      return getSituationalJudgementStemCategoryName(stem)
  }
}

function isHighConfidenceSectionCategory(
  section: BulkImportParseSection,
  categoryName: string | null
): boolean {
  if (!categoryName) return false
  if (section === 'verbal_reasoning') return categoryName !== 'Reading Comprehension'
  if (section === 'decision_making') return categoryName !== 'Logical Puzzles'
  if (section === 'quantitative_reasoning') return categoryName !== 'Text-Only Scenarios'
  return true
}

export function inferBulkImportCategoryIdForParsedStem(args: {
  stem: ParsedStem
  section: BulkImportParseSection
  sectionId: string
  categories: BulkImportCategoryRow[]
}): string | null {
  const { stem, section, sectionId, categories } = args
  return getCategoryIdByName(categories, sectionId, inferCategoryNameForParsedStem(stem, section))
}

export function buildBulkImportTagIdByPath(tags: BulkImportTagRow[], sectionId: string): (path: string[]) => string | null {
  const rows = tags.filter((tag): tag is ResolvedTagRow => {
    return typeof tag.id === 'string' && tag.id.length > 0 && typeof tag.name === 'string'
  })
  const byParent = new Map<string | null, ResolvedTagRow[]>()
  for (const row of rows) {
    const parentId = row.parent_question_tag_id ?? null
    const current = byParent.get(parentId) ?? []
    current.push(row)
    byParent.set(parentId, current)
  }

  return (path: string[]) => {
    let parentId: string | null = null
    let matchedId: string | null = null
    for (let index = 0; index < path.length; index += 1) {
      const expected = path[index]?.trim().toLowerCase()
      if (!expected) return null
      const candidates: ResolvedTagRow[] = byParent.get(parentId) ?? []
      const match = candidates.find((candidate: ResolvedTagRow) => {
        const nameMatches = candidate.name.trim().toLowerCase() === expected
        if (!nameMatches) return false
        if (index === 0) return (candidate.ucat_section_id ?? null) === sectionId
        return true
      })
      if (!match) return null
      matchedId = match.id
      parentId = match.id
    }
    return matchedId
  }
}

export function inferBulkImportTagIdsForParsedQuestion(args: {
  stem: ParsedStem
  question: ParsedStem['questions'][number]
  section: BulkImportParseSection
  sectionId: string
  tags: BulkImportTagRow[]
}): string[] {
  const getTagIdByPath = buildBulkImportTagIdByPath(args.tags, args.sectionId)

  const tagPaths =
    args.section === 'decision_making'
      ? getDecisionMakingTagPathsForQuestion({
          stem: toDecisionMakingStem(args.stem),
          question: {
            number: args.question.number,
            text: args.question.text,
            options: args.question.options,
            questionType: isSyllogismQuestionText(args.question.text)
              ? 'syllogism'
              : 'multiple_choice',
          },
        })
      : args.section === 'quantitative_reasoning'
      ? getQuantitativeReasoningTagPathsForQuestion({
          stem: args.stem,
          question: args.question,
        })
      : args.section === 'verbal_reasoning'
        ? getVerbalReasoningTagPathsForQuestion({
            stem: args.stem,
            question: args.question,
          })
        : args.section === 'situational_judgement'
          ? getSituationalJudgementTagPathsForQuestion({
              stem: args.stem,
              question: args.question,
            })
          : []

  return tagPaths
    .map((path) => getTagIdByPath(path))
    .filter((id): id is string => id != null)
}

export function inferQuestionTagIdsForFormValues(args: {
  values: UcatQuestionStemFormValues
  sectionId: string
  section?: BulkImportParseSection | null
  sectionName?: string | null
  tags: BulkImportTagRow[]
}): Record<number, string[]> {
  const section = args.section ?? bulkImportSectionFromUcatName(args.sectionName)
  if (!section) return {}

  const stem = formValuesToParsedStem(args.values)
  const tagIdsByQuestionIndex: Record<number, string[]> = {}
  stem.questions.forEach((question, index) => {
    const tagIds = inferBulkImportTagIdsForParsedQuestion({
      stem,
      question,
      section,
      sectionId: args.sectionId,
      tags: args.tags,
    })
    if (tagIds.length > 0) {
      tagIdsByQuestionIndex[index] = tagIds
    }
  })
  return tagIdsByQuestionIndex
}

function richTextToPlainText(value: Json | null | undefined): string {
  return proseMirrorToPlainText(value ?? null)?.trim() ?? ''
}

function formValuesToParsedStem(values: UcatQuestionStemFormValues): ParsedStem {
  return {
    stemText: richTextToPlainText(values.stemText as Json),
    questions: (values.questions ?? []).map((question, index) => ({
      number: index + 1,
      text: richTextToPlainText(question.questionText as Json),
      options: (question.options ?? []).map((option, optionIndex) => ({
        label: String.fromCharCode(65 + optionIndex),
        text: richTextToPlainText(option.answerText as Json),
      })),
    })),
  }
}

function hasManualStemContent(stem: ParsedStem): boolean {
  if (stem.stemText.trim().length > 0) return true
  return stem.questions.some(
    (question) =>
      question.text.trim().length > 0 ||
      question.options.some((option) => option.text.trim().length > 0)
  )
}

function findSectionDetectionCandidate(args: {
  stem: ParsedStem
  sections: ManualStemMetadataSectionRow[]
  categories: BulkImportCategoryRow[]
}): { sectionId: string; section: BulkImportParseSection; categoryId: string } | null {
  for (const sectionRow of args.sections) {
    if (!sectionRow.id) continue
    const section = bulkImportSectionFromUcatName(sectionRow.name)
    if (!section) continue
    const categoryName = inferCategoryNameForParsedStem(args.stem, section)
    if (!isHighConfidenceSectionCategory(section, categoryName)) continue
    const categoryId = getCategoryIdByName(args.categories, sectionRow.id, categoryName)
    if (categoryId) return { sectionId: sectionRow.id, section, categoryId }
  }
  return null
}

export function inferManualStemMetadataRecommendation(args: {
  values: UcatQuestionStemFormValues
  sections: ManualStemMetadataSectionRow[]
  categories: BulkImportCategoryRow[]
  tags: BulkImportTagRow[]
}): ManualStemMetadataRecommendation | null {
  const stem = formValuesToParsedStem(args.values)
  if (!hasManualStemContent(stem)) return null

  const currentSection =
    args.sections.find((section) => section.id === args.values.sectionId) ?? null
  const currentParseSection = currentSection?.id
    ? bulkImportSectionFromUcatName(currentSection.name)
    : null

  // When a section is already set, only suggest category/tags within that section.
  // Never propose switching away from the tutor's chosen section.
  const sectionCandidate = currentParseSection
    ? null
    : findSectionDetectionCandidate({
        stem,
        sections: args.sections,
        categories: args.categories,
      })

  const sectionId = sectionCandidate?.sectionId ?? currentSection?.id ?? null
  const section = sectionCandidate?.section ?? currentParseSection
  const categoryId =
    sectionCandidate?.categoryId ??
    (section && sectionId
      ? inferBulkImportCategoryIdForParsedStem({
          stem,
          section,
          sectionId,
          categories: args.categories,
        })
      : null)
  const questionType = section === 'decision_making' && categoryId
    ? (() => {
        const category = args.categories.find((row) => row.id === categoryId)
        return (category?.name ?? '').trim().toLowerCase().startsWith('syllogism')
          ? 'syllogism' as const
          : null
      })()
    : null

  const tagIdsByQuestionIndex: Record<number, string[]> = {}
  if (section && sectionId) {
    const sectionNameForTags =
      currentSection?.name ??
      args.sections.find((row) => row.id === sectionCandidate?.sectionId)?.name ??
      null
    Object.assign(tagIdsByQuestionIndex, inferQuestionTagIdsForFormValues({
      values: args.values,
      sectionId,
      section,
      sectionName: sectionNameForTags,
      tags: args.tags,
    }))
  }

  const hasTags = Object.keys(tagIdsByQuestionIndex).length > 0
  if (!sectionCandidate && !categoryId && !hasTags) return null

  return {
    sectionId: sectionCandidate?.sectionId ?? null,
    categoryId,
    questionType,
    tagIdsByQuestionIndex,
  }
}
