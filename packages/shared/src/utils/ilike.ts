/** Escape user input for PostgREST `ilike` filters. */
export function escapeIlikePattern(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/,/g, '');
}

/**
 * Quote a PostgREST filter value so reserved characters (`.`, `,`, `:`, etc.)
 * are not parsed as filter syntax. e.g. code `2.2` → `"2.2"`.
 */
export function quotePostgrestFilterValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export type SubjectQualifiedSearch =
  | { mode: 'general'; query: string }
  | { mode: 'qualified'; subjectQuery: string; codeQuery: string };

const TOPIC_OR_FILE_CODE_PATTERN = /^[\w.-]+$/i;

/** Whether the segment after the subject looks like a topic/file code (e.g. 2.2, w1). */
export function looksLikeTopicOrFileCode(value: string): boolean {
  const trimmed = value.trim();
  if (!TOPIC_OR_FILE_CODE_PATTERN.test(trimmed)) return false;
  if (/[\d.]/.test(trimmed)) return true;
  return trimmed.length <= 6;
}

/**
 * Parse `{subject} {code}` searches such as "12CHEM 2.2".
 * Uses the last space so multi-word subject names still work.
 */
export function parseSubjectQualifiedSearch(search: string): SubjectQualifiedSearch {
  const trimmed = search.trim();
  if (!trimmed) return { mode: 'general', query: '' };

  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace <= 0) {
    return { mode: 'general', query: trimmed };
  }

  const subjectQuery = trimmed.slice(0, lastSpace).trim();
  const codeQuery = trimmed.slice(lastSpace + 1).trim();

  if (subjectQuery.length < 2 || !codeQuery || !looksLikeTopicOrFileCode(codeQuery)) {
    return { mode: 'general', query: trimmed };
  }

  return { mode: 'qualified', subjectQuery, codeQuery };
}

/** Match subject short_name, long_name, or name (case-insensitive substring). */
export function buildSubjectNameOrFilter(search: string): string {
  const query = escapeIlikePattern(search.trim());
  if (!query) return '';
  const pattern = quotePostgrestFilterValue(`%${query}%`);
  return `short_name.ilike.${pattern},long_name.ilike.${pattern},name.ilike.${pattern}`;
}

/** Substring match for topic/file codes. */
export function buildCodeContainsPattern(codeQuery: string): string {
  const query = escapeIlikePattern(codeQuery.trim());
  if (!query) return '';
  return `%${query}%`;
}

/**
 * Index-friendly topic/file code search: exact + prefix on code, substring on name.
 */
export function buildCodeAndNameOrFilter(
  codeField: string,
  nameField: string,
  search: string,
): string {
  const query = escapeIlikePattern(search.trim());
  if (!query) return '';
  const exact = quotePostgrestFilterValue(query);
  const prefix = quotePostgrestFilterValue(`${query}%`);
  const contains = quotePostgrestFilterValue(`%${query}%`);
  return `${codeField}.ilike.${exact},${codeField}.ilike.${prefix},${nameField}.ilike.${contains}`;
}

/**
 * Index-friendly file code search: exact + prefix on code, substring on filename.
 * Prefer flat filename columns (views). Nested paths like `file.filename` are
 * not reliable inside PostgREST `.or()` — callers should search those separately.
 */
export function buildCodeAndFilenameOrFilter(
  codeField: string,
  filenameField: string,
  search: string,
): string {
  const query = escapeIlikePattern(search.trim());
  if (!query) return '';
  const exact = quotePostgrestFilterValue(query);
  const prefix = quotePostgrestFilterValue(`${query}%`);
  const contains = quotePostgrestFilterValue(`%${query}%`);
  return `${codeField}.ilike.${exact},${codeField}.ilike.${prefix},${filenameField}.ilike.${contains}`;
}

/** Exact + prefix code match for PostgREST `.or()` (no nested columns). */
export function buildCodeExactOrPrefixOrFilter(
  codeField: string,
  search: string,
): string {
  const query = escapeIlikePattern(search.trim());
  if (!query) return '';
  const exact = quotePostgrestFilterValue(query);
  const prefix = quotePostgrestFilterValue(`${query}%`);
  return `${codeField}.ilike.${exact},${codeField}.ilike.${prefix}`;
}
