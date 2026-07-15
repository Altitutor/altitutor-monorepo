'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Badge, Button, FormAnswerer } from '@altitutor/ui';
import type { FormAnswerPayload, FormBlock } from '@altitutor/shared';
import { AdminDialogShell } from '@/shared/components';

type Person = { id: string; first_name?: string | null; last_name?: string | null } | null | undefined;

export type FormResponseAnswer = {
  id?: string;
  question_id: string;
  question_label_snapshot: string;
  question_type: string;
  choice_value: string | null;
  choice_label_snapshot: string | null;
  choice_values: Array<{ value: string; label: string }> | null;
  text_value: string | null;
  number_value: number | null;
};

export type FormResponseDetail = {
  id: string;
  respondent_type: string;
  subject_type: string;
  submitted_at: string;
  session_id?: string | null;
  forms?: { id?: string; name?: string | null; purpose?: string | null } | null;
  form_versions?: { id?: string; version_number?: number | null; blocks?: FormBlock[] } | null;
  response_json?: { answers?: FormAnswerPayload } | null;
  respondent_student?: Person;
  respondent_staff?: Person;
  respondent_parent?: Person;
  recorded_by_staff?: Person;
  sessions?: { id: string; start_at?: string | null; short_name?: string | null; long_name?: string | null } | null;
  subject_student?: Person;
  subject_staff?: Person;
  subject_parent?: Person;
  form_response_answers?: FormResponseAnswer[];
};

export function personName(person: Person): string | null {
  if (!person) return null;
  return `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || person.id;
}

export function responsePersonLabel(response: FormResponseDetail, kind: 'respondent' | 'subject') {
  const type = kind === 'respondent' ? response.respondent_type : response.subject_type;
  const person =
    kind === 'respondent'
      ? response.respondent_student ?? response.respondent_staff ?? response.respondent_parent
      : response.subject_student ?? response.subject_staff ?? response.subject_parent;
  const name = personName(person);
  return name ? `${name} (${type})` : type;
}

function answerValue(answer: FormResponseAnswer) {
  if (answer.question_type === 'single_choice') {
    return answer.choice_label_snapshot ?? answer.choice_value ?? '-';
  }
  if (answer.question_type === 'multi_select') {
    return answer.choice_values?.map((choice) => choice.label).join(', ') || '-';
  }
  if (answer.question_type === 'number') {
    return answer.number_value ?? '-';
  }
  return answer.text_value || '-';
}

function AnswerDisplay({ answer }: { answer: FormResponseAnswer }) {
  if (answer.question_type === 'single_choice') {
    const value = answer.choice_label_snapshot ?? answer.choice_value;
    return value ? <Badge variant="secondary">{value}</Badge> : <span className="text-muted-foreground">-</span>;
  }

  if (answer.question_type === 'multi_select') {
    const values = answer.choice_values ?? [];
    if (!values.length) return <span className="text-muted-foreground">-</span>;
    return (
      <div className="flex flex-wrap gap-2">
        {values.map((choice) => (
          <Badge key={choice.value} variant="secondary">
            {choice.label}
          </Badge>
        ))}
      </div>
    );
  }

  return <span className="whitespace-pre-wrap">{answerValue(answer)}</span>;
}

export function FormResponseDialog({
  response,
  onClose,
  onUpdated,
}: {
  response: FormResponseDetail | null;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  useEffect(() => setEditing(false), [response?.id]);

  const formId = response ? `edit-form-response-${response.id}` : undefined;
  const canEdit = Boolean(response?.form_versions?.blocks);
  const save = async (answers: FormAnswerPayload) => {
    if (!response) return;
    const result = await fetch('/api/forms/responses', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responseId: response.id, answers }),
    });
    const json = await result.json().catch(() => ({}));
    if (!result.ok) throw new Error(json.error ?? 'Could not update this response.');
    onUpdated?.();
    onClose();
  };

  return (
    <AdminDialogShell
      open={!!response}
      onClose={onClose}
      title={response?.forms?.name ?? 'Form response'}
      subtitle={response ? `${responsePersonLabel(response, 'respondent')} · ${format(new Date(response.submitted_at), 'PP p')}` : undefined}
      contentClassName="md:max-w-4xl"
      footer={response ? (
        editing ? (
          <>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button type="submit" form={formId}>Save changes</Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onClose}>Close</Button>
            {canEdit ? <Button type="button" onClick={() => setEditing(true)}>Edit response</Button> : null}
          </>
        )
      ) : undefined}
    >
      {response ? (
        editing && response.form_versions?.blocks ? (
          <FormAnswerer
            title={response.forms?.name ?? 'Form response'}
            blocks={response.form_versions.blocks}
            initialAnswers={response.response_json?.answers ?? {}}
            submitLabel="Save changes"
            onSubmit={save}
            formId={formId}
            hideSubmitButton
            className="px-0 py-2"
          />
        ) : (
        <div className="space-y-6">
          <div className="grid gap-3 text-sm sm:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">Respondent</div>
              <div className="font-medium">{responsePersonLabel(response, 'respondent')}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Subject</div>
              <div className="font-medium">{responsePersonLabel(response, 'subject')}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Submitted</div>
              <div className="font-medium">{format(new Date(response.submitted_at), 'PP p')}</div>
            </div>
            {response.recorded_by_staff ? <div><div className="text-xs text-muted-foreground">Recorded by</div><div className="font-medium">{personName(response.recorded_by_staff)}</div></div> : null}
            {response.session_id ? (
              <div>
                <div className="text-xs text-muted-foreground">Check-in session</div>
                <div className="font-medium">
                  {response.sessions?.long_name ?? response.sessions?.short_name ?? (response.sessions?.start_at ? format(new Date(response.sessions.start_at), 'PP p') : 'Linked session')}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            {(response.form_response_answers ?? []).map((answer) => (
              <div key={answer.id ?? answer.question_id} className="space-y-1">
                <div className="text-sm font-medium">{answer.question_label_snapshot}</div>
                <div className="rounded-md bg-muted/40 p-3 text-sm">
                  <AnswerDisplay answer={answer} />
                </div>
              </div>
            ))}
          </div>
        </div>
        )
      ) : null}
    </AdminDialogShell>
  );
}
