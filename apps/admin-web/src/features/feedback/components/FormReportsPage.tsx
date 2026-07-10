'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  SearchableSelect,
  SegmentedControl,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format } from 'date-fns';
import { AdminDialogShell } from '@/shared/components';
import type { AdminFormRow } from '@/features/forms/types';
import {
  FormResponseDialog,
  type FormResponseAnswer,
  type FormResponseDetail,
  responsePersonLabel,
} from './FormResponseDialog';

type AnswerRow = FormResponseAnswer & {
  response: FormResponseDetail;
};

type ChartMode = 'bar' | 'pie';

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 220 70% 50%))',
  'hsl(var(--chart-3, 160 60% 45%))',
  'hsl(var(--chart-4, 30 80% 55%))',
  'hsl(var(--chart-5, 280 65% 60%))',
];

function personKey(response: FormResponseDetail, kind: 'respondent' | 'subject') {
  const person =
    kind === 'respondent'
      ? response.respondent_student ?? response.respondent_staff ?? response.respondent_parent
      : response.subject_student ?? response.subject_staff ?? response.subject_parent;
  return person?.id ?? (kind === 'respondent' ? response.respondent_type : response.subject_type);
}

function answerValue(answer: AnswerRow | FormResponseAnswer) {
  if (answer.question_type === 'single_choice') return answer.choice_label_snapshot ?? answer.choice_value ?? '-';
  if (answer.question_type === 'multi_select') return answer.choice_values?.map((choice) => choice.label).join(', ') || '-';
  if (answer.question_type === 'number') return answer.number_value ?? '-';
  return answer.text_value || '-';
}

export function FormReportsPage() {
  const [forms, setForms] = useState<AdminFormRow[]>([]);
  const [formId, setFormId] = useState<string>('');
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [responses, setResponses] = useState<FormResponseDetail[]>([]);
  const [responseCount, setResponseCount] = useState(0);
  const [respondentType, setRespondentType] = useState<string>('');
  const [respondentId, setRespondentId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionGroup | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<FormResponseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/forms')
      .then((res) => res.json())
      .then((json) => {
        setForms(json.forms ?? []);
        if (json.forms?.[0]) setFormId(json.forms[0].id);
      })
      .catch((err) => setError(err.message));
  }, []);

  const loadReport = async () => {
    if (!formId) return;
    setError(null);
    const res = await fetch(`/api/forms/reports?formId=${formId}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'Failed to load report');
      return;
    }
    setAnswers(json.report?.answers ?? []);
    setResponses(json.report?.responses ?? []);
    setResponseCount(json.report?.responseCount ?? 0);
    setSelectedQuestion(null);
    setSelectedResponse(null);
  };

  useEffect(() => {
    void loadReport();
  }, [formId]);

  const selectedForm = forms.find((form) => form.id === formId) ?? null;

  const respondentTypeOptions = useMemo(
    () => [...new Set(responses.map((response) => response.respondent_type))].map((value) => ({ value, label: value })),
    [responses],
  );

  const respondentOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const response of responses) map.set(personKey(response, 'respondent'), responsePersonLabel(response, 'respondent'));
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [responses]);

  const subjectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const response of responses) map.set(personKey(response, 'subject'), responsePersonLabel(response, 'subject'));
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [responses]);

  const filteredAnswers = useMemo(
    () =>
      answers.filter((answer) => {
        const response = answer.response;
        if (respondentType && response.respondent_type !== respondentType) return false;
        if (respondentId && personKey(response, 'respondent') !== respondentId) return false;
        if (subjectId && personKey(response, 'subject') !== subjectId) return false;
        return true;
      }),
    [answers, respondentId, respondentType, subjectId],
  );

  const groups = useMemo(() => {
    const byQuestion = new Map<string, AnswerRow[]>();
    for (const answer of filteredAnswers) {
      byQuestion.set(answer.question_id, [...(byQuestion.get(answer.question_id) ?? []), answer]);
    }
    return [...byQuestion.entries()].map(([questionId, rows]) => ({
      questionId,
      rows,
      label: rows[0]?.question_label_snapshot ?? questionId,
      type: rows[0]?.question_type ?? 'unknown',
    }));
  }, [filteredAnswers]);

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-80 max-w-full">
          <SearchableSelect<AdminFormRow>
            items={forms}
            value={selectedForm}
            onValueChange={(form) => {
              setFormId(form?.id ?? '');
              setRespondentType('');
              setRespondentId('');
              setSubjectId('');
            }}
            getItemId={(form) => form.id}
            getItemLabel={(form) => form.name}
            placeholder="Select a form"
            searchPlaceholder="Search forms..."
            trigger={
              <Button type="button" variant="outline" className="w-full justify-start font-normal">
                {selectedForm?.name ?? 'Select a form'}
              </Button>
            }
          />
        </div>
        <FilterSelect
          label="Respondent type"
          value={respondentType}
          options={respondentTypeOptions}
          onValueChange={setRespondentType}
        />
        <FilterSelect
          label="Respondent"
          value={respondentId}
          options={respondentOptions}
          onValueChange={setRespondentId}
        />
        <FilterSelect label="Subject" value={subjectId} options={subjectOptions} onValueChange={setSubjectId} />
        <Button variant="outline" onClick={loadReport}>Refresh</Button>
        <div className="text-sm text-muted-foreground">{filteredAnswers.length ? `${responseCount} responses` : `${responseCount} responses`}</div>
      </div>

      <div className="space-y-8">
        {groups.map((group) => (
          <QuestionReport
            key={group.questionId}
            group={group}
            onViewQuestion={() => setSelectedQuestion(group)}
          />
        ))}
        {groups.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No reportable answers found.
          </div>
        ) : null}
      </div>

      <QuestionAnswersDialog
        group={selectedQuestion}
        onClose={() => setSelectedQuestion(null)}
        onOpenResponse={(response) => setSelectedResponse(response)}
      />
      <FormResponseDialog response={selectedResponse} onClose={() => setSelectedResponse(null)} />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onValueChange: (value: string) => void;
}) {
  const selected = options.find((option) => option.value === value) ?? null;
  return (
    <div className="w-56 max-w-full">
      <SearchableSelect<{ value: string; label: string }>
        items={options}
        value={selected}
        onValueChange={(option) => onValueChange(option?.value ?? '')}
        getItemId={(option) => option.value}
        getItemLabel={(option) => option.label}
        allowClear
        clearLabel={`All ${label.toLowerCase()}`}
        placeholder={label}
        searchPlaceholder={`Search ${label.toLowerCase()}...`}
        trigger={
          <Button type="button" variant="outline" className="w-full justify-start font-normal">
            {selected?.label ?? label}
          </Button>
        }
      />
    </div>
  );
}

type QuestionGroup = {
  questionId: string;
  rows: AnswerRow[];
  label: string;
  type: string;
};

function QuestionReport({ group, onViewQuestion }: { group: QuestionGroup; onViewQuestion: () => void }) {
  if (group.type === 'single_choice' || group.type === 'multi_select') {
    return <ChoiceQuestionReport group={group} onViewQuestion={onViewQuestion} />;
  }

  if (group.type === 'number') {
    const values = group.rows.map((row) => Number(row.number_value)).filter(Number.isFinite);
    const avg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    return (
      <section className="space-y-4">
        <ReportHeader label={group.label} onViewQuestion={onViewQuestion} />
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Count" value={values.length} />
          <Stat label="Average" value={avg.toFixed(2)} />
          <Stat label="Min" value={values.length ? Math.min(...values) : '-'} />
          <Stat label="Max" value={values.length ? Math.max(...values) : '-'} />
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <ReportHeader label={group.label} onViewQuestion={onViewQuestion} />
      <div className="space-y-2">
        {group.rows.slice(0, 20).map((row) => (
          <div key={row.id ?? `${row.response.id}-${row.question_id}`} className="rounded-md bg-muted/40 p-3 text-sm">
            {row.text_value}
          </div>
        ))}
      </div>
    </section>
  );
}

function ChoiceQuestionReport({ group, onViewQuestion }: { group: QuestionGroup; onViewQuestion: () => void }) {
  const [mode, setMode] = useState<ChartMode>('bar');
  const counts = new Map<string, number>();
  for (const row of group.rows) {
    if (group.type === 'single_choice') {
      const label = row.choice_label_snapshot ?? row.choice_value ?? 'Blank';
      counts.set(label, (counts.get(label) ?? 0) + 1);
    } else {
      for (const choice of row.choice_values ?? []) {
        counts.set(choice.label, (counts.get(choice.label) ?? 0) + 1);
      }
    }
  }
  const data = [...counts.entries()].map(([name, count]) => ({ name, count }));
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ReportHeader label={group.label} onViewQuestion={onViewQuestion} />
        <SegmentedControl
          value={mode}
          onValueChange={(value) => setMode(value === 'pie' ? 'pie' : 'bar')}
          options={[
            { value: 'bar', label: 'Bar' },
            { value: 'pie', label: 'Pie' },
          ]}
        />
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {mode === 'bar' ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" />
            </BarChart>
          ) : (
            <PieChart>
              <Tooltip />
              <Pie data={data} dataKey="count" nameKey="name" outerRadius={95} label>
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function ReportHeader({ label, onViewQuestion }: { label: string; onViewQuestion: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-semibold">{label}</h3>
      <Button type="button" variant="outline" size="sm" onClick={onViewQuestion}>
        View question
      </Button>
    </div>
  );
}

function QuestionAnswersDialog({
  group,
  onClose,
  onOpenResponse,
}: {
  group: QuestionGroup | null;
  onClose: () => void;
  onOpenResponse: (response: FormResponseDetail) => void;
}) {
  return (
    <AdminDialogShell
      open={!!group}
      onClose={onClose}
      title={group?.label ?? 'Question answers'}
      subtitle="Answers for this question only."
      contentClassName="md:max-w-5xl"
    >
      {group ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Respondent</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Answer</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.rows.map((row) => (
                <TableRow
                  key={row.id ?? `${row.response.id}-${row.question_id}`}
                  className="cursor-pointer"
                  onClick={() => onOpenResponse(row.response)}
                >
                  <TableCell>{responsePersonLabel(row.response, 'respondent')}</TableCell>
                  <TableCell>{responsePersonLabel(row.response, 'subject')}</TableCell>
                  <TableCell>{answerValue(row)}</TableCell>
                  <TableCell>{format(new Date(row.response.submitted_at), 'PP p')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </AdminDialogShell>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
