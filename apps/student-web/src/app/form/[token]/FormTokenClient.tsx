'use client';

import { useEffect, useState } from 'react';
import { FormAnswerer, Spinner } from '@altitutor/ui';
import type { FormAnswerPayload, FormBlock } from '@altitutor/shared';

export function FormTokenClient({ token }: { token: string }) {
  const [form, setForm] = useState<{
    name: string;
    blocks: FormBlock[];
    thankYouMessage: string;
  } | null>(null);
  const [exitRequest, setExitRequest] = useState<{
    workflowKey: string;
    enrolments: Array<{
      id: string;
      classes_students: { class_id: string; classes: { short_name: string | null; long_name: string | null } | null } | null;
    }>;
    sessions: Array<{ id: string; class_id: string; start_at: string }>;
  } | null>(null);
  const [finalSessions, setFinalSessions] = useState<Record<string, string>>({});
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/forms/token/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Could not load form');
        setForm(json.form);
        setExitRequest(json.exitRequest ?? null);
      })
      .catch((err) => setError(err.message));
  }, [token]);

  const submit = async (answers: FormAnswerPayload) => {
    const res = await fetch(`/api/forms/token/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers,
        exitSelections: exitRequest
          ? exitRequest.enrolments.map((enrolment) => ({
              requestEnrolmentId: enrolment.id,
              sessionId: finalSessions[enrolment.id],
            }))
          : undefined,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? 'Could not submit form');
    if (exitRequest?.workflowKey === 'student_discontinuation') {
      setCompletionMessage(json.scheduled
        ? 'Thanks for sharing your feedback. Your class unenrolments and discontinuation have been scheduled after your selected final sessions.'
        : 'Thanks for sharing your feedback. Your class unenrolments and discontinuation have been processed.');
    } else if (exitRequest?.workflowKey === 'student_unenrolment') {
      setCompletionMessage(json.scheduled
        ? 'Thanks for sharing your feedback. Your class unenrolment has been scheduled after your selected final session.'
        : 'Thanks for sharing your feedback. Your class unenrolment has been processed.');
    }
  };

  if (error) {
    return <div className="mx-auto max-w-2xl px-4 py-10 text-destructive">{error}</div>;
  }
  if (!form) {
    return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>;
  }
  return (
    <div>
      {exitRequest && exitRequest.enrolments.length > 0 ? (
        <div className="mx-auto max-w-2xl space-y-4 px-4 pt-8">
          <div>
            <h2 className="text-lg font-semibold">Choose your final {exitRequest.enrolments.length === 1 ? 'session' : 'sessions'}</h2>
            <p className="text-sm text-muted-foreground">
              {exitRequest.workflowKey === 'student_discontinuation'
                ? 'Choose the final session for every active class. You will be unenrolled from all of them before your student account is discontinued.'
                : 'Your class enrolment will end after the session you choose.'}
            </p>
          </div>
          {exitRequest.enrolments.map((enrolment) => {
            const sessions = exitRequest.sessions.filter((session) => session.class_id === enrolment.classes_students?.class_id);
            const className = enrolment.classes_students?.classes?.long_name
              ?? enrolment.classes_students?.classes?.short_name
              ?? 'Class';
            return (
              <label key={enrolment.id} className="block space-y-2 rounded-lg border p-4">
                <span className="block text-sm font-medium">{className}</span>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={finalSessions[enrolment.id] ?? ''}
                  onChange={(event) => setFinalSessions((current) => ({ ...current, [enrolment.id]: event.target.value }))}
                  required
                >
                  <option value="">Select final session</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.start_at}>
                      {new Date(session.start_at).toLocaleString('en-AU', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Australia/Adelaide' })}
                      {new Date(session.start_at).getTime() <= Date.now() ? ' (Most recent past)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      ) : null}
      <FormAnswerer
        title={form.name}
        blocks={form.blocks}
        thankYouMessage={completionMessage ?? form.thankYouMessage}
        onSubmit={async (answers) => {
          if (exitRequest && exitRequest.enrolments.some((enrolment) => !finalSessions[enrolment.id])) {
            throw new Error('Choose the final session for every class before submitting.');
          }
          await submit(answers);
        }}
      />
    </div>
  );
}
