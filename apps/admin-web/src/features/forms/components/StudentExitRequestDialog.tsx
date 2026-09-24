'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@altitutor/ui';
import { Check, CheckCircle2, ChevronDown, Copy, Loader2, MessageSquare } from 'lucide-react';
import { AdminDialogShell } from '@/shared/components';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { Composer } from '@/features/messages/components/Composer';
import { getContactIdByRelatedId } from '@/features/messages/api/queries';
import { useParentsForStudent } from '@/features/enrollments/hooks/useParentsForStudent';

type Recipient = { type: 'student' | 'parent'; id: string; label: string; value: string };

export function StudentExitRequestDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  studentPhone,
  workflowKey,
  classesStudentsId,
  classId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  studentPhone?: string | null;
  workflowKey: 'student_unenrolment' | 'student_discontinuation';
  classesStudentsId?: string;
  classId?: string;
  onCreated?: () => void;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [composerDraft, setComposerDraft] = useState('');
  const { data: parents = [] } = useParentsForStudent(studentId, open);
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;
  const isDiscontinuation = workflowKey === 'student_discontinuation';

  const recipients = useMemo<Recipient[]>(() => {
    const result: Recipient[] = [];
    if (studentPhone) result.push({ type: 'student', id: studentId, label: 'Student Phone', value: studentPhone });
    parents.forEach((parent) => {
      if (parent.phone) result.push({ type: 'parent', id: parent.id, label: `${parent.first_name} ${parent.last_name} Phone`, value: parent.phone });
    });
    return result;
  }, [parents, studentId, studentPhone]);

  useEffect(() => {
    if (!open) return;
    setLink(null);
    setError(null);
    setContactId(null);
    setSelectedRecipient(null);
    setComposerDraft('');
    setSaving(true);
    fetch('/api/forms/exit-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, workflowKey, classesStudentsId, classId }),
    })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? 'Could not create request');
        setLink(json.url);
        onCreatedRef.current?.();
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not create request'))
      .finally(() => setSaving(false));
  }, [classId, classesStudentsId, open, studentId, workflowKey]);

  useEffect(() => {
    if (!selectedRecipient && recipients.length) setSelectedRecipient(recipients[0]);
  }, [recipients, selectedRecipient]);

  useEffect(() => {
    if (!selectedRecipient) return setContactId(null);
    getContactIdByRelatedId(selectedRecipient.id, selectedRecipient.type)
      .then(setContactId)
      .catch(() => setContactId(null));
  }, [selectedRecipient]);

  useEffect(() => {
    if (!link || !selectedRecipient) return;
    const firstName = selectedRecipient.type === 'parent'
      ? parents.find((parent) => parent.id === selectedRecipient.id)?.first_name ?? 'there'
      : studentName.split(' ')[0] || 'there';
    const requestName = isDiscontinuation ? 'discontinuation' : 'class unenrolment';
    setComposerDraft(`Hi ${firstName}, please use this link to complete the ${requestName} form: ${link}`);
  }, [isDiscontinuation, link, parents, selectedRecipient, studentName]);

  return (
    <AdminDialogShell
        fillHeight
      open={open}
      onClose={() => onOpenChange(false)}
      title={isDiscontinuation ? `Discontinue ${studentName}` : `Send ${studentName} an unenrolment link`}
      subtitle={saving ? 'Creating link…' : error ? 'The link could not be created' : 'Send Message'}
      contentClassName="md:max-w-4xl"
      footer={<Button onClick={() => onOpenChange(false)}>Done</Button>}
    >
      {saving ? (
        <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
      ) : link ? (
        <div className="flex h-full min-h-0 flex-col gap-4">
          <div className="flex shrink-0 items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
            <p className="min-w-0 flex-1 text-sm text-green-800 dark:text-green-200">Link created successfully.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(link)}><Copy className="mr-2 h-4 w-4" />Copy link</Button>
          </div>
          {selectedRecipient && recipients.length ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border">
              <div className="flex shrink-0 items-center gap-2 border-b bg-background px-3 py-2">
                <span className="text-sm font-medium">Message</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7">
                      <MessageSquare className="mr-1 h-3 w-3" /><span className="text-xs">{selectedRecipient.label}</span><ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {recipients.map((recipient) => (
                      <DropdownMenuItem key={`${recipient.type}-${recipient.id}`} onClick={() => setSelectedRecipient(recipient)}>
                        <span className="flex-1">{recipient.label} · {recipient.value}</span>
                        {recipient.id === selectedRecipient.id ? <Check className="ml-2 h-4 w-4" /> : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {contactId ? (
                <><div className="flex min-h-0 flex-1 flex-col"><MessageThread contactId={contactId} /></div><div className="shrink-0 border-t"><Composer contactId={contactId} draft={composerDraft} onDraftChange={setComposerDraft} onDraftClear={() => setComposerDraft('')} onBeforeSend={async () => null} /></div></>
              ) : <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading contact…</div>}
            </div>
          ) : (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-200">No phone number found for the student or parents. Copy the link to share it another way.</div>
          )}
        </div>
      ) : null}
    </AdminDialogShell>
  );
}
