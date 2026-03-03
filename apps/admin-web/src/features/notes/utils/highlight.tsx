import type { ReactNode } from 'react';

/**
 * Extract search terms from a websearch-style query for highlighting.
 * Handles quoted phrases and simple space-separated terms.
 */
export function getSearchTerms(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const terms: string[] = [];
  const phraseRegex = /"([^"]+)"/g;
  let match: RegExpExecArray | null;

  // Extract quoted phrases first
  while ((match = phraseRegex.exec(trimmed)) !== null) {
    const phrase = match[1].trim();
    if (phrase) terms.push(phrase);
  }

  // Get remaining text (without quoted parts) and split into terms
  const withoutQuotes = trimmed.replace(phraseRegex, ' ').replace(/\s+/g, ' ');
  const simpleTerms = withoutQuotes
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !t.startsWith('-'));

  return [...terms, ...simpleTerms];
}

/**
 * Escape special regex characters in a string for use in RegExp
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlight search terms in text. Returns an array of React nodes (strings and <mark> elements).
 * Uses case-insensitive matching.
 */
export function highlightSearchTerms(text: string, searchQuery: string): ReactNode[] {
  if (!text || !searchQuery.trim()) {
    return [text];
  }

  const terms = getSearchTerms(searchQuery);
  if (terms.length === 0) return [text];

  // Build regex: match any term, case-insensitive, word boundaries where appropriate
  const pattern = terms
    .map((t) => escapeRegex(t))
    .filter(Boolean)
    .join('|');

  if (!pattern) return [text];

  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <mark key={i} className="bg-primary/20 rounded px-0.5">
          {part}
        </mark>
      );
    }
    return part;
  });
}
