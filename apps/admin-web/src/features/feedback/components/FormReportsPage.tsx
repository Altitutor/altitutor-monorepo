'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  DataTableToolbar,
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
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  DataTableFilterDefinition,
  DataTableState,
} from '@altitutor/shared';
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
  reporting_question_id: string;
};

type ChartMode = 'bar' | 'pie';

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 220 70% 50%))',
  'hsl(var(--chart-3, 160 60% 45%))',
  'hsl(var(--chart-4, 30 80% 55%))',
  'hsl(var(--chart-5, 280 65% 60%))',
];

const REPORT_FILTER_STATE: DataTableState = {
  search: '',
  filters: {},
  sortBy: null,
  sortDirection: 'asc',
  groupBy: null,
  page: 1,
  pageSize: 50,
  visibleColumns: [],
};

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
  const [filterState, setFilterState] = useState<DataTableState>(REPORT_FILTER_STATE);
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

  const loadReport = useCallback(async () => {
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
  }, [formId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

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

  const recordedByOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const response of responses) {
      if (response.recorded_by_staff) {
        map.set(response.recorded_by_staff.id, `${response.recorded_by_staff.first_name ?? ''} ${response.recorded_by_staff.last_name ?? ''}`.trim());
      }
    }
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [responses]);

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(
    () => [
      {
        key: 'respondent_type',
        label: 'Respondent type',
        options: respondentTypeOptions,
      },
      {
        key: 'respondent',
        label: 'Respondent',
        options: respondentOptions,
        searchable: true,
      },
      {
        key: 'recorded_by',
        label: 'Recorded by',
        options: recordedByOptions,
        searchable: true,
      },
      {
        key: 'session_linked',
        label: 'Check-in session',
        options: [
          { value: 'linked', label: 'Linked' },
          { value: 'unlinked', label: 'Not linked' },
        ],
      },
    ],
    [recordedByOptions, respondentOptions, respondentTypeOptions],
  );

  const filteredAnswers = useMemo(
    () =>
      answers.filter((answer) => {
        const response = answer.response;
        const filters = filterState.filters;
        const query = filterState.search.trim().toLowerCase();
        if (filters.respondent_type?.length && !filters.respondent_type.includes(response.respondent_type)) return false;
        if (filters.respondent?.length && !filters.respondent.includes(personKey(response, 'respondent'))) return false;
        if (filters.recorded_by?.length && !filters.recorded_by.includes(response.recorded_by_staff?.id ?? '')) return false;
        if (filters.session_linked?.length) {
          const linkage = response.session_id ? 'linked' : 'unlinked';
          if (!filters.session_linked.includes(linkage)) return false;
        }
        if (query) {
          const haystack = [
            answer.question_label_snapshot,
            answerValue(answer),
            responsePersonLabel(response, 'respondent'),
            responsePersonLabel(response, 'subject'),
            response.recorded_by_staff ? `${response.recorded_by_staff.first_name ?? ''} ${response.recorded_by_staff.last_name ?? ''}` : '',
            response.sessions?.long_name,
            response.sessions?.short_name,
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      }),
    [answers, filterState.filters, filterState.search],
  );

  const groups = useMemo(() => {
    const byQuestion = new Map<string, AnswerRow[]>();
    for (const answer of filteredAnswers) {
      byQuestion.set(answer.reporting_question_id, [...(byQuestion.get(answer.reporting_question_id) ?? []), answer]);
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
              setFilterState(REPORT_FILTER_STATE);
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
        <div className="text-sm text-muted-foreground">All published versions · {responseCount} responses</div>
      </div>
      <DataTableToolbar
        state={filterState}
        onSearchChange={(search) => setFilterState((current) => ({ ...current, search, page: 1 }))}
        onFiltersChange={(filters) => setFilterState((current) => ({ ...current, filters, page: 1 }))}
        onSortChange={(sortBy, sortDirection) => setFilterState((current) => ({ ...current, sortBy, sortDirection, page: 1 }))}
        onGroupByChange={(groupBy) => setFilterState((current) => ({ ...current, groupBy }))}
        onVisibleColumnsChange={(visibleColumns) => setFilterState((current) => ({ ...current, visibleColumns }))}
        onQuickFilterApply={() => undefined}
        onReset={() => setFilterState(REPORT_FILTER_STATE)}
        filterDefinitions={filterDefinitions}
        sortOptions={[]}
        columnDefinitions={[]}
      />

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
        <h3 className="font-semibold">{group.label}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            value={mode}
            onValueChange={(value) => setMode(value === 'pie' ? 'pie' : 'bar')}
            options={[
              { value: 'bar', label: 'Bar' },
              { value: 'pie', label: 'Pie' },
            ]}
          />
          <Button type="button" variant="outline" size="sm" onClick={onViewQuestion}>
            View question
          </Button>
        </div>
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
              <Legend />
              <Pie
                data={data}
                dataKey="count"
                nameKey="name"
                outerRadius={88}
                label={(entry) => `${entry.name}: ${entry.value}`}
              >
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
