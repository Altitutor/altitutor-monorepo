'use client';

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  SearchableSelectInline,
} from '@altitutor/ui';
import { FileText, Save } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import type { Tables, Json } from '@altitutor/shared';
import { useRichTextTemplates } from '../api/templates';
import { extractTextFromNoteContent } from '@/shared/utils/noteContentUtils';
import { resolveAdminImageUrls } from '@/features/rich-text-images';
import { useRegisterRecordActions } from '@/features/command-palette/RecordActionsContext';

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
export async function insertTemplateAtEnd(
  editor: Editor | null,
  templateContent: JSONContent | null,
): Promise<void> {
  if (!editor || editor.isDestroyed) return;

  const resolvedContent = templateContent
    ? await resolveAdminImageUrls(templateContent as Record<string, unknown>).catch(
        () => templateContent as Record<string, unknown>,
      )
    : null;
  if (!editor || editor.isDestroyed) return;
  const toInsert = getContentToInsert(resolvedContent);
  if (toInsert.length === 0) return;

  const endPos = editor.state.doc.content.size;
  editor.chain().focus().insertContentAt(endPos, toInsert).run();
}

interface RichTextTemplateMenuItemsProps {
  getEditor: () => Editor | null;
  getCurrentContent: () => JSONContent | string | null;
  onSaveAsTemplateClick?: () => void;
  onClose?: () => void;
  showInsert?: boolean;
}

export function usesFloatingTemplatePicker(recordType: string) {
  return recordType === "project";
}

/** The menu and hover launcher share the same editor and save-dialog ownership. */
export function RichTextTemplateRecordActions({ type, id, title, config }: { type: string; id?: string; title?: string; config: RichTextTemplateMenuItemsProps }) {
  const showInsert = !usesFloatingTemplatePicker(type);
  const { data: templates = [] } = useRichTextTemplates(showInsert);
  const ready = () => { const editor = config.getEditor(); return Boolean(editor && editor.isInitialized && !editor.isDestroyed && editor.isEditable); };
  useRegisterRecordActions(type, id, title, [
    ...(config.onSaveAsTemplateClick ? [{ id: 'save-template', title: 'Save as template', icon: Save, ready, action: config.onSaveAsTemplateClick }] : []),
    ...(showInsert ? templates : []).map(template => ({ id: `insert-template-${template.id}`, title: template.name, group: 'Insert template', icon: FileText, ready, action: () => { void insertTemplateAtEnd(config.getEditor(), template.content as JSONContent | null); } })),
  ]);
  return null;
}

export function RichTextTemplateMenuItems({
  getEditor,
  getCurrentContent: _getCurrentContent,
  onSaveAsTemplateClick,
  onClose,
  showInsert = true,
}: RichTextTemplateMenuItemsProps) {
  const { data: templates = [], isLoading: isTemplatesLoading } = useRichTextTemplates(showInsert);

  const handleSaveAsTemplate = (e: Event) => {
    e.preventDefault(); // Prevent dropdown from closing before parent can open the dialog
    onSaveAsTemplateClick?.();
  };

  const handleInsertTemplate = (template: Tables<'rich_text_templates'> | null) => {
    if (!template) return;
    const editor = getEditor();
    const content = template.content as JSONContent | null;
    void insertTemplateAtEnd(editor, content).finally(() => onClose?.());
  };

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={handleSaveAsTemplate}>
        <Save className="h-4 w-4 mr-2" />
        Save as template
      </DropdownMenuItem>
      {showInsert && (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <FileText className="h-4 w-4 mr-2" />
            Insert template
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-80 p-0">
            <SearchableSelectInline<Tables<'rich_text_templates'>>
              items={templates}
              value={null}
              onValueChange={handleInsertTemplate}
              getItemId={(template) => template.id}
              getItemLabel={(template) => template.name}
              getItemValue={(template) =>
                `${template.name} ${extractTextFromNoteContent(template.content as Json)}`
              }
              searchPlaceholder="Search templates..."
              emptyMessage={isTemplatesLoading ? 'Loading templates...' : 'No templates found'}
              loading={isTemplatesLoading}
              className="max-h-[240px]"
              renderItem={(template) => (
                <div className="flex min-w-0 flex-col gap-0.5 py-0.5">
                  <span className="truncate font-medium">{template.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {extractTextFromNoteContent(template.content as Json) || '(empty)'}
                  </span>
                </div>
              )}
            />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )}
    </>
  );
}
