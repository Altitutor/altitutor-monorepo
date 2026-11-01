"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Input,
  SearchableSelect,
  SegmentedControl,
  Textarea,
} from "@altitutor/ui";
import { AdminDialogShell } from "@/shared/components/dialog-shell";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import type { MailboxData } from "../types";
export function EmailSettingsDialog({
  mailbox,
  onClose,
}: {
  mailbox: MailboxData;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [tab, setTab] = useState("templates");
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [signature, setSignature] = useState(mailbox.signature);
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
      await client.invalidateQueries({ queryKey: ["email"] });
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
      await client.invalidateQueries({ queryKey: ["email"] });
      setNotice("Template deleted");
    }
    setBusy(false);
  }
  return (
    <>
      <AdminDialogShell
        open
        onClose={onClose}
        title="Email templates and signature"
        footer={
          <Button
            disabled={busy || (tab === "templates" && !name.trim())}
            onClick={() => void save()}
          >
            Save
          </Button>
        }
      >
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
              <Textarea
                className="mt-2 min-h-40"
                value={signature}
                onChange={(event) => setSignature(event.target.value)}
              />
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
              <label className="block text-sm">
                Template name
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                Subject (optional)
                <Input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                Message
                <Textarea
                  className="min-h-40"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                />
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
      </AdminDialogShell>
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
