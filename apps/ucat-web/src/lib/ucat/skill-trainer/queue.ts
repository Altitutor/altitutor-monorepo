/** Fisher–Yates shuffle (mutates copy). */
export function shuffleIds(ids: string[]): string[] {
  const queue = [...ids];
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return queue;
}

export function buildItemQueue(allIds: string[], avoidRepeatId?: string | null): string[] {
  if (allIds.length === 0) return [];
  if (allIds.length === 1) return [...allIds];

  let queue = shuffleIds(allIds);
  if (avoidRepeatId && queue[0] === avoidRepeatId) {
    queue = shuffleIds(allIds);
    let attempts = 0;
    while (queue[0] === avoidRepeatId && attempts < 10) {
      queue = shuffleIds(allIds);
      attempts += 1;
    }
    if (queue[0] === avoidRepeatId) {
      const swapIndex = queue.findIndex((id) => id !== avoidRepeatId);
      if (swapIndex > 0) {
        [queue[0], queue[swapIndex]] = [queue[swapIndex], queue[0]];
      }
    }
  }
  return queue;
}

export function advanceQueue(
  queue: string[],
  currentIndex: number,
  allIds: string[],
  lastCompletedId: string,
): { queue: string[]; currentIndex: number } {
  const nextIndex = currentIndex + 1;
  if (nextIndex < queue.length) {
    return { queue, currentIndex: nextIndex };
  }
  const newQueue = buildItemQueue(allIds, lastCompletedId);
  return { queue: newQueue, currentIndex: 0 };
}
