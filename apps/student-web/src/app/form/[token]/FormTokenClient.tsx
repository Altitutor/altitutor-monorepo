'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormAnswerer, SearchableSelect, Spinner } from '@altitutor/ui';
import type { FormAnswerPayload, FormBlock } from '@altitutor/shared';

type ExitSession = { id: string; class_id: string; start_at: string };

function formatSessionLabel(session: ExitSession): string {
  const when = new Date(session.start_at).toLocaleString('en-AU', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Australia/Adelaide',
  });
  const pastSuffix = new Date(session.start_at).getTime() <= Date.now() ? ' (Most recent past)' : '';
  return `${when}${pastSuffix}`;
}

export function FormTokenClient({ token }: { token: string }) {
  const router = useRouter();
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
    sessions: ExitSession[];
  } | null>(null);
  const [finalSessions, setFinalSessions] = useState<Record<string, string>>({});
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/forms/token/${token}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (res.status === 401) {
          const message = json.error ?? 'Sign in to answer this form';
          router.replace(`/login?message=${encodeURIComponent(message)}&next=${encodeURIComponent(`/form/${token}`)}`);
          return null;
        }
        if (!res.ok) throw new Error(json.error ?? 'Could not load form');
        return json;
      })
      .then((json) => {
        if (!json) return;
        setForm(json.form);
        setExitRequest(json.exitRequest ?? null);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Could not load form');
      });
    return () => controller.abort();
  }, [router, token]);

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
      {!completionMessage && exitRequest && exitRequest.enrolments.length > 0 ? (
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
            const selectedSessionId = finalSessions[enrolment.id] ?? '';
            const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? null;
            return (
              <div
                key={enrolment.id}
                className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <span className="shrink-0 text-sm font-medium sm:max-w-[40%]">{className}</span>
                <div className="min-w-0 flex-1 sm:max-w-[60%]">
                  <SearchableSelect<ExitSession>
                    items={sessions}
                    value={selectedSession}
                    onValueChange={(session) => {
                      setFinalSessions((current) => {
                        if (!session) {
                          const next = { ...current };
                          delete next[enrolment.id];
                          return next;
                        }
                        return { ...current, [enrolment.id]: session.id };
                      });
                    }}
                    getItemId={(session) => session.id}
                    getItemLabel={formatSessionLabel}
                    placeholder="Select final session"
                    searchPlaceholder="Search sessions..."
                    emptyMessage="No sessions available."
                    contentWidth="min(420px, calc(100vw - 2rem))"
                    trigger={
                      <Button type="button" variant="outline" className="w-full justify-start font-normal">
                        <span className="truncate">
                          {selectedSession ? formatSessionLabel(selectedSession) : 'Select final session'}
                        </span>
                      </Button>
                    }
                  />
                </div>
              </div>
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
        onSubmitted={() => window.dispatchEvent(new Event('altitutor:form-submitted'))}
      />
    </div>
  );
}
