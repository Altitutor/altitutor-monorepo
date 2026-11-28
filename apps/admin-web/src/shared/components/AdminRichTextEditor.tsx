'use client';

import { forwardRef } from 'react';
import { RichTextEditor, type RichTextEditorProps, type RichTextEditorRef } from '@altitutor/ui';
import { useMentionSuggestions } from '@/shared/hooks/useMentionSuggestions';

export const AdminRichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  function AdminRichTextEditor({ mentionSuggestions, ...props }, ref) {
    const suggestions = useMentionSuggestions();
    return <RichTextEditor {...props} ref={ref} mentionSuggestions={mentionSuggestions ?? suggestions} />;
  },
);
