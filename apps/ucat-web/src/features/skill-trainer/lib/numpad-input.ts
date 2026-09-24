export function applyNumpadKey(
  sequence: readonly string[],
  key: string,
): string[] {
  return key === "ON/C" ? [] : [...sequence, key];
}
