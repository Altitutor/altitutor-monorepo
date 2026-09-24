import type {
  BlindSolutionResponse,
  UcatAssessmentSnapshot,
} from '@/features/ucat/questions/lib/ai-assessment/schema'

function normalizedOptionReference(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, ' ').trim()
}

export function normalizeBlindSolutionSelections(
  solution: BlindSolutionResponse,
  snapshot: UcatAssessmentSnapshot,
): BlindSolutionResponse {
  const questions = new Map(snapshot.questions.map((question) => [question.id, question]))
  return {
    ...solution,
    solutions: solution.solutions.map((item) => {
      const question = questions.get(item.questionId)
      if (!question || question.responseType === 'drag_and_drop' || !item.selectedOptionId) return item
      const raw = item.selectedOptionId.trim()
      const exact = question.options.find((option) => option.id === raw)
      if (exact) return item

      const letterMatch = raw.match(/^(?:option\s*)?([a-z])(?:\s*\.)?$/iu)
      const letterIndex = letterMatch?.[1]
        ? letterMatch[1].toUpperCase().charCodeAt(0) - 65
        : -1
      const numericMatch = raw.match(/^(?:option\s*)?(\d+)$/iu)
      const numeric = numericMatch?.[1] ? Number(numericMatch[1]) : null
      const normalizedRaw = normalizedOptionReference(raw)
      const normalizedProposed = normalizedOptionReference(item.proposedAnswer ?? '')
      const textMatches = question.options.filter((option) => {
        const answer = normalizedOptionReference(option.answerTextPlain)
        return Boolean(
          answer
          && (
            normalizedRaw === answer
            || normalizedProposed === answer
            || (answer.length >= 4 && normalizedRaw.includes(answer))
            || (answer.length >= 4 && normalizedProposed.includes(answer))
          )
        )
      })
      const resolved = letterIndex >= 0
        ? question.options[letterIndex]
        : numeric != null
          ? numeric === 0
            ? question.options.find((option) => option.index === 0) ?? question.options[0]
            : question.options[numeric - 1] ?? question.options.find((option) => option.index === numeric)
          : textMatches.length === 1
            ? textMatches[0]
            : null
      if (resolved) return { ...item, selectedOptionId: resolved.id }

      // Preserve the solver's answer for the moderator rather than failing the
      // whole review because the provider put a label/text in the ID field.
      return {
        ...item,
        selectedOptionId: null,
        proposedAnswer: item.proposedAnswer || raw,
        ambiguous: true,
        justification: `${item.justification} The solver returned an option reference that could not be mapped safely to a supplied option ID: ${raw}.`,
      }
    }),
  }
}
