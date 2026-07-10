'use client';

import { useEffect, useState } from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, FormAnswerer, SearchableSelect } from '@altitutor/ui';
import type { FormBlock, FormAnswerPayload } from '@altitutor/shared';

type Participant = { id: string; first_name: string | null; last_name: string | null; type: 'student' | 'staff' | 'parent' };
type SessionForm = { id: string; name: string; purpose: string; form_versions: { id: string; version_number: number; blocks: FormBlock[]; thank_you_message: string } | null };

const label = (person: Participant) => `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() + ` (${person.type})`;

export function SessionFormResponseDialog({ sessionId, open, onOpenChange, onSaved }: { sessionId: string; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [forms, setForms] = useState<SessionForm[]>([]);
  const [participantId, setParticipantId] = useState('');
  const [formId, setFormId] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setError(null); setParticipantId(''); setFormId('');
    fetch(`/api/forms/session-responses?sessionId=${sessionId}`).then(async (res) => {
      const json = await res.json(); if (!res.ok) throw new Error(json.error ?? 'Could not load session forms');
      setParticipants(json.participants ?? []); setForms(json.forms ?? []);
    }).catch((err) => setError(err.message));
  }, [open, sessionId]);
  const participant = participants.find((row) => row.id === participantId) ?? null;
  const form = forms.find((row) => row.id === formId) ?? null;
  const version = form?.form_versions ?? null;
  const submit = async (answers: FormAnswerPayload) => {
    const res = await fetch('/api/forms/session-responses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, formId, subjectId: participantId, subjectType: participant?.type, answers }) });
    const json = await res.json(); if (!res.ok) throw new Error(json.error ?? 'Could not save response');
    onSaved(); onOpenChange(false);
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto md:max-w-3xl"><DialogHeader><DialogTitle>Add form response</DialogTitle></DialogHeader>
    <div className="grid gap-3 sm:grid-cols-2"><SearchableSelect items={participants} value={participant} onValueChange={(value) => setParticipantId(value?.id ?? '')} getItemId={(row) => row.id} getItemLabel={label} placeholder="Select participant" trigger={<Button variant="outline" className="w-full justify-start font-normal">{participant ? label(participant) : 'Select participant'}</Button>} />
      <SearchableSelect items={forms} value={form} onValueChange={(value) => setFormId(value?.id ?? '')} getItemId={(row) => row.id} getItemLabel={(row) => row.name} placeholder="Select form" trigger={<Button variant="outline" className="w-full justify-start font-normal">{form?.name ?? 'Select form'}</Button>} /></div>
    {error ? <div className="text-sm text-destructive">{error}</div> : null}
    {participant && form && version ? <FormAnswerer title={form.name} blocks={version.blocks} thankYouMessage={version.thank_you_message} submitLabel="Save response" onSubmit={submit} /> : <p className="py-8 text-center text-sm text-muted-foreground">Select a participant and published check-in or feedback form.</p>}
  </DialogContent></Dialog>;
}
