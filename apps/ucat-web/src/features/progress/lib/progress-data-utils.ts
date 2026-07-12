import {
  progressPointsForQuestion,
  sumCorrectScoreFromAttempts,
  sumProgressPointsFromAttempts,
  toProgressQuestionRef,
} from "@altitutor/shared";
import {
  getTimeFrameRange,
  getGraphBucketDays,
  getBucketKey,
  getBucketKeysBetween,
  formatWeekRangeLabel,
  formatWeekStartLabel,
} from "./progress-mode";
import type {
  SectionProgress,
  QuestionAttemptRow,
  SetAttemptRow,
  SectionCategoryProgress,
  MockAttemptRow,
  ProgressResponse,
} from "@/app/api/ucat/progress/route";
import type {
  ProgressMode,
  TimeFrameDays,
  AttemptFilter,
} from "./progress-mode";

export function getSectionProgressPercentage(
  section: SectionProgress,
  _mode: ProgressMode,
): number {
  return section.percentage;
}

/** Filter question attempts, set attempts, and mock attempts by the global attempt filter */
export function applyAttemptFilter(
  questionAttempts: QuestionAttemptRow[],
  setAttempts: SetAttemptRow[],
  mockAttempts: MockAttemptRow[],
  filter: AttemptFilter,
): {
  questionAttempts: QuestionAttemptRow[];
  setAttempts: SetAttemptRow[];
  mockAttempts: MockAttemptRow[];
} {
  if (filter === "all") {
    return { questionAttempts, setAttempts, mockAttempts };
  }

  const filteredSetIds = new Set<string>();
  for (const s of setAttempts) {
    const isMockSet = s.studentUcatMockAttemptId != null;
    if (filter === "timed_sets_and_mocks") {
      if (isMockSet || s.wasTimed) filteredSetIds.add(s.id);
    } else if (filter === "mocks_only") {
      if (isMockSet) filteredSetIds.add(s.id);
    }
  }

  const filteredSetAttempts = setAttempts.filter((s) =>
    filteredSetIds.has(s.id),
  );

  const filteredQuestionAttempts = questionAttempts.filter((qa) => {
    const setId = qa.studentQuestionSetAttemptId;
    if (!setId) {
      return false;
    }
    return filteredSetIds.has(setId);
  });

  const filteredMockAttempts = mockAttempts.filter((m) => {
    const childSets = setAttempts.filter(
      (s) => s.studentUcatMockAttemptId === m.id,
    );
    if (childSets.length === 0) return false;
    return true;
  });

  return {
    questionAttempts: filteredQuestionAttempts,
    setAttempts: filteredSetAttempts,
    mockAttempts: filteredMockAttempts,
  };
}

/** Apply attempt filter to full progress response and recompute section progress from filtered data */
export function applyAttemptFilterToProgress(
  data: ProgressResponse,
  filter: AttemptFilter,
): ProgressResponse {
  if (filter === "all") return data;

  const { questionAttempts, setAttempts, mockAttempts } = applyAttemptFilter(
    data.questionAttempts,
    data.setAttempts,
    data.mockAttempts,
    filter,
  );

  const unique = getBestAttemptPerQuestion(questionAttempts);
  const sectionMap = new Map<
    string,
    {
      name: string;
      number: number;
      correct: number;
      max: number;
      syllogismStems: Set<string>;
    }
  >();
  for (const s of data.sectionProgress) {
    sectionMap.set(s.sectionId, {
      name: s.sectionName,
      number: s.sectionNumber,
      correct: 0,
      max: 0,
      syllogismStems: new Set(),
    });
  }
  for (const qa of unique) {
    const sectionId = qa.ucatSectionId;
    if (!sectionId) continue;
    const entry = sectionMap.get(sectionId);
    if (!entry) continue;
    entry.correct += qa.score ?? 0;
    entry.max += progressPointsForQuestion(
      toProgressQuestionRef(qa),
      entry.syllogismStems,
    );
  }
  const sectionProgress: SectionProgress[] = data.sectionProgress.map((s) => {
    const d = sectionMap.get(s.sectionId);
    if (!d) return s;
    const percentage = d.max > 0 ? Math.round((d.correct / d.max) * 100) : 0;
    return {
      ...s,
      correctScore: d.correct,
      maxScore: d.max,
      percentage,
    };
  });

  const categoryMap = new Map<
    string,
    { correct: number; max: number; syllogismStems: Set<string> }
  >();
  for (const qa of unique) {
    const sectionId = qa.ucatSectionId;
    if (!sectionId) continue;
    const categoryId = qa.questionStemCategoryId ?? "__uncategorized__";
    const key = `${sectionId}:${categoryId}`;
    const existing = categoryMap.get(key) ?? {
      correct: 0,
      max: 0,
      syllogismStems: new Set<string>(),
    };
    existing.correct += qa.score ?? 0;
    existing.max += progressPointsForQuestion(
      toProgressQuestionRef(qa),
      existing.syllogismStems,
    );
    categoryMap.set(key, existing);
  }

  const sectionCategoryProgress: Record<string, SectionCategoryProgress[]> = {};
  for (const [sectionId, cats] of Object.entries(
    data.sectionCategoryProgress ?? {},
  )) {
    sectionCategoryProgress[sectionId] = cats.map((cat) => {
      const key = `${sectionId}:${cat.categoryId}`;
      const { correct, max } = categoryMap.get(key) ?? { correct: 0, max: 0 };
      const percentage = max > 0 ? Math.round((correct / max) * 100) : 0;
      return {
        ...cat,
        correctScore: correct,
        maxScore: max,
        percentage,
      };
    });
  }

  return {
    ...data,
    sectionProgress,
    setAttempts,
    mockAttempts,
    questionAttempts,
    sectionCategoryProgress,
  };
}

function isInRange(date: Date | string, start: Date, end: Date): boolean {
  const d = typeof date === "string" ? new Date(date) : date;
  return d >= start && d <= end;
}

/** Keep best attempt per question (highest score, then most recent). */
export function getBestAttemptPerQuestion(
  attempts: QuestionAttemptRow[],
): QuestionAttemptRow[] {
  const byQuestion = new Map<string, QuestionAttemptRow>();
  for (const a of attempts) {
    const qid = a.questionId || a.id;
    const existing = byQuestion.get(qid);
    const score = a.score ?? 0;
    const existingScore = existing?.score ?? 0;
    if (
      !existing ||
      score > existingScore ||
      (score === existingScore && a.attemptedAt > (existing.attemptedAt ?? ""))
    ) {
      byQuestion.set(qid, a);
    }
  }
  return [...byQuestion.values()];
}

/** Filter attempts by time frame when mode is time_frame */
export function filterByTimeFrame<
  T extends { attemptedAt: string; completedAt?: string | null },
>(items: T[], mode: ProgressMode, timeFrameDays: TimeFrameDays): T[] {
  if (mode !== "time_frame") return items;
  const days = parseInt(timeFrameDays, 10) || 30;
  const { start, end } = getTimeFrameRange(days);
  return items.filter((a) => {
    const d = a.completedAt ?? a.attemptedAt;
    return isInRange(d, start, end);
  });
}

/** Compute stats for a single section from filtered attempts (for time_frame mode) */
export function computeSingleSectionFromFiltered(
  questionAttempts: QuestionAttemptRow[],
  _setAttempts: SetAttemptRow[],
  section: SectionProgress,
): SectionProgress {
  const unique = getBestAttemptPerQuestion(questionAttempts);
  const correct = sumCorrectScoreFromAttempts(unique);
  const max = sumProgressPointsFromAttempts(unique);
  const percentage = max > 0 ? Math.round((correct / max) * 100) : 0;
  return {
    ...section,
    correctScore: correct,
    maxScore: max,
    percentage,
  };
}

/** Compute section progress from filtered data (for time_frame mode) */
export function computeSectionProgressFromFiltered(
  questionAttempts: QuestionAttemptRow[],
  _setAttempts: SetAttemptRow[],
  sectionProgress: SectionProgress[],
): SectionProgress[] {
  const sectionMap = new Map<
    string,
    {
      name: string;
      number: number;
      correct: number;
      max: number;
      syllogismStems: Set<string>;
    }
  >();
  for (const s of sectionProgress) {
    sectionMap.set(s.sectionId, {
      name: s.sectionName,
      number: s.sectionNumber,
      correct: 0,
      max: 0,
      syllogismStems: new Set(),
    });
  }
  const unique = getBestAttemptPerQuestion(questionAttempts);
  for (const qa of unique) {
    const sectionId = qa.ucatSectionId;
    if (!sectionId) continue;
    const entry = sectionMap.get(sectionId);
    if (!entry) continue;
    entry.correct += qa.score ?? 0;
    entry.max += progressPointsForQuestion(
      toProgressQuestionRef(qa),
      entry.syllogismStems,
    );
  }
  return sectionProgress.map((s) => {
    const data = sectionMap.get(s.sectionId);
    if (!data) return s;
    const percentage =
      data.max > 0 ? Math.round((data.correct / data.max) * 100) : 0;
    return {
      ...s,
      correctScore: data.correct,
      maxScore: data.max,
      percentage,
    };
  });
}

/** Compute category progress from filtered question attempts */
export function computeCategoryProgressFromFiltered(
  questionAttempts: QuestionAttemptRow[],
  sectionCategoryProgress: Record<string, SectionCategoryProgress[]>,
): Record<string, SectionCategoryProgress[]> {
  const result: Record<string, SectionCategoryProgress[]> = {};
  const categoryMap = new Map<
    string,
    { correct: number; max: number; syllogismStems: Set<string> }
  >();
  const unique = getBestAttemptPerQuestion(questionAttempts);
  for (const qa of unique) {
    const sectionId = qa.ucatSectionId;
    if (!sectionId) continue;
    const categoryId = qa.questionStemCategoryId ?? "__uncategorized__";
    const key = `${sectionId}:${categoryId}`;
    const existing = categoryMap.get(key) ?? {
      correct: 0,
      max: 0,
      syllogismStems: new Set<string>(),
    };
    existing.correct += qa.score ?? 0;
    existing.max += progressPointsForQuestion(
      toProgressQuestionRef(qa),
      existing.syllogismStems,
    );
    categoryMap.set(key, existing);
  }
  for (const [sectionId, cats] of Object.entries(sectionCategoryProgress)) {
    result[sectionId] = cats.map((cat) => {
      const key = `${sectionId}:${cat.categoryId}`;
      const { correct, max } = categoryMap.get(key) ?? { correct: 0, max: 0 };
      const percentage = max > 0 ? Math.round((correct / max) * 100) : 0;
      return {
        ...cat,
        correctScore: correct,
        maxScore: max,
        percentage,
        totalPublicQuestions: cat.totalPublicQuestions,
      };
    });
  }
  return result;
}

export type SharedDateRange = { start: Date; end: Date };

/** Compute shared date range for all progress graphs. Use when mode is all_time or weighted. */
export function getSharedDateRange(
  questionAttempts: { attemptedAt: string }[],
  setAttempts: { attemptedAt: string; completedAt?: string | null }[],
  mockAttempts: { attemptedAt: string; completedAt?: string | null }[],
  mode: ProgressMode,
  timeFrameDays: TimeFrameDays,
): SharedDateRange {
  if (mode === "time_frame") {
    const days = parseInt(timeFrameDays, 10) || 30;
    return getTimeFrameRange(days);
  }
  const allDates: Date[] = [];
  for (const a of questionAttempts) {
    allDates.push(new Date(a.attemptedAt));
  }
  for (const a of setAttempts) {
    allDates.push(new Date(a.completedAt ?? a.attemptedAt));
  }
  for (const a of mockAttempts) {
    allDates.push(new Date(a.completedAt ?? a.attemptedAt));
  }
  if (allDates.length === 0) {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }
  const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = minDate < end ? minDate : end;
  return { start, end: maxDate > end ? maxDate : end };
}

/** Compute section progress from mock attempts only (set attempts that belong to mocks). */
export function computeSectionProgressFromMockAttempts(
  mockAttempts: MockAttemptRow[],
  setAttempts: SetAttemptRow[],
  sectionProgress: SectionProgress[],
  mode: ProgressMode,
  timeFrameDays: TimeFrameDays,
): SectionProgress[] {
  const filteredMocks = filterByTimeFrame(mockAttempts, mode, timeFrameDays);
  const mockIds = new Set(filteredMocks.map((m) => m.id));
  const mockSetAttempts = setAttempts.filter(
    (s) =>
      s.studentUcatMockAttemptId && mockIds.has(s.studentUcatMockAttemptId),
  );

  const sectionMap = new Map<
    string,
    {
      name: string;
      number: number;
      scoreSum: number;
      totalSum: number;
    }
  >();
  for (const s of sectionProgress) {
    sectionMap.set(s.sectionId, {
      name: s.sectionName,
      number: s.sectionNumber,
      scoreSum: 0,
      totalSum: 0,
    });
  }

  for (const a of mockSetAttempts) {
    const sectionId = a.sectionId;
    if (!sectionId) continue;
    const entry = sectionMap.get(sectionId);
    if (!entry) continue;

    const score = a.scorePoints ?? 0;
    const total = a.totalPoints ?? 0;
    entry.scoreSum += score;
    entry.totalSum += total;
  }

  return sectionProgress.map((s) => {
    const data = sectionMap.get(s.sectionId);
    if (!data) return s;

    const percentage =
      data.totalSum > 0 ? Math.round((data.scoreSum / data.totalSum) * 100) : 0;

    return {
      ...s,
      correctScore: data.scoreSum,
      maxScore: data.totalSum,
      percentage,
    };
  });
}

/** Aggregate data into buckets for graph. Returns { date, value }[] */
export function aggregateForGraph<T>(
  items: T[],
  getDate: (item: T) => Date | string,
  getValue: (item: T) => number,
  mode: ProgressMode,
  timeFrameDays: TimeFrameDays,
  isCountMetric: boolean,
  sharedDateRange?: SharedDateRange,
): { date: string; value: number | null; label?: string }[] {
  let filtered = items;
  let allKeys: string[];
  let bucket: "day" | "week";

  const range =
    sharedDateRange ??
    (mode === "time_frame"
      ? (() => {
          const days = parseInt(timeFrameDays, 10) || 30;
          return getTimeFrameRange(days);
        })()
      : null);

  if (range != null) {
    const { start, end } = range;
    filtered = items.filter((a) => {
      const d = getDate(a);
      const date = typeof d === "string" ? new Date(d) : d;
      return date >= start && date <= end;
    });
    const days =
      Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    bucket = getGraphBucketDays(days);
    allKeys = getBucketKeysBetween(start, end, bucket);
  } else {
    if (filtered.length === 0) return [];
    const dates = filtered.map((a) => {
      const d = getDate(a);
      return typeof d === "string" ? new Date(d) : d;
    });
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
    const days =
      Math.ceil(
        (maxDate.getTime() - minDate.getTime()) / (24 * 60 * 60 * 1000),
      ) + 1;
    bucket = getGraphBucketDays(days);
    allKeys = getBucketKeysBetween(minDate, maxDate, bucket);
  }

  const byBucket = new Map<string, number[]>();
  for (const item of filtered) {
    const d = getDate(item);
    const key = getBucketKey(d, bucket);
    const list = byBucket.get(key) ?? [];
    list.push(getValue(item));
    byBucket.set(key, list);
  }

  const result = allKeys.map((date) => {
    const values = byBucket.get(date) ?? [];
    let value: number | null;
    if (values.length === 0) {
      value = null;
    } else if (isCountMetric) {
      value = values.length;
    } else {
      value = values.reduce((s, v) => s + v, 0) / values.length;
    }
    const label = bucket === "week" ? formatWeekStartLabel(date) : undefined;
    const tooltipLabel =
      bucket === "week" ? `Period: ${formatWeekRangeLabel(date)}` : undefined;
    return { date, value, label, tooltipLabel };
  });

  return result;
}

export type GraphXAxisMode = "date" | "attempt";

export type ProgressGraphPoint = {
  date: string;
  value: number | null;
  label?: string;
  tooltipLabel?: string;
};

function toGraphDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/** Filter items to the same date window used by `aggregateForGraph`. */
export function filterItemsByGraphDateRange<T>(
  items: T[],
  getDate: (item: T) => Date | string,
  mode: ProgressMode,
  timeFrameDays: TimeFrameDays,
  sharedDateRange?: SharedDateRange,
): T[] {
  const range =
    sharedDateRange ??
    (mode === "time_frame"
      ? getTimeFrameRange(parseInt(timeFrameDays, 10) || 30)
      : null);
  if (range == null) return items;
  return items.filter((item) => {
    const date = toGraphDate(getDate(item));
    return date >= range.start && date <= range.end;
  });
}

/** One chronological point per item (for X-axis = Attempt). */
export function buildAttemptAxisGraphData<T>(
  items: T[],
  getDate: (item: T) => Date | string,
  getValue: (item: T) => number,
  getId: (item: T) => string,
  getLabel?: (item: T, index: number) => string,
  getTooltipLabel?: (item: T, index: number) => string,
): ProgressGraphPoint[] {
  const sorted = [...items].sort(
    (a, b) =>
      toGraphDate(getDate(a)).getTime() - toGraphDate(getDate(b)).getTime(),
  );

  return sorted.map((item, index) => {
    const attemptNumber = index + 1;
    return {
      date: getId(item),
      value: getValue(item),
      label: getLabel?.(item, index) ?? String(attemptNumber),
      tooltipLabel:
        getTooltipLabel?.(item, index) ?? `Attempt #${attemptNumber}`,
    };
  });
}
