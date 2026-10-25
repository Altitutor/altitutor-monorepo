export type TimedEntry<T> = {
  id: string;
  start: number;
  end: number;
  value: T;
};

export function clusterTimed<T>(items: TimedEntry<T>[]): TimedEntry<T>[][] {
  const groups: TimedEntry<T>[][] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) continue;
    const group = [item];
    seen.add(item.id);
    let grew = true;
    while (grew) {
      grew = false;
      for (const other of items) {
        if (seen.has(other.id)) continue;
        if (group.some((member) => member.start < other.end && member.end > other.start)) {
          group.push(other);
          seen.add(other.id);
          grew = true;
        }
      }
    }
    groups.push(group);
  }
  return groups;
}
