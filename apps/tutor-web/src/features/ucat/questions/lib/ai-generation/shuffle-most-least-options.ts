import type { GeneratedStem } from '@/features/ucat/questions/lib/ai-generation/schema'

function createSeededRandom(seed: string): () => number {
  let state = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index)
    state = Math.imul(state, 16777619)
  }
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state)
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state)
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffleWithSeed<T>(items: readonly T[], seed: string): T[] {
  const random = createSeededRandom(seed)
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const current = copy[index] as T
    copy[index] = copy[swapIndex] as T
    copy[swapIndex] = current
  }
  return copy
}

export function shuffleGeneratedStemMostLeastOptions(stem: GeneratedStem, seed: string): GeneratedStem {
  return {
    ...stem,
    questions: stem.questions.map((question, questionIndex) => {
      if (
        question.answerScheme !== 'situational_judgement_most_least'
        || question.options.length !== 3
      ) {
        return question
      }
      return {
        ...question,
        options: shuffleWithSeed(question.options, `${seed}:q${questionIndex}`),
      }
    }),
  }
}
