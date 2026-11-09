"use client";
import { useEntityNavigation } from "@/shared/contexts/EntityNavigation";

import { useRef, useCallback, memo, useState } from "react";
import { Separator, SegmentedTabPanel, SegmentedTabPanelContent } from "@altitutor/ui";
import { UseFormReturn } from "react-hook-form";
import { LinkedTasksSection } from "@/features/tasks/components/LinkedTasksSection";
import { IssueActivityTab } from "@/features/issues/components/IssueActivityTab";
import { IssueDueDateField } from "../fields/IssueDueDateField";
import { IssuePriorityField } from "../fields/IssuePriorityField";
import { IssueStatusField } from "../fields/IssueStatusField";
import { IssueTitleField } from "@/features/issues/components/fields/IssueTitleField";
import { IssueDescriptionField } from "@/features/issues/components/fields/IssueDescriptionField";
import type { RichTextEditorRef } from "@altitutor/ui";
import type { IssueFormData, IssueTag, IssueWithTags } from "../../types";
import type { TagEntityType } from "@/shared/utils/tagParsing";
import type { Tables } from "@altitutor/shared";

type NoteWithStaff = Tables<"notes"> & {
  staff?: Tables<"staff"> | null;
};

interface IssuePropertiesPanelProps {
  form: UseFormReturn<IssueFormData>;
  issue?: IssueWithTags;
  tags?: IssueTag[];
  notes: NoteWithStaff[];
  isOpen: boolean;
  onClose: () => void;
  descriptionRef?: React.RefObject<RichTextEditorRef | null>;
}

export const IssuePropertiesPanel = memo(function IssuePropertiesPanel({
  form,
  issue,
  tags = [],
  notes,
  isOpen,
  onClose: _onClose,
  descriptionRef: descriptionRefProp,
}: IssuePropertiesPanelProps) {
  const titleFieldRef = useRef<HTMLInputElement>(null);
  const [section, setSection] = useState<"overview" | "tasks">("overview");
  const internalDescriptionRef = useRef<RichTextEditorRef>(null);
  const descriptionRef = descriptionRefProp ?? internalDescriptionRef;

  const { openEntity } = useEntityNavigation();
  const handleTagClick = useCallback(
    (type: TagEntityType, id: string) => {
      openEntity(type, id);
    },
    [openEntity],
  );

  const handleTitleEnter = useCallback(() => {
    if (descriptionRef.current) {
      const editor = descriptionRef.current.getEditor();
      if (
        editor &&
        "commands" in editor &&
        editor.commands &&
        typeof editor.commands.focus === "function"
      ) {
        editor.commands.focus();
      }
    }
  }, [descriptionRef]);

  return (
    <>
      <div
        className="h-full min-h-0 flex-1 min-w-0 overflow-y-auto overscroll-contain"
        data-rich-text-toolbar-container
      >
        <div className="p-6 space-y-6">
          <IssueTitleField form={form} onEnter={handleTitleEnter} titleRef={titleFieldRef} />
          {issue && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <IssueStatusField form={form} />
              <IssuePriorityField form={form} />
              <IssueDueDateField form={form} />
            </div>
          )}

          <SegmentedTabPanel
            className="gap-4"
            value={section}
            onValueChange={(value) => {
              if (value === "overview" || value === "tasks") setSection(value);
            }}
            options={[
              { value: "overview", label: "Overview" },
              { value: "tasks", label: "Tasks" },
            ]}
          >
            <SegmentedTabPanelContent when="overview" activeTab={section} className="space-y-6">
          <div className="space-y-2">
            <IssueDescriptionField
              form={form}
              value={form.getValues("description")}
              onTagClick={handleTagClick}
              descriptionRef={descriptionRef}
            />
          </div>
          {issue?.id && (
            <div className="space-y-4 pb-6">
              <Separator />
              <IssueActivityTab
                issueId={issue.id}
                notes={notes}
                isOpen={isOpen}
                studentIds={tags.map((t) => t.student_id!).filter(Boolean)}
                staffIds={tags.map((t) => t.staff_id!).filter(Boolean)}
                classIds={tags.map((t) => t.class_id!).filter(Boolean)}
                sessionIds={tags.map((t) => t.session_id!).filter(Boolean)}
                invoiceIds={tags.map((t) => t.invoice_id!).filter(Boolean)}
              />
            </div>
          )}
            </SegmentedTabPanelContent>
            <SegmentedTabPanelContent when="tasks" activeTab={section}>
              {issue?.id ? <LinkedTasksSection issueId={issue.id} /> : null}
            </SegmentedTabPanelContent>
          </SegmentedTabPanel>
        </div>
      </div>
    </>
  );
});
