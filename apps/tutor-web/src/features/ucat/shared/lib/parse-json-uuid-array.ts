export function parseJsonUuidArray(value: unknown): string[] {
  if (value == null || !Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}
