export type BenchmarkSetAsset = {
  id: string;
  name: string;
  sectionId: string;
  questionCount: number;
  completedAttempts: string[];
};

export type BenchmarkMockAsset = {
  id: string;
  name: string;
  completedAttempts: string[];
};

type SelectionResult<T> =
  | { status: "selected"; asset: T; repeated: boolean }
  | { status: "gap"; reason: "no_eligible_set" | "no_eligible_mock" };

function mostRecent(attempts: string[]): string | null {
  return [...attempts].sort((left, right) => right.localeCompare(left))[0] ?? null;
}

export function selectBenchmarkSet(input: {
  sectionId: string;
  sectionQuestionCount: number;
  requestedQuestionCount: number;
  usedSetIds: ReadonlySet<string>;
  sets: BenchmarkSetAsset[];
}): SelectionResult<BenchmarkSetAsset> {
  const requestsFullForm =
    input.requestedQuestionCount / input.sectionQuestionCount >= 0.9;
  const eligible = input.sets.filter((set) => {
    if (set.sectionId !== input.sectionId) return false;
    const isFullForm = set.questionCount / input.sectionQuestionCount >= 0.9;
    return isFullForm === requestsFullForm;
  });
  if (!eligible.length) return { status: "gap", reason: "no_eligible_set" };

  const unused = eligible.filter((set) => !input.usedSetIds.has(set.id));
  const planExhausted = unused.length === 0;
  const candidates = planExhausted ? eligible : unused;
  const asset = [...candidates].sort((left, right) => {
    const leftRecent = mostRecent(left.completedAttempts);
    const rightRecent = mostRecent(right.completedAttempts);
    return (
      Number(left.completedAttempts.length > 0) -
        Number(right.completedAttempts.length > 0) ||
      (leftRecent ?? "").localeCompare(rightRecent ?? "") ||
      left.id.localeCompare(right.id)
    );
  })[0]!;
  return {
    status: "selected",
    asset,
    repeated:
      asset.completedAttempts.length > 0 || input.usedSetIds.has(asset.id),
  };
}

export function selectBenchmarkMock(input: {
  usedMockIds: ReadonlySet<string>;
  mocks: BenchmarkMockAsset[];
}): SelectionResult<BenchmarkMockAsset> {
  if (!input.mocks.length) return { status: "gap", reason: "no_eligible_mock" };
  const unused = input.mocks.filter((mock) => !input.usedMockIds.has(mock.id));
  const planExhausted = unused.length === 0;
  const candidates = planExhausted ? input.mocks : unused;
  const asset = [...candidates].sort((left, right) => {
    const leftRecent = mostRecent(left.completedAttempts);
    const rightRecent = mostRecent(right.completedAttempts);
    return (
      Number(left.completedAttempts.length > 0) -
        Number(right.completedAttempts.length > 0) ||
      (leftRecent ?? "").localeCompare(rightRecent ?? "") ||
      left.id.localeCompare(right.id)
    );
  })[0]!;
  return {
    status: "selected",
    asset,
    repeated:
      asset.completedAttempts.length > 0 || input.usedMockIds.has(asset.id),
  };
}
