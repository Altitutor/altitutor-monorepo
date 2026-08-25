/**
 * Text highlighting for command palette search results.
 */

import React from 'react';

export function highlightText(
  text: string | null | undefined,
  query: string,
): string | React.ReactNode {
  if (!text || !query.trim()) return text;

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <span key={i} className="font-semibold text-brand-lightBlue">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
