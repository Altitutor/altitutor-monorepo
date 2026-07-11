import {
  progressPointsForQuestion,
  toProgressQuestionRef,
} from "@altitutor/shared";

type AttemptWithProgressFields = {
  questionId: string;
  questionStemId?: string | null;
  questionType?: string | null;
  score?: number | null;
};

export function sumCorrectScoreFromAttempts(
  attempts: AttemptWithProgressFields[],
): number {
  let correct = 0;
  for (const attempt of attempts) {
    correct += attempt.score ?? 0;
  }
  return correct;
}

export function sumProgressPointsFromAttempts(
  attempts: AttemptWithProgressFields[],
): number {
  const countedSyllogismStems = new Set<string>();
  let points = 0;
  for (const attempt of attempts) {
    points += progressPointsForQuestion(
      toProgressQuestionRef(attempt),
      countedSyllogismStems,
    );
  }
  return points;
}

export function accumulateProgressByKey<T extends AttemptWithProgressFields>(
  attempts: T[],
  getKey: (attempt: T) => string | null,
): Map<string, { correct: number; max: number }> {
  const grouped = new Map<string, T[]>();
  for (const attempt of attempts) {
    const key = getKey(attempt);
    if (!key) continue;
    const list = grouped.get(key) ?? [];
    list.push(attempt);
    grouped.set(key, list);
  }

  const result = new Map<string, { correct: number; max: number }>();
  for (const [key, list] of grouped) {
    result.set(key, {
      correct: sumCorrectScoreFromAttempts(list),
      max: sumProgressPointsFromAttempts(list),
    });
  }
  return result;
}

type ProgressBucket = {
  correct: number;
  max: number;
  syllogismStems: Set<string>;
};

export function getOrCreateProgressBucket(
  map: Map<string, ProgressBucket>,
  key: string,
): ProgressBucket {
  const existing = map.get(key);
  if (existing) return existing;
  const bucket: ProgressBucket = {
    correct: 0,
    max: 0,
    syllogismStems: new Set<string>(),
  };
  map.set(key, bucket);
  return bucket;
}

export function accumulateProgressAttempt(
  bucket: ProgressBucket,
  attempt: AttemptWithProgressFields,
): void {
  bucket.correct += attempt.score ?? 0;
  bucket.max += progressPointsForQuestion(
    toProgressQuestionRef(attempt),
    bucket.syllogismStems,
  );
}
