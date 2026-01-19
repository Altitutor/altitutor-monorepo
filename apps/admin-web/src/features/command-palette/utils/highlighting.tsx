/**
 * Text Highlighting Utilities
 * Highlights matching text in search results
 */

import React from 'react';

/**
 * Highlight matching text in a string
 */
export function highlightText(
  text: string | null | undefined,
  query: string
): string | React.ReactNode {
  if (!text || !query.trim()) return text;

  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <span key={i} className="font-semibold text-brand-lightBlue">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}
