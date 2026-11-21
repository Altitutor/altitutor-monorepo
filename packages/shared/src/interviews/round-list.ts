/** Metadata only: lets a list notice completed edits and access changes cheaply. */
export interface InterviewRoundListEntry {
  id: string;
  version: number;
}

export interface InterviewRoundListSnapshot<Round> {
  rounds: Round[];
  history: InterviewRoundListEntry[];
}

export interface InterviewRoundHistoryPage<Round> {
  rounds: Round[];
  nextCursor: string | null;
}

export async function loadInterviewRoundHistory<Round>(
  readPage: (cursor: string | null) => Promise<InterviewRoundHistoryPage<Round>>,
): Promise<Round[]> {
  const rounds: Round[] = [];
  let cursor: string | null = null;
  const cursors = new Set<string>();
  do {
    const page = await readPage(cursor);
    rounds.push(...page.rounds);
    const next = page.nextCursor;
    if (next !== null && (cursors.has(next) || (cursor !== null && next <= cursor)))
      throw new Error("Interview history changed while loading. Please try again.");
    if (next !== null) cursors.add(next);
    cursor = next;
  } while (cursor !== null);
  return rounds;
}
