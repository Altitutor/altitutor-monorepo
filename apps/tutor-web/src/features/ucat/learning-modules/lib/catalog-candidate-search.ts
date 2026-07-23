import type {
  UcatQuestionCatalogItem,
  UcatStemCatalogItem,
} from '@/features/ucat/questions/hooks/useUcatQuestions'

export type StemCatalogCandidate = {
  id: string
  text: string
  sectionName: string
  categoryName: string | null
  typeSummary: string
  score: number
}

export type QuestionCatalogCandidate = {
  id: string
  label: string
  sectionName: string
  questionType: string
  score: number
}

export function scoreCatalogMatch(query: string, haystack: string): number {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((term) => term.length > 2)
  const target = haystack.toLowerCase()
  if (terms.length === 0) return 0
  return terms.reduce((score, term) => score + (target.includes(term) ? 1 : 0), 0)
}

export function searchQuestionStemCandidates(
  query: string,
  stems: UcatStemCatalogItem[],
  limit = 3,
): StemCatalogCandidate[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  return stems
    .map((stem) => ({
      id: stem.id,
      text: stem.text.slice(0, 180),
      sectionName: stem.sectionName,
      categoryName: stem.categoryName,
      typeSummary: stem.typeSummary,
      score: scoreCatalogMatch(
        trimmed,
        [
          stem.text,
          stem.sectionName,
          stem.categoryName,
          stem.typeSummary,
          stem.questionSearchText,
          stem.answerOptionSearchText,
        ]
          .filter(Boolean)
          .join(' '),
      ),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit))
}

export function searchQuestionCandidates(
  query: string,
  questions: UcatQuestionCatalogItem[],
  limit = 3,
): QuestionCatalogCandidate[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  return questions
    .map((question) => ({
      id: question.id,
      label: question.label,
      sectionName: question.sectionName,
      questionType: question.questionType,
      score: scoreCatalogMatch(
        trimmed,
        [question.label, question.sectionName, question.questionType].filter(Boolean).join(' '),
      ),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit))
}
