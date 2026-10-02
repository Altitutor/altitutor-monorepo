"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  type JSONContent,
  type RichTextEditorRef,
} from "@altitutor/ui";
import { Form } from "@altitutor/ui";
import { MoreVertical } from "lucide-react";
import { RichTextTemplateMenuItems } from "@/features/rich-text-templates/components/RichTextTemplateMenuItems";
import { SaveAsTemplateDialog } from "@/features/rich-text-templates/components/SaveAsTemplateDialog";
import { AdminDialogShell } from "@/shared/components";
import { useCreateIssue } from "../api/mutations";
import { useCurrentStaff } from "@/shared/hooks";
import type { IssueFormData, IssueStatus, IssueTagInsert } from "../types";
import type { SubmitHandler } from "react-hook-form";
import { IssueContentPanel } from "./panels/IssueContentPanel";
import { IssuePropertiesPanel } from "./panels/IssuePropertiesPanel";
import { useDialogHotkeys } from "@/shared/hooks";
import { useLiveIssueTags } from "../hooks/useLiveIssueTags";
import { getTagEntity, resolveTagLabels } from "../utils/mentionLabels";
import { useCreateDialogDraft } from "@/shared/hooks/useCreateDialogDraft";
import { EntityResizablePanels } from "@/shared/components/EntityResizablePanels";

async function buildDescriptionFromInitialTags(
  tags?: Omit<IssueTagInsert, "issue_id">[],
): Promise<JSONContent | null> {
  if (!tags || tags.length === 0) return null;
  const labels = await resolveTagLabels(tags);

  const seen = new Set<string>();
  const content: JSONContent[] = [];

  tags.forEach((tag) => {
    const entity = getTagEntity(tag);
    if (!entity) return;

    const key = `${entity.type}:${entity.id}`;
    if (seen.has(key)) return;
    seen.add(key);

    content.push({
      type: "paragraph",
      content: [
        {
          type: "mention",
          attrs: {
            id: entity.id,
            type: entity.type,
            label: labels.get(key) || entity.id,
          },
        },
        { type: "text", text: " " },
      ],
    });
  });

  if (content.length === 0) return null;
  return { type: "doc", content };
}

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z
    .union([z.record(z.unknown()), z.string(), z.null()])
    .optional(),
  status: z.enum(["open", "awaiting_response", "resolved"]),
  dueDate: z.union([z.string(), z.null()]).default(null),
});

interface CreateIssueDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onIssueCreated?: () => void;
  initialStatus?: IssueStatus;
  initialDueDate?: string | null;
  initialTags?: Omit<IssueTagInsert, "issue_id">[];
}

export function CreateIssueDialog({
  isOpen,
  onClose,
  onIssueCreated,
  initialStatus = "open",
  initialDueDate = null,
  initialTags,
}: CreateIssueDialogProps) {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const descriptionRef = useRef<RichTextEditorRef>(null);
  const createIssue = useCreateIssue();
  const { data: currentStaff } = useCurrentStaff();

  const form = useForm<IssueFormData, unknown, IssueFormData>({
    resolver: zodResolver(formSchema) as Resolver<IssueFormData>,
    defaultValues: {
      name: "",
      description: null,
      status: initialStatus,
      dueDate: initialDueDate
        ? new Date(initialDueDate).toISOString().split("T")[0]
        : null,
    },
  });

  const draftKey = `issue:${JSON.stringify(initialTags?.map((tag) => Object.entries(tag).sort()).sort() ?? [])}`;
  const { readDraft, saveDraft, clearDraft, storageKey } = useCreateDialogDraft(
    form,
    isOpen,
    draftKey,
  );
  const initializedKey = useRef<string | null>(null);

  const liveTags = useLiveIssueTags({ form, initialTags });

  useEffect(() => {
    if (!isOpen) {
      initializedKey.current = null;
      return;
    }
    if (initializedKey.current === storageKey) return;
    initializedKey.current = storageKey;
    const draft = readDraft();
    if (draft) {
      form.reset(draft);
      return;
    }

    let cancelled = false;
    (async () => {
      const description = await buildDescriptionFromInitialTags(initialTags);
      if (cancelled || form.formState.isDirty) return;
      form.reset({
        name: "",
        description,
        status: initialStatus,
        dueDate: initialDueDate
          ? new Date(initialDueDate).toISOString().split("T")[0]
          : null,
      });
    })();

    return () => {
      cancelled = true;
      initializedKey.current = null;
    };
  }, [
    isOpen,
    initialStatus,
    initialDueDate,
    initialTags,
    form,
    readDraft,
    storageKey,
  ]);

  const handleClose = useCallback(() => {
    saveDraft();
    onClose();
  }, [saveDraft, onClose]);

  const onSubmit = useCallback(
    async (data: IssueFormData) => {
      try {
        await createIssue.mutateAsync({
          issue: {
            name: data.name,
            description: data.description || null,
            status: data.status,
            due_date: data.dueDate
              ? new Date(data.dueDate).toISOString()
              : null,
            created_by: currentStaff?.id ?? null,
          },
          tags: initialTags,
        });
        form.reset();
        clearDraft();
        onClose();
        onIssueCreated?.();
      } catch (error) {
        console.error("Failed to create issue:", error);
      }
    },
    [
      createIssue,
      form,
      clearDraft,
      onClose,
      initialTags,
      onIssueCreated,
      currentStaff?.id,
    ],
  );

  const handlePrimaryAction = useCallback(() => {
    if (createIssue.isPending) return;
    void form.handleSubmit(onSubmit as SubmitHandler<IssueFormData>)();
  }, [createIssue.isPending, form, onSubmit]);

  useDialogHotkeys({
    isOpen,
    onPrimaryAction: handlePrimaryAction,
    isActionDisabled: createIssue.isPending,
  });

  return (
    <>
      <AdminDialogShell
        fillHeight
        defaultExpanded
        open={isOpen}
        onClose={handleClose}
        title="Create Issue"
        contentClassName="md:max-w-4xl"
        bodyClassName="min-h-0 flex-1 overflow-hidden p-0"
        headerActions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <RichTextTemplateMenuItems
                getEditor={() => descriptionRef.current?.getEditor() ?? null}
                getCurrentContent={() => form.getValues("description") ?? null}
                onSaveAsTemplateClick={() => setIsSaveDialogOpen(true)}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        }
        footer={
          <>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-issue-form"
              disabled={createIssue.isPending}
            >
              {createIssue.isPending ? "Creating..." : "Create Issue"}
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form
            id="create-issue-form"
            onSubmit={form.handleSubmit(
              onSubmit as SubmitHandler<IssueFormData>,
            )}
            className="flex h-full min-h-0 flex-1"
          >
            <EntityResizablePanels
              id="create-issue-panels"
              primaryMinSize={320}
              secondaryMinSize={240}
              main={
                <IssuePropertiesPanel
                  form={form}
                  notes={[]}
                  isOpen={isOpen}
                  onClose={handleClose}
                  descriptionRef={descriptionRef}
                />
              }
              sidebar={
                <IssueContentPanel
                  isOpen={isOpen}
                  form={form}
                  tags={liveTags}
                />
              }
            />
          </form>
        </Form>
      </AdminDialogShell>
      <SaveAsTemplateDialog
        isOpen={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        initialContent={form.getValues("description") ?? null}
        onSuccess={() => setIsSaveDialogOpen(false)}
      />
    </>
  );
}
