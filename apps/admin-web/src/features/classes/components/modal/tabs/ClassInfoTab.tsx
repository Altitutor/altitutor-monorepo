'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { Badge, Button, ClassStatusBadge, Input, Label, SearchableSelect, SmartDatePickerField } from '@altitutor/ui';
import { getSubjectColorStyle } from '@/shared/utils';
import { formatTime, getDayOfWeek } from '@/shared/utils/datetime';
import { useApplyClassSchedule, useClassSchedule, usePreviewClassSchedule } from '../../../hooks/useClassesQuery';
import type { ClassSchedulePlan, ClassScheduleProposal, ClassScheduleRow } from '../../../types/schedule';
import { buildClassScheduleProposal, resolveClassScheduleRows, validateClassScheduleRows } from '../../../utils/classScheduleForm';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((label, value) => ({ label, value }));
const FREQUENCIES = [{ label: 'Every week', value: 1 as const }, { label: 'Every fortnight', value: 2 as const }];
const STATUSES = [{ label: 'Active', value: 'ACTIVE' as const }, { label: 'Inactive', value: 'INACTIVE' as const }];

interface ClassInfoTabProps {
  classData: Tables<'classes'>;
  subject?: Tables<'subjects'> | null;
  subjects: Tables<'subjects'>[];
  isEditing: boolean;
  isLoading: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void;
}

function todayInAdelaide(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Adelaide', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function ClassInfoTab({ classData, subject, subjects, isEditing, isLoading, onEdit, onCancelEdit, onSaved }: ClassInfoTabProps) {
  const { data: storedSchedule, isLoading: isScheduleLoading } = useClassSchedule(classData.id, isEditing);
  const previewMutation = usePreviewClassSchedule();
  const applyMutation = useApplyClassSchedule();
  const [level, setLevel] = useState('');
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [rows, setRows] = useState<ClassScheduleRow[]>([]);
  const [frequencyWeeks, setFrequencyWeeks] = useState<1 | 2>(1);
  const [classStatus, setClassStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [effectiveFrom, setEffectiveFrom] = useState(todayInAdelaide());
  const [endDate, setEndDate] = useState(classData.session_end_date);
  const [proposal, setProposal] = useState<ClassScheduleProposal | null>(null);
  const [plan, setPlan] = useState<ClassSchedulePlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing || storedSchedule === undefined) return;
    setLevel(classData.cohort_label ?? classData.level ?? '');
    setSubjectId(classData.subject_id);
    setRows(resolveClassScheduleRows(storedSchedule?.rows, {
      dayOfWeek: classData.day_of_week, startTime: classData.start_time, endTime: classData.end_time, room: classData.room,
    }, () => crypto.randomUUID()));
    setFrequencyWeeks(storedSchedule?.frequencyWeeks ?? 1);
    setClassStatus(classData.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE');
    setEffectiveFrom(todayInAdelaide() < classData.session_start_date ? classData.session_start_date : todayInAdelaide());
    setEndDate(classData.session_end_date);
    setProposal(null); setPlan(null); setError(null);
  }, [classData, isEditing, storedSchedule]);

  const markChanged = () => { setProposal(null); setPlan(null); setError(null); };
  const updateRow = (id: string, patch: Partial<ClassScheduleRow>) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
    markChanged();
  };

  const preview = async () => {
    const validationError = validateClassScheduleRows(rows);
    if (validationError) return setError(validationError);
    if (!endDate || endDate < classData.session_start_date) return setError('The Class end date must be on or after its start date.');
    if (effectiveFrom < todayInAdelaide() || effectiveFrom > endDate) return setError('The effective date must be today or later and inside the Class dates.');
    const nextProposal = buildClassScheduleProposal({
      classId: classData.id, subjectId, cohortLabel: level, startDate: classData.session_start_date, endDate,
      effectiveFrom, anchorDate: storedSchedule?.anchorDate ?? classData.session_start_date, frequencyWeeks, rows, status: classStatus,
    });
    setError(null);
    try {
      setPlan(await previewMutation.mutateAsync(nextProposal));
      setProposal(nextProposal);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Unable to preview these changes.');
    }
  };

  const apply = async () => {
    if (!proposal || !plan) return;
    try {
      await applyMutation.mutateAsync({ proposal, expectedProposalHash: plan.proposal_hash });
      onSaved();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Unable to update this Class.');
    }
  };
  const busy = isLoading || isScheduleLoading || previewMutation.isPending || applyMutation.isPending;

  if (isEditing) {
    return (
      <form id="class-edit-form" className="space-y-6" onSubmit={(event) => { event.preventDefault(); void (plan ? apply() : preview()); }}>
        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {busy && rows.length === 0 ? <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin" /></div> : !plan ? <>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-x-4 gap-y-3">
            <Label htmlFor="level">Level:</Label>
            <Input id="level" value={level} onChange={(event) => { setLevel(event.target.value); markChanged(); }} disabled={busy} placeholder="e.g., A/B/C/D" />

            <Label>Subject:</Label>
            <SearchableSelect<Tables<'subjects'>> items={subjects} value={subjects.find((item) => item.id === subjectId) ?? null} onValueChange={(item) => { setSubjectId(item?.id ?? null); markChanged(); }} getItemLabel={(item) => item.long_name ?? ''} getItemId={(item) => item.id} placeholder="Select subject" disabled={busy} />

            <Label>Status:</Label>
            <SearchableSelect<(typeof STATUSES)[number]> items={STATUSES} value={STATUSES.find((item) => item.value === classStatus) ?? null} onValueChange={(item) => { setClassStatus(item?.value ?? 'ACTIVE'); markChanged(); }} getItemId={(item) => item.value} getItemLabel={(item) => item.label} disabled={busy} />

            <Label>Session start date:</Label>
            <div className="text-sm">{format(new Date(classData.session_start_date), 'MMM d, yyyy')}</div>

            <Label>Session end date:</Label>
            <SmartDatePickerField value={endDate} minDate={effectiveFrom || classData.session_start_date} onChange={(value) => { setEndDate(value ?? ''); markChanged(); }} />

            <Label>Changes effective from:</Label>
            <SmartDatePickerField value={effectiveFrom} minDate={todayInAdelaide()} onChange={(value) => { setEffectiveFrom(value ?? ''); markChanged(); }} />

            <Label>Repeat:</Label>
            <SearchableSelect<(typeof FREQUENCIES)[number]> items={FREQUENCIES} value={FREQUENCIES.find((item) => item.value === frequencyWeeks) ?? null} onValueChange={(item) => { setFrequencyWeeks(item?.value ?? 1); markChanged(); }} getItemId={(item) => String(item.value)} getItemLabel={(item) => item.label} disabled={busy} />
          </div>
          <div className="space-y-3 border-t pt-6">
            <div><h3 className="font-medium">Repeating timetable</h3><p className="text-sm text-muted-foreground">Add every day and time this Class runs. Changes only reconcile future Sessions.</p></div>
            {rows.map((row, index) => <div key={row.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto]">
              <div className="space-y-2"><Label>Day {index + 1}</Label><SearchableSelect<(typeof DAYS)[number]> items={DAYS} value={DAYS.find((day) => day.value === row.dayOfWeek) ?? null} onValueChange={(day) => updateRow(row.id, { dayOfWeek: day?.value ?? 1 })} getItemId={(day) => String(day.value)} getItemLabel={(day) => day.label} disabled={busy} /></div>
              <div className="space-y-2"><Label>Start</Label><Input type="time" value={row.startTime} disabled={busy} onChange={(event) => updateRow(row.id, { startTime: event.target.value })} /></div>
              <div className="space-y-2"><Label>End</Label><Input type="time" value={row.endTime} disabled={busy} onChange={(event) => updateRow(row.id, { endTime: event.target.value })} /></div>
              <div className="space-y-2"><Label>Room</Label><Input value={row.room} disabled={busy} onChange={(event) => updateRow(row.id, { room: event.target.value })} /></div>
              <div className="flex items-end"><Button type="button" size="icon" variant="ghost" aria-label={`Remove schedule row ${index + 1}`} disabled={busy || rows.length === 1} onClick={() => { setRows((current) => current.filter((item) => item.id !== row.id)); markChanged(); }}><Trash2 className="h-4 w-4" /></Button></div>
            </div>)}
            <Button type="button" variant="outline" disabled={busy} onClick={() => { setRows((current) => [...current, { id: crypto.randomUUID(), dayOfWeek: 1, startTime: '16:00', endTime: '17:30', room: '' }]); markChanged(); }}><Plus className="mr-2 h-4 w-4" />Add day / time</Button>
          </div>
        </> : <div className="space-y-4">
          <div><h3 className="font-medium">Review Class changes</h3><p className="text-sm text-muted-foreground">Confirm the future Session changes before they are applied.</p></div>
          <div className="grid grid-cols-3 gap-3"><div className="rounded-md border p-3"><strong className="block text-2xl">{plan.counts.create}</strong><span className="text-sm text-muted-foreground">create</span></div><div className="rounded-md border p-3"><strong className="block text-2xl">{plan.counts.cancel}</strong><span className="text-sm text-muted-foreground">remove</span></div><div className="rounded-md border p-3"><strong className="block text-2xl">{plan.counts.protected}</strong><span className="text-sm text-muted-foreground">protected</span></div></div>
          {plan.counts.protected > 0 && <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><AlertTriangle className="h-4 w-4 shrink-0" />Exceptional or enriched Sessions will remain unchanged.</div>}
          {plan.conflicts.length > 0 && <div className="rounded-md border border-amber-300 p-3 text-sm"><div className="font-medium">Warnings</div>{plan.conflicts.map((conflict) => <p key={conflict.message}>{conflict.message}</p>)}</div>}
          {plan.removals.length > 0 && <div className="max-h-64 divide-y overflow-y-auto rounded-md border">{plan.removals.map((removal) => <div key={removal.session_id} className="flex justify-between p-3 text-sm"><span>{new Date(removal.start_at).toLocaleString('en-AU', { timeZone: 'Australia/Adelaide' })}</span><span>{removal.action.toLowerCase()}</span></div>)}</div>}
          <Button type="button" variant="outline" disabled={busy} onClick={() => { setPlan(null); setProposal(null); }}>Back to editing</Button>
        </div>}
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancelEdit}>Cancel</Button>
          <Button type="submit" disabled={busy || rows.length === 0}>
            {(previewMutation.isPending || applyMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {plan ? 'Apply Class changes' : 'Review changes'}
          </Button>
        </div>
      </form>
    );
  }

  return <div className="space-y-6 pb-6 flex-1 overflow-y-auto px-1 pt-4">
    <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Class Information</h3><Button variant="outline" size="sm" onClick={onEdit}><Pencil className="h-4 w-4 mr-2" />Edit</Button></div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      <div className="text-sm font-medium">Level:</div><div>{classData.level || '-'}</div>
      <div className="text-sm font-medium">Schedule:</div><div>{classData.schedule_summary_long || `${getDayOfWeek(classData.day_of_week)} ${formatTime(classData.start_time)} - ${formatTime(classData.end_time)}`}</div>
      <div className="text-sm font-medium">Status:</div><div><ClassStatusBadge value={classData.status === 'ACTIVE' || classData.status === 'INACTIVE' ? classData.status : null} /></div>
      <div className="text-sm font-medium">Subject:</div><div>{subject ? (() => { const { style, textColorClass } = getSubjectColorStyle(subject); return <Badge className={!subject.color ? 'bg-gray-100 text-gray-800' : textColorClass} style={style.backgroundColor ? style : undefined}>{subject.long_name ?? ''}</Badge>; })() : '-'}</div>
      <div className="text-sm font-medium">Session Start Date:</div><div>{classData.session_start_date ? format(new Date(classData.session_start_date), 'MMM d, yyyy') : 'Not set'}</div>
      <div className="text-sm font-medium">Session End Date:</div><div>{classData.session_end_date ? format(new Date(classData.session_end_date), 'MMM d, yyyy') : 'Not set'}</div>
    </div>
  </div>;
}
