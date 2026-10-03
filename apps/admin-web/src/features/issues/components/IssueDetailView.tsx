"use client";
import { AccessoryBreadcrumb } from "@/shared/components/accessory-panel/AccessoryBreadcrumb";
import { useAccessoryTitle } from "@/shared/hooks/useAccessoryTitle";

import { useWorkItemEditor } from "@/features/work-item-editing/useWorkItemEditor";
import {
  EditorCloseConfirmDialog,
  EditorControls,
  EditorFooterActions,
  EditorNotices,
  WorkItemEditableContext,
} from "@/features/work-item-editing/EditorControls";
import {
  issueFromRecord,
  issueToRecord,
} from "@/features/work-item-editing/fields";

import { useState, useRef } from "react";
import { useForm, type UseFormReturn, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  type RichTextEditorRef,
  Form,
} from "@altitutor/ui";
import { Loader2 } from "lucide-react";
import { useIssue } from "../api/queries";
import { useNotes } from "@/shared/hooks/useNotes";
import type { Tables } from "@altitutor/shared";
import type { IssueFormData, IssueWithTags } from "../types";
import { IssueContentPanel } from "./panels/IssueContentPanel";
import { IssuePropertiesPanel } from "./panels/IssuePropertiesPanel";
import { ActionsMenu } from "@/shared/components/ActionsMenu";
import { SaveAsTemplateDialog } from "@/features/rich-text-templates/components/SaveAsTemplateDialog";
import { useLiveIssueTags } from "../hooks/useLiveIssueTags";
import { EntityResizablePanels } from "@/shared/components/EntityResizablePanels";

type NoteWithStaff = Tables<"notes"> & {
  staff?: Tables<"staff"> | null;
};

/** Keeps description watch + tag extraction off the dialog shell so typing does not re-render the header. */
function IssueLiveTagsPanels({
  form,
  issue,
  notes,
  isOpen,
  onClose,
  descriptionRef,
}: {
  form: UseFormReturn<IssueFormData>;
  issue: IssueWithTags;
  notes: NoteWithStaff[];
  isOpen: boolean;
  onClose: () => void;
  descriptionRef: React.RefObject<RichTextEditorRef>;
}) {
  const liveTags = useLiveIssueTags({
    form,
    initialTags: issue.tags || [],
  });

  return (
    <EntityResizablePanels
      id={`issue-${issue.id}-panels`}
      main={
        <IssuePropertiesPanel
          form={form}
          issue={issue}
          tags={liveTags}
          notes={notes}
          isOpen={isOpen}
          onClose={onClose}
          descriptionRef={descriptionRef}
        />
      }
      sidebar={
        <IssueContentPanel isOpen={isOpen} form={form} tags={liveTags} />
      }
    />
  );
}

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z
    .union([z.record(z.unknown()), z.string(), z.null()])
    .optional(),
  status: z.enum(["open", "awaiting_response", "resolved"]),
  dueDate: z.union([z.string(), z.null()]).default(null),
});

export interface IssueDetailViewProps {
  issueId: string;
  enabled?: boolean;
  onClose: () => void;
  onIssueUpdated?: () => void;
  variant: "dialog" | "page";
}

export function IssueDetailView({
  issueId,
  enabled = true,
  onClose,
  onIssueUpdated: _onIssueUpdated,
  variant,
}: IssueDetailViewProps) {
  const { data: issue, isLoading } = useIssue(issueId, enabled);
  useAccessoryTitle(issue?.name);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const descriptionRef = useRef<RichTextEditorRef>(null);

  const handleDelete = async () => {
    try {
      await editor.remove();
    } catch (error) {
      console.error("Failed to delete issue:", error);
    }
  };

  const { data: notesData } = useNotes("issues", issueId, enabled);
  const notes = (notesData || []) as NoteWithStaff[];

  const form = useForm<IssueFormData, unknown, IssueFormData>({
    resolver: zodResolver(formSchema) as Resolver<IssueFormData>,
    defaultValues: {
      name: "",
      description: null,
      status: "open",
      dueDate: null,
    },
  });

  const editor = useWorkItemEditor({
    kind: "issue",
    id: issueId,
    enabled,
    form,
    fromRecord: issueFromRecord,
    toRecord: issueToRecord,
    onClose,
  });

  return (
    <>
      <WorkItemEditableContext.Provider value={editor.editable}>
        <Form {...form}>
          <div className="h-full min-h-0 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 border-b bg-background px-4 py-2">
              <div className="flex min-w-0 items-center justify-between gap-2 w-full">
                <AccessoryBreadcrumb />

                <div className="flex shrink-0 items-center gap-2">
                  {
                    <>
                      <EditorControls editor={editor} />
                      <ActionsMenu
                        type="issue"
                        entityId={issueId}
                        onDelete={() => {
                          if (editor.editable) setIsDeleteDialogOpen(true);
                        }}
                        richTextTemplateConfig={{
                          getEditor: () =>
                            editor.editable
                              ? (descriptionRef.current?.getEditor() ?? null)
                              : null,
                          getCurrentContent: () =>
                            form.getValues("description") ?? null,
                          onSaveAsTemplateClick: () =>
                            setIsSaveDialogOpen(true),
                        }}
                      />
                    </>
                  }
                </div>
              </div>
            </div>

            <EditorNotices editor={editor} />
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
              {isLoading || !editor.session ? (
                <div className="p-6">Loading issue data...</div>
              ) : !issue ? (
                <div className="p-6">Issue not found</div>
              ) : (
                <div className="h-full min-h-0 flex min-w-0 overflow-hidden">
                  <form
                    className="h-full flex-1 flex min-h-0 min-w-0 overflow-hidden"
                    onSubmit={(e) => e.preventDefault()}
                  >
                    <fieldset disabled={!editor.editable} className="contents">
                      <IssueLiveTagsPanels
                        form={form}
                        issue={issue}
                        notes={notes}
                        isOpen={enabled}
                        onClose={onClose}
                        descriptionRef={descriptionRef}
                      />
                    </fieldset>
                  </form>
                </div>
              )}
            </div>
            {variant === "dialog" ? (
              <div className="shrink-0 border-t bg-card px-6 py-4">
                <EditorFooterActions editor={editor} />
              </div>
            ) : null}
          </div>
        </Form>
      </WorkItemEditableContext.Provider>

      <EditorCloseConfirmDialog editor={editor} />

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              issue and all associated activity records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!editor.editable || editor.deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {editor.deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <SaveAsTemplateDialog
        isOpen={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        initialContent={form.getValues("description") ?? null}
        onSuccess={() => setIsSaveDialogOpen(false)}
      />
    </>
  );
}
