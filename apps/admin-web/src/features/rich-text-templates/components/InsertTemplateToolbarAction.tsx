"use client";

import { Button, SearchableSelect } from "@altitutor/ui";
import type { Json, Tables } from "@altitutor/shared";
import type { Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { FileText } from "lucide-react";
import { extractTextFromNoteContent } from "@/shared/utils/noteContentUtils";
import { useRichTextTemplates } from "../api/templates";
import { insertTemplateAtEnd } from "./RichTextTemplateMenuItems";

export function InsertTemplateToolbarAction({
  editor,
  onOpenChange,
}: {
  editor: Editor;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: templates = [], isLoading } = useRichTextTemplates();
  const dialog = editor.view.dom.closest<HTMLElement>('[data-slot="dialog-content"]');

  return (
    <SearchableSelect<Tables<"rich_text_templates">>
      items={templates}
      value={null}
      onValueChange={(template) => {
        if (template) void insertTemplateAtEnd(editor, template.content as JSONContent | null);
      }}
      getItemId={(template) => template.id}
      getItemLabel={(template) => template.name}
      getItemValue={(template) =>
        `${template.name} ${extractTextFromNoteContent(template.content as Json)}`
      }
      onOpenChange={onOpenChange}
      searchPlaceholder="Search templates..."
      emptyMessage={isLoading ? "Loading templates..." : "No templates found"}
      loading={isLoading}
      side="top"
      popoverContainer={dialog}
      trigger={
        <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" aria-label="Insert template" title="Insert template">
          <FileText className="size-4" />
        </Button>
      }
    />
  );
}
