'use client';

import { DropdownMenuItem, DropdownMenuSeparator } from '@altitutor/ui';
import { Save } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import { RichTextTemplateInsertSubmenu } from './RichTextTemplateInsertSubmenu';
import type { Tables } from '@altitutor/shared';

/**
 * Extracts content nodes to insert from TipTap doc format.
 * When inserting, we use the content array (child nodes) to avoid nested doc.
 */
function getContentToInsert(templateContent: JSONContent | Record<string, unknown> | null): JSONContent[] {
  if (!templateContent) return [];

  const content = (templateContent as { content?: JSONContent[] }).content;
  if (Array.isArray(content) && content.length > 0) {
    return content;
  }

  const asNode = templateContent as JSONContent;
  if (asNode.type === 'doc' && Array.isArray(asNode.content)) {
    return asNode.content;
  }

  return [asNode];
}

/**
 * Inserts template content at the end of the editor (append).
 */
export function insertTemplateAtEnd(editor: Editor | null, templateContent: JSONContent | null): void {
  if (!editor || editor.isDestroyed) return;

  const toInsert = getContentToInsert(templateContent as Record<string, unknown>);
  if (toInsert.length === 0) return;

  const endPos = editor.state.doc.content.size;
  editor.chain().focus().insertContentAt(endPos, toInsert).run();
}

interface RichTextTemplateMenuItemsProps {
  getEditor: () => Editor | null;
  getCurrentContent: () => JSONContent | string | null;
  onSaveAsTemplateClick?: () => void;
  onClose?: () => void;
}

export function RichTextTemplateMenuItems({
  getEditor,
  getCurrentContent: _getCurrentContent,
  onSaveAsTemplateClick,
  onClose,
}: RichTextTemplateMenuItemsProps) {
  const handleSaveAsTemplate = (e: Event) => {
    e.preventDefault(); // Prevent dropdown from closing before parent can open the dialog
    onSaveAsTemplateClick?.();
  };

  const handleInsertTemplate = (template: Tables<'rich_text_templates'>) => {
    const editor = getEditor();
    const content = template.content as JSONContent | null;
    insertTemplateAtEnd(editor, content);
    onClose?.();
  };

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={handleSaveAsTemplate}>
        <Save className="h-4 w-4 mr-2" />
        Save as template
      </DropdownMenuItem>
      <RichTextTemplateInsertSubmenu onSelect={handleInsertTemplate} />
    </>
  );
}
