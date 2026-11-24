"use client";
import { Save, FileText } from "lucide-react";
import { useRichTextTemplates } from "@/features/rich-text-templates/api/templates";
import { usesFloatingTemplatePicker } from "@/features/rich-text-templates/components/RichTextTemplateMenuItems";
import { useRunRecordAction } from "@/features/command-palette/RecordActionsContext";
import { ReferenceActionList } from "./ReferenceActionList";

export function TemplateReferenceActions({
  type,
  id,
  onActivate,
}: {
  type: string;
  id: string;
  onActivate?: () => void;
}) {
  const launch = useRunRecordAction();
  const showInsert = !usesFloatingTemplatePicker(type);
  const { data: templates = [] } = useRichTextTemplates(showInsert);
  const recordType = type === "document" ? "note" : type;
  return (
    <>
      <ReferenceActionList
        onActivate={onActivate}
        actions={[
          {
            id: "save-template",
            title: "Save as template",
            icon: Save,
            action: () => launch?.(recordType, id, "save-template"),
          },
        ]}
      />
      {showInsert && (
        <details className="px-3 py-1.5">
          <summary className="cursor-pointer text-sm">Insert template</summary>
          {templates.length ? (
            <ReferenceActionList
              onActivate={onActivate}
              actions={templates.map((template) => ({
                id: `insert-template-${template.id}`,
                title: template.name,
                icon: FileText,
                action: () =>
                  launch?.(recordType, id, `insert-template-${template.id}`),
              }))}
            />
          ) : (
            <p className="py-2 text-xs text-muted-foreground">
              No templates available
            </p>
          )}
        </details>
      )}
    </>
  );
}
