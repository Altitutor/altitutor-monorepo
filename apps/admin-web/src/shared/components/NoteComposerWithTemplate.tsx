'use client';

import { useRef } from 'react';
import { Button, SearchableSelect } from '@altitutor/ui';
import type { Tables, Json } from '@altitutor/shared';
import type { JSONContent } from '@tiptap/core';
import { NotesEditorWithMentions, type NotesEditorWithMentionsRef } from '@/shared/components/NotesEditorWithMentions';
import { isTiptapContentEmpty } from '@/shared/utils/plainTextToTiptapJson';
import { extractTextFromNoteContent } from '@/shared/utils/noteContentUtils';
import { useRichTextTemplates } from '@/features/rich-text-templates';
import { insertTemplateAtEnd } from '@/features/rich-text-templates/components/RichTextTemplateMenuItems';

interface NoteComposerWithTemplateProps {
  content: JSONContent;
  onChange: (value: JSONContent) => void;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
  canPost: boolean;
  placeholder?: string;
  minHeight?: string;
  className?: string;
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
}: NoteComposerWithTemplateProps) {
  const editorRef = useRef<NotesEditorWithMentionsRef | null>(null);
  const { data: templates = [], isLoading: isTemplatesLoading } = useRichTextTemplates();
  const isEmpty = isTiptapContentEmpty(content);

  const handleTemplateSelect = (template: Tables<'rich_text_templates'> | null) => {
    if (!template) return;
    insertTemplateAtEnd(
      editorRef.current?.getEditor() ?? null,
      (template.content as JSONContent | null) ?? null
    );
  };

  return (
    <div className={className ? `space-y-2 ${className}` : 'space-y-2'}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <NotesEditorWithMentions
            ref={editorRef}
            content={content}
            onChange={onChange}
            placeholder={placeholder}
            disabled={isSubmitting || !canPost}
            minHeight={minHeight}
          />
        </div>
        <SearchableSelect<Tables<'rich_text_templates'>>
          items={templates}
          value={null}
          onValueChange={handleTemplateSelect}
          getItemId={(template) => template.id}
          getItemLabel={(template) => template.name}
          getItemValue={(template) =>
            `${template.name} ${extractTextFromNoteContent(template.content as Json)}`
          }
          searchPlaceholder="Search templates..."
          emptyMessage={isTemplatesLoading ? 'Loading templates...' : 'No templates found'}
          loading={isTemplatesLoading}
          showChevron={false}
          trigger={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-1 shrink-0"
              disabled={isSubmitting || !canPost}
            >
              Template
            </Button>
          }
          renderItem={(template) => (
            <div className="flex min-w-0 flex-col gap-0.5 py-0.5">
              <span className="truncate font-medium">{template.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {extractTextFromNoteContent(template.content as Json) || '(empty)'}
              </span>
            </div>
          )}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {isSubmitting ? 'Posting...' : ''}
        </span>
        <Button
          type="button"
          onClick={() => void onSubmit()}
          disabled={isEmpty || isSubmitting || !canPost}
          size="sm"
          variant="default"
        >
          Post
        </Button>
      </div>
    </div>
  );
}
