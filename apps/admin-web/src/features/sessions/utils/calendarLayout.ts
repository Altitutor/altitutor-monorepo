export type CalendarInterval = {
  id: string;
  startMinutes: number;
  endMinutes: number;
};

export type CalendarColumnPlacement = {
  id: string;
  column: number;
  columnCount: number;
};

function intervalsOverlap(a: CalendarInterval, b: CalendarInterval): boolean {
  return a.startMinutes < b.endMinutes && a.endMinutes > b.startMinutes;
}

function clusterIntervals(items: CalendarInterval[]): CalendarInterval[][] {
  const groups: CalendarInterval[][] = [];
  const processed = new Set<string>();

  for (const item of items) {
    if (processed.has(item.id)) continue;
    const group = [item];
    processed.add(item.id);

    let foundNewOverlap = true;
    while (foundNewOverlap) {
      foundNewOverlap = false;
      for (const other of items) {
        if (processed.has(other.id)) continue;
        const overlapsWithGroup = group.some((member) => intervalsOverlap(member, other));
        if (overlapsWithGroup) {
          group.push(other);
          processed.add(other.id);
          foundNewOverlap = true;
        }
      }
    }

    groups.push(group);
  }

  return groups;
}

function packCluster(group: CalendarInterval[]): CalendarColumnPlacement[] {
  const inputOrder = new Map(group.map((item, index) => [item.id, index]));
  const sorted = [...group].sort((a, b) => {
    if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
    const durationDelta = b.endMinutes - b.startMinutes - (a.endMinutes - a.startMinutes);
    if (durationDelta !== 0) return durationDelta;
    return (inputOrder.get(a.id) ?? 0) - (inputOrder.get(b.id) ?? 0);
  });

  const columnEnds: number[] = [];
  const columnById = new Map<string, number>();
  for (const item of sorted) {
    const openColumn = columnEnds.findIndex((end) => item.startMinutes >= end);
    const column = openColumn === -1 ? columnEnds.length : openColumn;
    columnEnds[column] = item.endMinutes;
    columnById.set(item.id, column);
  }

  const columnCount = Math.max(columnEnds.length, 1);
  return group.map((item) => ({
    id: item.id,
    column: columnById.get(item.id) ?? 0,
    columnCount,
  }));
}

/**
 * Place intervals into the fewest side-by-side columns.
 * A session reuses the leftmost column whose previous session has already ended,
 * so sessions that only meet at an endpoint stack. Each overlap cluster is sized
 * on its own, and longer sessions at the same start take the earlier columns.
 */
export function layoutCalendarColumns(items: CalendarInterval[]): CalendarColumnPlacement[] {
  return clusterIntervals(items).flatMap((group) => packCluster(group));
}
