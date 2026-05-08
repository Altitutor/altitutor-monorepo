'use client';

import type { JSONContent } from '@tiptap/core';
import { NoteComposerWithTemplate } from '@/shared/components/NoteComposerWithTemplate';

interface ActivityNoteComposerProps {
  content: JSONContent;
  onChange: (value: JSONContent) => void;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
  canPost: boolean;
}

export function ActivityNoteComposer({
  content,
  onChange,
  onSubmit,
  isSubmitting,
  canPost,
}: ActivityNoteComposerProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <NoteComposerWithTemplate
        content={content}
        onChange={onChange}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        canPost={canPost}
      />
    </div>
  );
}
