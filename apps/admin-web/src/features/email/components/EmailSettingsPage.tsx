"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Editor } from "@tiptap/core";
import { MoreHorizontal, Plus, Pencil, Trash2 } from "lucide-react";
import {
  Button,
  Input,
  SegmentedControl,
  DataTableToolbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TablePagination,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@altitutor/ui";
import {
  EmailBodyEditor,
  EmailFormatting,
  signatureHtml,
} from "./EmailBodyEditor";
import { AdminDialogShell } from "@/shared/components/dialog-shell";
import { AdminPageActionButton } from "@/shared/components/admin-page-action-button";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import type { MailboxData } from "../types";
import { useMailbox } from "../api/client";
import { SettingsPageHeader } from "@/shared/components/settings-page-header";
import type { DisplaySettings } from "@altitutor/shared";
const defaultDisplay: DisplaySettings & {
  search: string;
  page: number;
  pageSize: number;
} = {
  search: "",
  filters: {},
  sortBy: "name",
  sortDirection: "asc" as const,
  groupBy: null,
  visibleColumns: ["name", "subject", "preview"],
  page: 1,
  pageSize: 20,
};
function plainPreview(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function EmailSettingsContent({ mailbox }: { mailbox: MailboxData }) {
  const client = useQueryClient();
  const [tab, setTab] = useState("templates");
  const [display, setDisplay] = useState(defaultDisplay);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  function edit(template?: MailboxData["templates"][number]) {
    setSelected(template?.id ?? null);
    setName(template?.name ?? "");
    setSubject(template?.subject ?? "");
    setBody(
      tab === "signature" ? mailbox.signature : (template?.body_text ?? ""),
    );
    setNotice("");
    setEditing(true);
  }
  async function save() {
    setBusy(true);
    setNotice("");
    try {
      const db = getSupabaseClient();
      const result =
        tab === "signature"
          ? await db
              .from("email_signatures")
              .upsert({ staff_id: mailbox.currentStaffId, body_text: body })
          : await db.from("email_templates").upsert({
              ...(selected ? { id: selected } : {}),
              name: name.trim(),
              subject,
              body_text: body,
            });
      if (result.error) throw result.error;
      await client.invalidateQueries({ queryKey: ["email", "mailbox"] });
      setEditing(false);
      setNotice("Saved");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not save email settings.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await getSupabaseClient()
        .from("email_templates")
        .delete()
        .eq("id", selected);
      if (result.error) throw result.error;
      await client.invalidateQueries({ queryKey: ["email", "mailbox"] });
      setConfirmDelete(false);
      setNotice("Template deleted");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not delete template.",
      );
    } finally {
      setBusy(false);
    }
  }
  const rows = (
    tab === "templates"
      ? mailbox.templates.map((item) => ({
          ...item,
          preview: plainPreview(item.body_text),
        }))
      : [
          {
            id: "signature",
            name: "My signature",
            subject: "",
            body_text: mailbox.signature,
            preview: plainPreview(mailbox.signature),
          },
        ]
  )
    .filter((row) =>
      [row.name, row.subject, row.preview]
        .join(" ")
        .toLowerCase()
        .includes(display.search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        (display.sortDirection === "asc" ? 1 : -1) *
        (display.sortBy === "subject"
          ? a.subject.localeCompare(b.subject)
          : a.name.localeCompare(b.name)),
    );
  const page = rows.slice(
    (display.page - 1) * display.pageSize,
    display.page * display.pageSize,
  );
  return (
    <>
      <SettingsPageHeader
        title="Email"
        actions={
          tab === "templates" ? (
            <AdminPageActionButton
              icon={<Plus className="h-4 w-4" />}
              label="New template"
              onClick={() => edit()}
            />
          ) : undefined
        }
      />
      <SegmentedControl
        className="w-full max-w-4xl min-w-0"
        fullWidth
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          setDisplay({
            ...defaultDisplay,
            visibleColumns:
              value === "signature"
                ? ["name", "preview"]
                : defaultDisplay.visibleColumns,
          });
        }}
        options={[
          { value: "templates", label: "Shared templates" },
          { value: "signature", label: "My signature" },
        ]}
        aria-label="Email settings"
      />
      <div className="space-y-4">
        <DataTableToolbar
          state={display}
          onSearchChange={(search) =>
            setDisplay((all) => ({ ...all, search, page: 1 }))
          }
          onFiltersChange={() => {}}
          onSortChange={(sortBy, sortDirection) =>
            setDisplay((all) => ({
              ...all,
              sortBy: sortBy ?? "name",
              sortDirection,
            }))
          }
          onGroupByChange={() => {}}
          onVisibleColumnsChange={(visibleColumns) =>
            setDisplay((all) => ({ ...all, visibleColumns }))
          }
          onQuickFilterApply={() => {}}
          onReset={() => setDisplay(defaultDisplay)}
          filterDefinitions={[]}
          sortOptions={[
            { key: "name", label: "Name" },
            ...(tab === "templates"
              ? [{ key: "subject", label: "Subject" }]
              : []),
          ]}
          columnDefinitions={[
            { key: "name", label: "Name" },
            ...(tab === "templates"
              ? [{ key: "subject", label: "Subject" }]
              : []),
            { key: "preview", label: "Preview" },
          ]}
          defaultVisibleColumns={
            tab === "signature"
              ? ["name", "preview"]
              : defaultDisplay.visibleColumns
          }
          searchPlaceholder={
            tab === "templates"
              ? "Search email templates…"
              : "Search signature…"
          }
        />
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {display.visibleColumns.includes("name") && (
                  <TableHead>Name</TableHead>
                )}
                {tab === "templates" &&
                  display.visibleColumns.includes("subject") && (
                    <TableHead>Subject</TableHead>
                  )}
                {display.visibleColumns.includes("preview") && (
                  <TableHead>Preview</TableHead>
                )}
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.map((row) => (
                <TableRow key={row.id}>
                  {display.visibleColumns.includes("name") && (
                    <TableCell className="font-medium">{row.name}</TableCell>
                  )}
                  {tab === "templates" &&
                    display.visibleColumns.includes("subject") && (
                      <TableCell>{row.subject || "—"}</TableCell>
                    )}
                  {display.visibleColumns.includes("preview") && (
                    <TableCell className="max-w-96 truncate text-muted-foreground">
                      {row.preview || "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Actions for ${row.name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() =>
                            edit(
                              tab === "templates"
                                ? mailbox.templates.find(
                                    (item) => item.id === row.id,
                                  )
                                : undefined,
                            )
                          }
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        {tab === "templates" && (
                          <DropdownMenuItem
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                            onSelect={() => {
                              setSelected(row.id);
                              setConfirmDelete(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!page.length && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No {tab === "templates" ? "templates" : "signature"} found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <TablePagination
          page={display.page}
          pageSize={display.pageSize}
          total={rows.length}
          onPageChange={(page) => setDisplay((all) => ({ ...all, page }))}
          onPageSizeChange={(pageSize) =>
            setDisplay((all) => ({ ...all, pageSize, page: 1 }))
          }
        />
      </div>
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      <AdminDialogShell
        open={editing}
        onClose={() => {
          if (!busy) setEditing(false);
        }}
        title={
          tab === "signature"
            ? "My signature"
            : selected
              ? "Edit email template"
              : "New email template"
        }
        footer={
          <Button
            disabled={busy || (tab === "templates" && !name.trim())}
            onClick={() => void save()}
          >
            Save
          </Button>
        }
      >
        {notice && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {notice}
          </p>
        )}
        <div className="space-y-3 rounded-xl bg-muted/35 p-4">
          {tab === "templates" && (
            <div className="space-y-2">
              <label className="grid grid-cols-[7rem_minmax(0,1fr)] items-center text-sm">
                <span className="text-muted-foreground">Template name</span>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={busy}
                  className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </label>
              <label className="grid grid-cols-[7rem_minmax(0,1fr)] items-center text-sm">
                <span className="text-muted-foreground">Subject</span>
                <Input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  disabled={busy}
                  className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </label>
            </div>
          )}
          <div className={tab === "templates" ? "border-t pt-3" : ""}>
            <EmailBodyEditor
              key={`${tab}:${selected}:${editing}`}
              html={signatureHtml(body)}
              disabled={busy}
              onChange={(value) => setBody(value.bodyHtml)}
              onEditorReady={setEditor}
            />
          </div>
          <div className="overflow-x-auto border-t pt-3">
            <EmailFormatting editor={editor} disabled={busy} />
          </div>
        </div>
      </AdminDialogShell>
      <AdminDialogShell
        open={confirmDelete}
        onClose={() => {
          if (!busy) setConfirmDelete(false);
        }}
        title="Delete shared email template?"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void remove()}
            >
              Delete template
            </Button>
          </>
        }
      >
        <p className="text-sm">
          This removes the shared template. Existing drafts keep their text.
        </p>
      </AdminDialogShell>
    </>
  );
}
export function EmailSettingsPage() {
  const mailbox = useMailbox();
  return (
    <div className="space-y-6 p-6">
      {mailbox.data ? (
        <EmailSettingsContent mailbox={mailbox.data} />
      ) : (
        <>
          <SettingsPageHeader title="Email" />
          <p className="text-sm text-muted-foreground">
            Loading email settings…
          </p>
        </>
      )}
      {mailbox.error && (
        <p role="alert" className="text-sm text-destructive">
          {mailbox.error.message}
        </p>
      )}
    </div>
  );
}
