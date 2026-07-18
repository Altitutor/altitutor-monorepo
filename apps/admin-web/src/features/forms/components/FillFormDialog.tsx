'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, FormAnswerer, SearchableSelect, SegmentedControl } from '@altitutor/ui';
import type { FormAnswerPayload, FormBlock } from '@altitutor/shared';
import { Copy, Link2 } from 'lucide-react';
import { AdminDialogShell } from '@/shared/components';

type RespondentType = 'student' | 'parent' | 'staff';
type Person = { id: string; first_name: string | null; last_name: string | null; type?: RespondentType };
type FillForm = {
  id: string;
  name: string;
  purpose: string;
  form_versions: { id: string; blocks: FormBlock[]; thank_you_message: string; version_number: number } | null;
};

function personLabel(person: Person, includeType = false) {
  const label = `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || person.id;
  if (!includeType || !person.type) return label;
  return `${label} · ${person.type.charAt(0).toUpperCase()}${person.type.slice(1)}`;
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error ?? 'Request failed.');
  return json as T;
}

export function FillFormDialog({
  open,
  onClose,
  sessionId,
  lockedFormId,
  initialRespondent,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  sessionId?: string;
  lockedFormId?: string;
  initialRespondent?: { type: RespondentType; id: string };
  onSaved?: (responseId: string) => void;
}) {
  const [forms, setForms] = useState<FillForm[]>([]);
  const [sessionPeople, setSessionPeople] = useState<Person[]>([]);
  const [respondentType, setRespondentType] = useState<RespondentType>(initialRespondent?.type ?? 'student');
  const [people, setPeople] = useState<Person[]>([]);
  const [person, setPerson] = useState<Person | null>(null);
  const [form, setForm] = useState<FillForm | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialRespondentType = initialRespondent?.type;
  const initialRespondentId = initialRespondent?.id;

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setForm(null);
    setPerson(null);
    setCopiedUrl(null);
    setRespondentType(initialRespondentType ?? 'student');
    const url = sessionId ? `/api/forms/session-responses?sessionId=${sessionId}` : '/api/forms/manual-responses';
    void jsonRequest<{ forms: FillForm[]; participants?: Person[] }>(url)
      .then((data) => {
        setForms(data.forms ?? []);
        const participants = data.participants ?? [];
        setSessionPeople(participants);
        if (lockedFormId) {
          setForm((data.forms ?? []).find((candidate) => candidate.id === lockedFormId) ?? null);
        }
        if (initialRespondentType && initialRespondentId) {
          const selected = participants.find((candidate) => candidate.type === initialRespondentType && candidate.id === initialRespondentId) ?? null;
          setPerson(selected);
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load forms.'))
      .finally(() => setLoading(false));
  }, [initialRespondentId, initialRespondentType, lockedFormId, open, sessionId]);

  useEffect(() => {
    if (!open || sessionId) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setSearching(true);
      void jsonRequest<{ people: Person[] }>(`/api/forms/respondents?type=${respondentType}&search=${encodeURIComponent(search)}`, { signal: controller.signal })
        .then((data) => setPeople(data.people ?? []))
        .catch((reason) => {
          if (reason instanceof DOMException && reason.name === 'AbortError') return;
          setError(reason instanceof Error ? reason.message : 'Could not search people.');
        })
        .finally(() => setSearching(false));
    }, 200);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, respondentType, search, sessionId]);

  const availablePeople = useMemo(() => sessionId ? sessionPeople : people, [people, sessionId, sessionPeople]);

  const changeRespondentType = (value: string) => {
    const type = value === 'parent' || value === 'staff' ? value : 'student';
    setRespondentType(type);
    setPerson(null);
    setSearch('');
    setCopiedUrl(null);
  };

  const submit = async (answers: FormAnswerPayload) => {
    if (!form || !person) throw new Error('Select a form and respondent.');
    const data = await jsonRequest<{ responseId: string }>('/api/forms/manual-responses', {
      method: 'POST',
      body: JSON.stringify({
        formId: form.id,
        respondentType,
        respondentId: person.id,
        sessionId: sessionId ?? null,
        answers,
      }),
    });
    onSaved?.(data.responseId);
    onClose();
  };

  const copyStudentLink = async () => {
    if (!sessionId || respondentType !== 'student' || !person || !form) return;
    setLinking(true);
    setError(null);
    try {
      const data = await jsonRequest<{ url: string }>('/api/forms/session-links', {
        method: 'POST',
        body: JSON.stringify({ sessionId, studentId: person.id, formId: form.id }),
      });
      await navigator.clipboard.writeText(data.url);
      setCopiedUrl(data.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create student link.');
    } finally {
      setLinking(false);
    }
  };

  const version = form?.form_versions ?? null;
  const answererFormId = sessionId ? `session-form-response-${form?.id ?? 'new'}` : undefined;

  return (
    <AdminDialogShell
      open={open}
      onClose={onClose}
      title={sessionId ? 'Add form to session' : 'Fill form'}
      subtitle={sessionId ? 'Record a response for a session participant, or copy a one-use link for a student.' : 'Record a response on behalf of a student, parent, or staff member.'}
      defaultExpanded
      contentClassName="md:max-w-5xl"
      footer={sessionId ? (
        <>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void copyStudentLink()}
            disabled={linking || respondentType !== 'student' || !person || !form}
          >
            {copiedUrl ? <Copy className="mr-2 h-4 w-4" /> : <Link2 className="mr-2 h-4 w-4" />}
            {linking ? 'Creating link...' : copiedUrl ? 'Link copied' : 'Copy student link'}
          </Button>
          <Button
            type="submit"
            form={answererFormId}
            disabled={!person || !form || !version}
          >
            Save response
          </Button>
        </>
      ) : undefined}
    >
      <div className="space-y-5">
        {!sessionId ? (
          <SegmentedControl
            value={respondentType}
            onValueChange={changeRespondentType}
            options={[
              { value: 'student', label: 'Student' },
              { value: 'parent', label: 'Parent' },
              { value: 'staff', label: 'Staff' },
            ]}
          />
        ) : null}
        <div className={`grid gap-4 ${lockedFormId ? '' : 'md:grid-cols-2'}`}>
          <SearchableSelect
            items={availablePeople}
            value={person}
            onValueChange={(value) => {
              if (!value) return;
              setPerson(value);
              setRespondentType(value.type ?? respondentType);
              setCopiedUrl(null);
            }}
            getItemId={(item) => item.type ? `${item.type}:${item.id}` : item.id}
            getItemLabel={(item) => personLabel(item, Boolean(sessionId))}
            onSearchChange={sessionId ? undefined : setSearch}
            loading={loading || searching}
            placeholder={sessionId ? 'Select session participant' : `Select ${respondentType}`}
            searchPlaceholder={sessionId ? 'Search students, parents, and staff...' : `Search ${respondentType}s...`}
            emptyMessage={sessionId ? 'No session participants found.' : `No ${respondentType}s found.`}
            contentWidth="min(420px, calc(100vw - 2rem))"
          />
          {!lockedFormId ? (
            <SearchableSelect
              items={forms}
              value={form}
              onValueChange={(value) => { setForm(value); setCopiedUrl(null); }}
              getItemId={(item) => item.id}
              getItemLabel={(item) => item.name}
              loading={loading}
              placeholder="Select form"
              searchPlaceholder="Search published forms..."
              emptyMessage="No published forms found."
              contentWidth="min(420px, calc(100vw - 2rem))"
            />
          ) : null}
        </div>
        {copiedUrl ? <p className="break-all rounded-md bg-muted/40 p-3 text-sm">{copiedUrl}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {person && form && version ? (
          <FormAnswerer
            title={form.name}
            blocks={version.blocks}
            thankYouMessage={version.thank_you_message}
            submitLabel="Save response"
            onSubmit={submit}
            className="px-0 py-2"
            formId={answererFormId}
            hideSubmitButton={Boolean(sessionId)}
          />
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">Select a respondent and any published form.</p>
        )}
      </div>
    </AdminDialogShell>
  );
}
