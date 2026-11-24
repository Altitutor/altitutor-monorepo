'use client';

import type { ReactNode } from 'react';
import { Button } from '@altitutor/ui';
import type { JSONContent } from '@tiptap/core';
import { NotesEditorWithMentions } from '@/shared/components/NotesEditorWithMentions';
import { isTiptapContentEmpty } from '@/shared/utils/plainTextToTiptapJson';

interface NoteComposerWithTemplateProps {
  content: JSONContent;
  onChange: (value: JSONContent) => void;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
  canPost: boolean;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  /** When set, this control sits in the bottom toolbar, to the left of the Post button. */
  modeControl?: ReactNode;
}

export function NoteComposerWithTemplate({
  content,
  onChange,
  onSubmit,
  isSubmitting,
  canPost,
  placeholder = 'Add a note...',
  minHeight = '80px',
  className,
  modeControl,
}: NoteComposerWithTemplateProps) {
  const isEmpty = isTiptapContentEmpty(content);

  return (
    <div className={className ? `space-y-2 ${className}` : 'space-y-2'}>
      <NotesEditorWithMentions
        content={content}
        onChange={onChange}
        placeholder={placeholder}
        disabled={isSubmitting || !canPost}
        minHeight={minHeight}
        insertTemplates
      />

      <div className="flex items-center justify-between gap-2">
        {modeControl ?? <span className="text-xs text-muted-foreground">{isSubmitting ? 'Posting...' : ''}</span>}
        <div className="flex items-center gap-2">
          {modeControl && isSubmitting && <span className="text-xs text-muted-foreground">Posting...</span>}
          <Button
            type="button"
            onClick={() => void onSubmit()}
            disabled={isEmpty || isSubmitting || !canPost}
            size="sm"
            variant="default"
            className={modeControl ? 'h-10' : undefined}
          >
            Post
          </Button>
        </div>
      </div>
    </div>
  );
}
