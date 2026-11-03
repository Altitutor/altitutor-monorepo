'use client';

import type { SharedLessonDocument } from '@altitutor/shared';

export function SharedLessonDocumentLinks({ documents }: { documents: SharedLessonDocument[] }) {
  if (!documents.length) return null;
  return (
    <ul className="space-y-2 text-sm" aria-label="Shared lesson PDFs">
      {documents.map(document => (
        <li key={document.id} className="space-y-1 rounded-lg border border-border p-3">
          {document.available ? (
            <a href={`/api/lesson-documents/${encodeURIComponent(document.id)}/download`} target="_blank" rel="noopener noreferrer"
              className="block break-words font-medium text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
              {document.canonicalResourceID ? 'Annotated PDF' : 'Lesson PDF'} · {document.filename}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : <p className="break-words text-muted-foreground">{document.filename} · Expired</p>}
          <p className="text-xs text-muted-foreground">
            {document.available ? 'Available until ' : 'Expired '}
            {new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Adelaide', dateStyle: 'medium' }).format(new Date(document.expiresAt))}
          </p>
        </li>
      ))}
    </ul>
  );
}
