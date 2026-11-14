"use client";
import { useEntityNavigation } from "@/shared/contexts/EntityNavigation";

import { useRef, useCallback, memo } from "react";
import { UseFormReturn } from "react-hook-form";
import { IssueDueDateField } from "../fields/IssueDueDateField";
import { IssuePriorityField } from "../fields/IssuePriorityField";
import { IssueStatusField } from "../fields/IssueStatusField";
import { IssueTitleField } from "@/features/issues/components/fields/IssueTitleField";
import { IssueDescriptionField } from "@/features/issues/components/fields/IssueDescriptionField";
import type { RichTextEditorRef } from "@altitutor/ui";
import type { IssueFormData, IssueWithTags } from "../../types";
import type { TagEntityType } from "@/shared/utils/tagParsing";

interface IssuePropertiesPanelProps {
  form: UseFormReturn<IssueFormData>;
  issue?: IssueWithTags;
  descriptionRef?: React.RefObject<RichTextEditorRef | null>;
}

export const IssuePropertiesPanel = memo(function IssuePropertiesPanel({
  form,
  issue,
  descriptionRef: descriptionRefProp,
}: IssuePropertiesPanelProps) {
  const titleFieldRef = useRef<HTMLInputElement>(null);
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
    <div
      className="h-full min-h-0 min-w-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-6"
      data-rich-text-toolbar-container
    >
      <IssueTitleField form={form} onEnter={handleTitleEnter} titleRef={titleFieldRef} />
      {issue && (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <IssueStatusField form={form} pill />
          <IssuePriorityField form={form} pill />
          <IssueDueDateField form={form} pill />
        </div>
      )}
      <IssueDescriptionField
        form={form}
        value={form.getValues("description")}
        onTagClick={handleTagClick}
        descriptionRef={descriptionRef}
      />
    </div>
  );
});
