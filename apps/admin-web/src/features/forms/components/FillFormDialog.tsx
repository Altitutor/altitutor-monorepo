'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, FormAnswerer, SearchableSelect, SegmentedControl } from '@altitutor/ui';
import type { FormAnswerPayload } from '@altitutor/shared';
import { Copy, Link2 } from 'lucide-react';
import { AdminDialogShell } from '@/shared/components';

import {
  jsonRequest,
  getFormResponseOptions,
  type FormRespondent,
  type Person,
  type RespondentType,
} from '../api/formResponseOptions';

function personLabel(person: Person, includeType = false) {
  const label = `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || person.id;
  if (!includeType || !person.type) return label;
  return `${label} · ${person.type.charAt(0).toUpperCase()}${person.type.slice(1)}`;
}

export function FillFormDialog({
  open,
  onClose,
  sessionId,
  lockedFormId,
  purposeFilter,
  lockedRespondent,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  sessionId?: string;
  lockedFormId?: string;
  purposeFilter?: string;
  lockedRespondent?: FormRespondent;
  onSaved?: (responseId: string) => void;
}) {
  const [respondentType, setRespondentType] = useState<RespondentType>(lockedRespondent?.type ?? 'student');
  const [people, setPeople] = useState<Person[]>([]);
  const [person, setPerson] = useState<Person | null>(null);
  const [formId, setFormId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lockedRespondentType = lockedRespondent?.type;
  const lockedRespondentId = lockedRespondent?.id;
  const idempotencyKeyRef = useRef<string | null>(null);

  const [options, setOptions] = useState<Awaited<ReturnType<typeof getFormResponseOptions>> | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const loading = !options && !optionsError;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setOptions(null);
    setOptionsError(null);
    void getFormResponseOptions(sessionId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setOptions(data);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setOptionsError(reason instanceof Error ? reason.message : 'Could not load forms.');
        }
      });
    return () => controller.abort();
  }, [open, sessionId]);
  const forms = (options?.forms ?? []).filter((candidate) => !purposeFilter || candidate.purpose === purposeFilter);
  const sessionPeople = options?.participants ?? [];
  const automaticForm = purposeFilter && forms.length === 1 ? forms[0] : null;
  const form = (
    lockedFormId
      ? forms.find((candidate) => candidate.id === lockedFormId)
      : automaticForm ?? forms.find((candidate) => candidate.id === formId)
  ) ?? null;
  const respondent = lockedRespondent ?? (person ? { type: respondentType, id: person.id } : null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFormId(null);
    setPerson(null);
    setCopiedUrl(null);
    setSubmitting(false);
    idempotencyKeyRef.current = null;
    setRespondentType(lockedRespondentType ?? 'student');
  }, [lockedRespondentId, lockedRespondentType, lockedFormId, open, purposeFilter, sessionId]);

  useEffect(() => {
    if (!open || sessionId || lockedRespondentId) return;
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
  }, [lockedRespondentId, open, respondentType, search, sessionId]);

  const availablePeople = sessionId ? sessionPeople : people;

  const changeRespondentType = (value: string) => {
    const type = value === 'parent' || value === 'staff' ? value : 'student';
    setRespondentType(type);
    setPerson(null);
    setSearch('');
    setCopiedUrl(null);
  };

  const submit = async (answers: FormAnswerPayload) => {
    if (!form || !respondent) throw new Error('Select a form and respondent.');
    const idempotencyKey = idempotencyKeyRef.current ?? crypto.randomUUID();
    idempotencyKeyRef.current = idempotencyKey;
    const data = await jsonRequest<{ responseId: string }>('/api/forms/manual-responses', {
      method: 'POST',
      body: JSON.stringify({
        formId: form.id,
        respondentType: respondent.type,
        respondentId: respondent.id,
        sessionId: sessionId ?? null,
        idempotencyKey,
        answers,
      }),
    });
    idempotencyKeyRef.current = null;
    onSaved?.(data.responseId);
    onClose();
  };

  const copyStudentLink = async () => {
    if (!sessionId || respondent?.type !== 'student' || !form) return;
    setLinking(true);
    setError(null);
    try {
      const data = await jsonRequest<{ url: string }>('/api/forms/session-links', {
        method: 'POST',
        body: JSON.stringify({ sessionId, studentId: respondent.id, formId: form.id }),
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
  const showFormPicker = !lockedFormId && !automaticForm;
  const loadError = optionsError ?? (
    options && !forms.length ? 'No published forms found.' :
      options && lockedFormId && !form ? 'This form is no longer available.' : null
  );
  const answererFormId = sessionId ? `session-form-response-${form?.id ?? 'new'}` : undefined;

  return (
    <AdminDialogShell
        fillHeight
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
            disabled={linking || respondent?.type !== 'student' || !form}
          >
            {copiedUrl ? <Copy className="mr-2 h-4 w-4" /> : <Link2 className="mr-2 h-4 w-4" />}
            {linking ? 'Creating link...' : copiedUrl ? 'Link copied' : 'Copy student link'}
          </Button>
          <Button
            type="submit"
            form={answererFormId}
            disabled={!respondent || !form || !version || submitting}
          >
            {submitting ? 'Saving...' : 'Save response'}
          </Button>
        </>
      ) : undefined}
    >
      <div className="space-y-5">
        {!sessionId && !lockedRespondent ? (
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
        <div className={`grid gap-4 ${!lockedRespondent && showFormPicker ? 'md:grid-cols-2' : ''}`}>
          {!lockedRespondent && (
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
          )}
          {showFormPicker ? (
            <SearchableSelect
              items={forms}
              value={form}
              onValueChange={(value) => { setFormId(value?.id ?? null); setCopiedUrl(null); }}
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
        {lockedRespondent?.name && <p className="text-sm text-muted-foreground">Respondent: {lockedRespondent.name}</p>}
        {(error || loadError) && <p role="alert" className="text-sm text-destructive">{error || loadError}</p>}
        {respondent && form && version ? (
          <FormAnswerer
            title={form.name}
            blocks={version.blocks}
            thankYouMessage={version.thank_you_message}
            submitLabel="Save response"
            onSubmit={submit}
            onSubmittingChange={setSubmitting}
            className="px-0 py-2"
            formId={answererFormId}
            hideSubmitButton={Boolean(sessionId)}
          />
        ) : !loadError && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {loading ? 'Loading forms…' : lockedRespondent ? 'Select a published form.' : 'Select a respondent and any published form.'}
          </p>
        )}
      </div>
    </AdminDialogShell>
  );
}
