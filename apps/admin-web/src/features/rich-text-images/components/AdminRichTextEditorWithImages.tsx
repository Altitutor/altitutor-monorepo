'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  RichTextEditor,
  type RichTextEditorRef,
  type RichTextEditorProps,
  type JSONContent,
} from '@altitutor/ui';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { useAdminRichTextImageUpload } from '../hooks/useAdminRichTextImageUpload';
import { useSlashCommandSuggestions } from '@/shared/hooks/useSlashCommandSuggestions';
import type { AdminRichTextImageContext } from '../api/uploadAdminRichTextImage';
import { useRefreshedAdminContent } from '../hooks/useRefreshedAdminContent';

export interface AdminRichTextEditorWithImagesProps
  extends Pick<
    RichTextEditorProps,
    | 'autoFocus'
    | 'onEditorReady'
    | 'onMentionClick'
    | 'minHeight'
    | 'autoHeight'
    | 'editable'
    | 'floatingToolbar'
  > {
  content: JSONContent | string | null | undefined;
  onChange: (json: JSONContent) => void;
  placeholder?: string;
  className?: string;
  context: AdminRichTextImageContext;
  mentionSuggestions?: Omit<SuggestionOptions, 'editor'>;
  onChangeDebounceMs?: number;
  includeCollapsibleSlashCommand?: boolean;
}

function contentSignature(
  content: JSONContent | string | null | undefined,
): string {
  if (!content) return '';
  return typeof content === 'string' ? content : JSON.stringify(content);
}

function contentForRefresh(
  content: JSONContent | string | null | undefined,
): Record<string, unknown> | null {
  if (content && typeof content === 'object') {
    return content as Record<string, unknown>;
  }
  if (typeof content !== 'string') return null;

  try {
    const parsed = JSON.parse(content) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * RichTextEditor with durable image rendering plus paste and drag-and-drop support.
 * Use for admin editors that can contain admin-rich-text-images.
 */
export const AdminRichTextEditorWithImages = forwardRef<
  RichTextEditorRef,
  AdminRichTextEditorWithImagesProps
>(
  (
    {
      content,
      onChange,
      placeholder,
      className,
      context,
      mentionSuggestions,
      onChangeDebounceMs,
      includeCollapsibleSlashCommand = true,
      ...editorProps
    },
    ref,
  ) => {
    const { handlePasteImages, handleDrop } = useAdminRichTextImageUpload({
      context,
      editorRef: ref as React.RefObject<RichTextEditorRef | null>,
    });
    const slashMenuSuggestions = useSlashCommandSuggestions({
      includeCollapsibleSection: includeCollapsibleSlashCommand,
    });
    const incomingSignature = useMemo(
      () => contentSignature(content),
      [content],
    );
    const lastEmittedSignatureRef = useRef('');
    const refreshSourceSignatureRef = useRef(incomingSignature);
    const hasLocalEditRef = useRef(false);
    const [refreshSource, setRefreshSource] = useState<Record<
      string,
      unknown
    > | null>(() => contentForRefresh(content));

    useEffect(() => {
      if (incomingSignature === lastEmittedSignatureRef.current) return;
      if (incomingSignature === refreshSourceSignatureRef.current) return;

      hasLocalEditRef.current = false;
      refreshSourceSignatureRef.current = incomingSignature;
      setRefreshSource(contentForRefresh(content));
    }, [content, incomingSignature]);

    const {
      content: refreshedContent,
      isLoading,
      hasImageRefs,
    } = useRefreshedAdminContent(refreshSource);
    const editorContent =
      refreshedContent && !hasLocalEditRef.current
        ? (refreshedContent as JSONContent)
        : content;
    const handleChange = useCallback(
      (json: JSONContent) => {
        hasLocalEditRef.current = true;
        lastEmittedSignatureRef.current = JSON.stringify(json);
        onChange(json);
      },
      [onChange],
    );

    if (isLoading && !hasLocalEditRef.current && hasImageRefs) {
      return <div className={className} aria-label="Loading editor images" />;
    }

    return (
      <div
        onDragOver={(e) => {
          if (editorProps.editable !== false) e.preventDefault();
        }}
        onDrop={editorProps.editable === false ? undefined : handleDrop}
      >
        <RichTextEditor
          ref={ref}
          content={editorContent}
          onChange={handleChange}
          onChangeDebounceMs={onChangeDebounceMs}
          placeholder={placeholder}
          className={className}
          mentionSuggestions={mentionSuggestions}
          slashMenuSuggestions={slashMenuSuggestions}
          onPasteImages={handlePasteImages}
          {...editorProps}
        />
      </div>
    );
  },
);

AdminRichTextEditorWithImages.displayName = 'AdminRichTextEditorWithImages';
