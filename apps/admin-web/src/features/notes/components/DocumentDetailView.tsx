"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Editor } from "@tiptap/react";
import {
  Button,
  Form,
  FormField,
  FormItem,
  FormControl,
  DialogTitle,
  type RichTextEditorRef,
} from "@altitutor/ui";
import { X, ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { useWorkItemEditor } from "@/features/work-item-editing/useWorkItemEditor";
import {
  EditorControls,
  EditorNotices,
  WorkItemEditableContext,
} from "@/features/work-item-editing/EditorControls";
import {
  documentFromRecord,
  documentToRecord,
} from "@/features/work-item-editing/fields";
import { EntityResizablePanels } from "@/shared/components/EntityResizablePanels";
import { AdminRichTextEditorWithImages } from "@/features/rich-text-images";
import { useMentionSuggestions } from "@/shared/hooks/useMentionSuggestions";
import { DOCUMENT_NOTE_MENTION_TYPES } from "../constants/documentEditorMentions";
import { DOCUMENT_TITLE_FIELD_CLASS } from "../constants/documentTitle";
import { useFitDocumentTitle } from "../hooks/useFitDocumentTitle";
import { useFolders } from "../api/queries";
import { NoteDocumentSidebarPanel } from "./NoteDocumentSidebarPanel";
import { NoteEditorBottomToolbar } from "./NoteEditorBottomToolbar";
import type { NoteFormData } from "../types";
import { EditDocumentDialog } from "./EditDocumentDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@altitutor/ui";
import { RichTextTemplateMenuItems } from "@/features/rich-text-templates/components/RichTextTemplateMenuItems";
import { SaveAsTemplateDialog } from "@/features/rich-text-templates/components/SaveAsTemplateDialog";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.unknown(),
  folder_id: z.string().nullable().optional(),
  project_id: z.string().nullable().optional(),
  is_tutor_documentation: z.boolean().optional(),
});
export function DocumentDetailView({
  noteId,
  onClose,
  variant,
}: {
  noteId: string;
  onClose: () => void;
  variant: "page" | "dialog";
}) {
  const router = useRouter();
  const form = useForm<NoteFormData>({
    resolver: zodResolver(schema) as Resolver<NoteFormData>,
    defaultValues: {
      title: "",
      content: "",
      folder_id: null,
      project_id: null,
      is_tutor_documentation: false,
    },
  });
  const editor = useWorkItemEditor({
    kind: "document",
    id: noteId,
    form,
    fromRecord: documentFromRecord,
    toRecord: documentToRecord,
    onClose,
  });
  const { data: folders } = useFolders();
  const titleRef = useRef<HTMLInputElement>(null);
  const richTextRef = useRef<RichTextEditorRef>(null);
  const [instance, setInstance] = useState<Editor | null>(null);
  const [linkedId, setLinkedId] = useState<string | null>(null);
  const [saveTemplate, setSaveTemplate] = useState(false);
  useFitDocumentTitle(titleRef, form.watch("title"));
  const mentions = useMentionSuggestions({
    types: DOCUMENT_NOTE_MENTION_TYPES,
    excludeIds: [noteId],
  });
  return (
    <WorkItemEditableContext.Provider value={editor.editable}>
      <div className="h-full min-h-0 flex flex-col overflow-hidden">
        <div className="shrink-0 border-b bg-card px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Close"
              onClick={() => editor.requestClose()}
            >
              {variant === "dialog" ? (
                <X className="h-4 w-4" />
              ) : (
                <ArrowLeft className="h-4 w-4" />
              )}
            </Button>
            {variant === "dialog" ? (
              <DialogTitle>Document</DialogTitle>
            ) : (
              <h1 className="text-2xl font-bold">Document</h1>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <EditorControls editor={editor} />
            {variant === "dialog" && (
              <Button
                variant="outline"
                size="icon"
                aria-label="Open in page"
                onClick={() =>
                  editor.requestClose(() => {
                    router.push(`/documents/${noteId}`);
                    onClose();
                  })
                }
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              aria-label="Delete document"
              disabled={!editor.editable}
              onClick={() => {
                if (window.confirm("Permanently delete this document?"))
                  void editor.remove();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={!editor.editable}>
                  Templates
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <RichTextTemplateMenuItems
                  getEditor={() => richTextRef.current?.getEditor() ?? null}
                  getCurrentContent={() => form.getValues("content") ?? null}
                  onSaveAsTemplateClick={() => setSaveTemplate(true)}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <EditorNotices editor={editor} />
        {!editor.session ? (
          <p className="p-6">Opening document…</p>
        ) : (
          <Form {...form}>
            <form
              className="flex-1 min-h-0 flex"
              onSubmit={(event) => {
                event.preventDefault();
                void editor.save();
              }}
            >
              <EntityResizablePanels
                id={`document-${noteId}-panels`}
                main={
                  <div className="flex h-full min-h-0 flex-col overflow-hidden">
                    <div
                      className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
                      data-rich-text-toolbar-container
                    >
                      <div className="mx-auto max-w-3xl p-6 space-y-4">
                        <FormField
                          control={form.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <input
                                  {...field}
                                  ref={titleRef}
                                  readOnly={!editor.editable}
                                  placeholder="Untitled"
                                  className={`${DOCUMENT_TITLE_FIELD_CLASS} w-full bg-transparent outline-none`}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="content"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <AdminRichTextEditorWithImages
                                  ref={richTextRef}
                                  content={field.value}
                                  onChange={field.onChange}
                                  onChangeDebounceMs={0}
                                  onEditorReady={setInstance}
                                  editable={editor.editable}
                                  context="notes_documents"
                                  mentionSuggestions={mentions}
                                  onMentionClick={(detail) => {
                                    if (
                                      detail.type === "note" &&
                                      detail.id !== noteId
                                    ) {
                                      setLinkedId(detail.id);
                                      return true;
                                    }
                                    return false;
                                  }}
                                  floatingToolbar
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    {editor.editable && (
                      <NoteEditorBottomToolbar editor={instance} />
                    )}
                  </div>
                }
                sidebar={
                  <NoteDocumentSidebarPanel
                    form={form}
                    folders={folders ?? []}
                    editable={editor.editable}
                    editor={instance}
                  />
                }
              />
            </form>
          </Form>
        )}
      </div>
      <SaveAsTemplateDialog
        isOpen={saveTemplate}
        onClose={() => setSaveTemplate(false)}
        initialContent={form.getValues("content") ?? null}
        onSuccess={() => setSaveTemplate(false)}
      />
      {linkedId && (
        <EditDocumentDialog
          isOpen
          noteId={linkedId}
          onClose={() => setLinkedId(null)}
        />
      )}
    </WorkItemEditableContext.Provider>
  );
}
