'use client';

import { format } from 'date-fns';
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
  forms?: { id?: string; name?: string | null; purpose?: string | null } | null;
  form_versions?: { id?: string; version_number?: number | null } | null;
  respondent_student?: Person;
  respondent_staff?: Person;
  respondent_parent?: Person;
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

export function FormResponseDialog({
  response,
  onClose,
}: {
  response: FormResponseDetail | null;
  onClose: () => void;
}) {
  return (
    <AdminDialogShell
      open={!!response}
      onClose={onClose}
      title={response?.forms?.name ?? 'Form response'}
      subtitle={response ? `${responsePersonLabel(response, 'respondent')} · ${format(new Date(response.submitted_at), 'PP p')}` : undefined}
      contentClassName="md:max-w-4xl"
    >
      {response ? (
        <div className="space-y-6">
          <div className="grid gap-3 text-sm sm:grid-cols-3">
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
          </div>

          <div className="space-y-4">
            {(response.form_response_answers ?? []).map((answer) => (
              <div key={answer.id ?? answer.question_id} className="space-y-1">
                <div className="text-sm font-medium">{answer.question_label_snapshot}</div>
                <div className="rounded-md bg-muted/40 p-3 text-sm whitespace-pre-wrap">{answerValue(answer)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </AdminDialogShell>
  );
}
