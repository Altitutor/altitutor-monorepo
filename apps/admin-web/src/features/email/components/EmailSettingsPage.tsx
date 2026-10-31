"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Input,
  SearchableSelect,
  SegmentedControl,
} from "@altitutor/ui";
import {
  EmailBodyEditor,
  EmailFormatting,
  signatureHtml,
} from "./EmailBodyEditor";
import type { Editor } from "@tiptap/core";
import { AdminDialogShell } from "@/shared/components/dialog-shell";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import type { MailboxData } from "../types";
import { useMailbox } from "../api/client";
import { SettingsPageHeader } from "@/shared/components/settings-page-header";
function EmailSettingsContent({ mailbox }: { mailbox: MailboxData }) {
  const client = useQueryClient();
  const [tab, setTab] = useState("templates");
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [signature, setSignature] = useState(mailbox.signature);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  async function save() {
    setBusy(true);
    setNotice("");
    try {
      const db = getSupabaseClient();
      if (tab === "signature") {
        const result = await db
          .from("email_signatures")
          .upsert({ staff_id: mailbox.currentStaffId, body_text: signature });
        if (result.error) throw result.error;
      } else {
        const result = await db
          .from("email_templates")
          .upsert({
            ...(selected ? { id: selected } : {}),
            name,
            subject,
            body_text: body,
          })
          .select("id")
          .single();
        if (result.error) throw result.error;
        setSelected(result.data.id);
      }
      await client.invalidateQueries({ queryKey: ["email", "mailbox"] });
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
    const result = await getSupabaseClient()
      .from("email_templates")
      .delete()
      .eq("id", selected);
    if (result.error) setNotice(result.error.message);
    else {
      setSelected(null);
      setName("");
      setSubject("");
      setBody("");
      setConfirmDelete(false);
      await client.invalidateQueries({ queryKey: ["email", "mailbox"] });
      setNotice("Template deleted");
    }
    setBusy(false);
  }
  return (
    <>
      <section className="rounded-2xl bg-muted/35 p-5">
        <div className="space-y-4">
          <SegmentedControl
            value={tab}
            onValueChange={setTab}
            options={[
              { value: "templates", label: "Shared templates" },
              { value: "signature", label: "My signature" },
            ]}
            aria-label="Email settings"
          />
          {tab === "signature" ? (
            <label className="block text-sm">
              Your staff signature
              <EmailBodyEditor
                html={signatureHtml(signature)}
                disabled={busy}
                onChange={(value) => setSignature(value.bodyHtml)}
                onEditorReady={setEditor}
              />
              <div className="overflow-x-auto border-t pt-3">
                <EmailFormatting editor={editor} disabled={busy} />
              </div>
              <span className="mt-2 block text-xs text-muted-foreground">
                New emails and replies still use the shared admin@ mailbox.
              </span>
            </label>
          ) : (
            <>
              <div className="flex gap-2">
                <SearchableSelect
                  items={mailbox.templates}
                  value={
                    mailbox.templates.find(
                      (template) => template.id === selected,
                    ) ?? null
                  }
                  getItemId={(template) => template.id}
                  getItemLabel={(template) => template.name}
                  onValueChange={(template) => {
                    setSelected(template?.id ?? null);
                    setName(template?.name ?? "");
                    setSubject(template?.subject ?? "");
                    setBody(template?.body_text ?? "");
                  }}
                  searchPlaceholder="Search shared email templates…"
                  placeholder="Choose template"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelected(null);
                    setName("");
                    setSubject("");
                    setBody("");
                  }}
                >
                  New
                </Button>
              </div>
              <label className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 text-sm">
                Template name
                <Input
                  className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 text-sm">
                Subject (optional)
                <Input
                  className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                Message
                <EmailBodyEditor
                  html={signatureHtml(body)}
                  disabled={busy}
                  onChange={(value) => setBody(value.bodyHtml)}
                  onEditorReady={setEditor}
                />
                <div className="overflow-x-auto border-t pt-3">
                  <EmailFormatting editor={editor} disabled={busy} />
                </div>
              </label>
              {selected && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete shared template
                </Button>
              )}
            </>
          )}
          {notice && (
            <p role="status" className="text-sm text-muted-foreground">
              {notice}
            </p>
          )}
        </div>
        <div className="mt-4 flex justify-end border-t pt-3">
          <Button
            variant="outline"
            className="rounded-full"
            disabled={busy || (tab === "templates" && !name.trim())}
            onClick={() => void save()}
          >
            Save
          </Button>
        </div>
      </section>
      <AdminDialogShell
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
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
          This removes the template from the shared picker for all staff.
          Existing drafts keep their text.
        </p>
      </AdminDialogShell>
    </>
  );
}

export function EmailSettingsPage() {
  const mailbox = useMailbox();
  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <SettingsPageHeader title="Email" />
      {mailbox.data ? (
        <EmailSettingsContent mailbox={mailbox.data} />
      ) : (
        <p className="text-sm text-muted-foreground">Loading email settings…</p>
      )}
      {mailbox.error && (
        <p role="alert" className="text-sm text-destructive">
          {mailbox.error.message}
        </p>
      )}
    </div>
  );
}
