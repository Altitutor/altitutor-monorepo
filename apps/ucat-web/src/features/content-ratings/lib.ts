export function contentSnapshotVersion(
  displayedContent: Record<string, string>,
): string {
  const input = JSON.stringify(
    Object.entries(displayedContent).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `v1-${(hash >>> 0).toString(36)}`;
}
