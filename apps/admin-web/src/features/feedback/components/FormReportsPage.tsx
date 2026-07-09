'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AdminFormRow } from '@/features/forms/types';

type AnswerRow = {
  question_id: string;
  question_label_snapshot: string;
  question_type: string;
  choice_value: string | null;
  choice_label_snapshot: string | null;
  choice_values: Array<{ value: string; label: string }> | null;
  text_value: string | null;
  number_value: number | null;
};

export function FormReportsPage() {
  const [forms, setForms] = useState<AdminFormRow[]>([]);
  const [formId, setFormId] = useState<string>('');
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [responseCount, setResponseCount] = useState(0);
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
    setResponseCount(json.report?.responseCount ?? 0);
  };

  useEffect(() => {
    void loadReport();
  }, [formId]);

  const groups = useMemo(() => {
    const byQuestion = new Map<string, AnswerRow[]>();
    for (const answer of answers) {
      byQuestion.set(answer.question_id, [...(byQuestion.get(answer.question_id) ?? []), answer]);
    }
    return [...byQuestion.entries()].map(([questionId, rows]) => ({ questionId, rows, label: rows[0]?.question_label_snapshot ?? questionId, type: rows[0]?.question_type ?? 'unknown' }));
  }, [answers]);

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-80 max-w-full">
          <Select value={formId} onValueChange={setFormId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a form" />
            </SelectTrigger>
            <SelectContent>
              {forms.map((form) => (
                <SelectItem key={form.id} value={form.id}>
                  {form.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={loadReport}>Refresh</Button>
        <div className="text-sm text-muted-foreground">{responseCount} responses</div>
      </div>

      <div className="space-y-6">
        {groups.map((group) => (
          <QuestionReport key={group.questionId} label={group.label} type={group.type} rows={group.rows} />
        ))}
        {groups.length === 0 ? (
          <div className="rounded-md border p-8 text-center text-muted-foreground">
            No reportable answers found.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function QuestionReport({ label, type, rows }: { label: string; type: string; rows: AnswerRow[] }) {
  if (type === 'single_choice' || type === 'multi_select') {
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (type === 'single_choice') {
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
      <div className="rounded-md border p-4">
        <h3 className="font-semibold">{label}</h3>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (type === 'number') {
    const values = rows.map((row) => Number(row.number_value)).filter(Number.isFinite);
    const avg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    return (
      <div className="rounded-md border p-4">
        <h3 className="font-semibold">{label}</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Stat label="Count" value={values.length} />
          <Stat label="Average" value={avg.toFixed(2)} />
          <Stat label="Min" value={values.length ? Math.min(...values) : '-'} />
          <Stat label="Max" value={values.length ? Math.max(...values) : '-'} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border p-4">
      <h3 className="font-semibold">{label}</h3>
      <div className="mt-4 space-y-2">
        {rows.slice(0, 20).map((row, index) => (
          <div key={index} className="rounded-md bg-muted/40 p-3 text-sm">
            {row.text_value}
          </div>
        ))}
      </div>
    </div>
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
