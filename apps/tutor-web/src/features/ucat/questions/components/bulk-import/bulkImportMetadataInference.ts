import type { BulkImportParseSection } from '@/features/ucat/questions/components/bulk-import/bulkImportLogicalLines'
import type { ParsedStem } from '@/features/ucat/questions/lib/parsers/core'
import {
  getDecisionMakingStemCategoryName,
  isSyllogismQuestionText,
  type ParsedDecisionMakingStem,
} from '@/features/ucat/questions/lib/parsers/decisionMaking'
import {
  getQuantitativeReasoningStemCategoryName,
  getQuantitativeReasoningTagPathsForQuestion,
} from '@/features/ucat/questions/lib/parsers/quantitativeReasoning'
import { getSituationalJudgementStemCategoryName } from '@/features/ucat/questions/lib/parsers/situationalJudgement'
import { getVerbalReasoningStemCategoryName } from '@/features/ucat/questions/lib/parsers/verbalReasoning'

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

export function inferBulkImportCategoryIdForParsedStem(args: {
  stem: ParsedStem
  section: BulkImportParseSection
  sectionId: string
  categories: BulkImportCategoryRow[]
}): string | null {
  const { stem, section, sectionId, categories } = args
  switch (section) {
    case 'verbal_reasoning':
      return getCategoryIdByName(categories, sectionId, getVerbalReasoningStemCategoryName(stem))
    case 'decision_making':
      return getCategoryIdByName(categories, sectionId, getDecisionMakingStemCategoryName(toDecisionMakingStem(stem)))
    case 'quantitative_reasoning':
      return getCategoryIdByName(categories, sectionId, getQuantitativeReasoningStemCategoryName(stem))
    case 'situational_judgement':
      return getCategoryIdByName(categories, sectionId, getSituationalJudgementStemCategoryName(stem))
  }
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
  if (args.section !== 'quantitative_reasoning') return []
  const getTagIdByPath = buildBulkImportTagIdByPath(args.tags, args.sectionId)
  return getQuantitativeReasoningTagPathsForQuestion({
    stem: args.stem,
    question: args.question,
  })
    .map((path) => getTagIdByPath(path))
    .filter((id): id is string => id != null)
}
