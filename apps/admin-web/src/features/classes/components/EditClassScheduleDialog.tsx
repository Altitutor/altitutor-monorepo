'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  SearchableSelect,
  SmartDatePickerField,
} from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import {
  useApplyClassSchedule,
  useClassSchedule,
  usePreviewClassSchedule,
} from '../hooks/useClassesQuery';
import type { ClassSchedulePlan, ClassScheduleProposal, ClassScheduleRow } from '../types/schedule';
import {
  buildClassScheduleProposal,
  resolveClassScheduleRows,
  validateClassScheduleRows,
} from '../utils/classScheduleForm';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  .map((label, value) => ({ label, value }));
const FREQUENCIES = [
  { label: 'Every week', value: 1 as const },
  { label: 'Every fortnight', value: 2 as const },
];
const STATUSES = [
  { label: 'Active', value: 'ACTIVE' as const },
  { label: 'Inactive', value: 'INACTIVE' as const },
];

interface EditClassScheduleDialogProps {
  classData: Tables<'classes'>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function todayInAdelaide(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Adelaide',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function EditClassScheduleDialog({
  classData,
  open,
  onOpenChange,
  onSaved,
}: EditClassScheduleDialogProps) {
  const { data: storedSchedule, isLoading } = useClassSchedule(classData.id, open);
  const previewMutation = usePreviewClassSchedule();
  const applyMutation = useApplyClassSchedule();
  const [rows, setRows] = useState<ClassScheduleRow[]>([]);
  const [frequencyWeeks, setFrequencyWeeks] = useState<1 | 2>(1);
  const [classStatus, setClassStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [effectiveFrom, setEffectiveFrom] = useState(todayInAdelaide());
  const [endDate, setEndDate] = useState(classData.session_end_date);
  const [proposal, setProposal] = useState<ClassScheduleProposal | null>(null);
  const [plan, setPlan] = useState<ClassSchedulePlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || storedSchedule === undefined) return;
    setRows(resolveClassScheduleRows(storedSchedule?.rows, {
      dayOfWeek: classData.day_of_week,
      startTime: classData.start_time,
      endTime: classData.end_time,
      room: classData.room,
    }, () => crypto.randomUUID()));
    setFrequencyWeeks(storedSchedule?.frequencyWeeks ?? 1);
    setClassStatus(classData.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE');
    setEffectiveFrom(todayInAdelaide() < classData.session_start_date ? classData.session_start_date : todayInAdelaide());
    setEndDate(classData.session_end_date);
    setProposal(null);
    setPlan(null);
    setError(null);
  }, [
    classData.day_of_week,
    classData.end_time,
    classData.room,
    classData.session_end_date,
    classData.session_start_date,
    classData.start_time,
    classData.status,
    open,
    storedSchedule,
  ]);

  const updateRow = (id: string, patch: Partial<ClassScheduleRow>) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
    setPlan(null);
  };

  const preview = async () => {
    const validationError = validateClassScheduleRows(rows);
    if (validationError) return setError(validationError);
    if (!endDate || endDate < classData.session_start_date) {
      return setError('The Class end date must be on or after its start date.');
    }
    if (effectiveFrom < todayInAdelaide() || effectiveFrom > endDate) {
      return setError('The effective date must be today or later and inside the Class dates.');
    }
    const nextProposal = buildClassScheduleProposal({
      classId: classData.id,
      subjectId: classData.subject_id,
      cohortLabel: classData.cohort_label ?? classData.level ?? '',
      startDate: classData.session_start_date,
      endDate,
      effectiveFrom,
      anchorDate: storedSchedule?.anchorDate ?? classData.session_start_date,
      frequencyWeeks,
      rows,
      status: classStatus,
    });
    setError(null);
    try {
      const nextPlan = await previewMutation.mutateAsync(nextProposal);
      setProposal(nextProposal);
      setPlan(nextPlan);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Unable to preview this change.');
    }
  };

  const apply = async () => {
    if (!proposal || !plan) return;
    try {
      await applyMutation.mutateAsync({ proposal, expectedProposalHash: plan.proposal_hash });
      onSaved();
      onOpenChange(false);
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Unable to update this timetable.');
    }
  };

  const busy = previewMutation.isPending || applyMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[820px]">
        <DialogHeader>
          <DialogTitle>Edit repeating timetable</DialogTitle>
          <DialogDescription>
            Changes apply from the chosen date. Historical and protected Sessions stay unchanged.
          </DialogDescription>
        </DialogHeader>

        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        {isLoading ? (
          <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : !plan ? (
          <div className="max-h-[62vh] space-y-5 overflow-y-auto">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Effective from</Label>
                <SmartDatePickerField
                  value={effectiveFrom}
                  minDate={todayInAdelaide()}
                  onChange={(value) => setEffectiveFrom(value ?? '')}
                />
              </div>
              <div className="space-y-2">
                <Label>Class end date</Label>
                <SmartDatePickerField
                  value={endDate}
                  minDate={effectiveFrom || classData.session_start_date}
                  onChange={(value) => {
                    setEndDate(value ?? '');
                    setPlan(null);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Repeat</Label>
                <SearchableSelect<(typeof FREQUENCIES)[number]>
                  items={FREQUENCIES}
                  value={FREQUENCIES.find((item) => item.value === frequencyWeeks) ?? null}
                  onValueChange={(item) => setFrequencyWeeks(item?.value ?? 1)}
                  getItemId={(item) => String(item.value)}
                  getItemLabel={(item) => item.label}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <SearchableSelect<(typeof STATUSES)[number]>
                  items={STATUSES}
                  value={STATUSES.find((item) => item.value === classStatus) ?? null}
                  onValueChange={(item) => {
                    setClassStatus(item?.value ?? 'ACTIVE');
                    setPlan(null);
                  }}
                  getItemId={(item) => item.value}
                  getItemLabel={(item) => item.label}
                />
                <p className="text-xs text-muted-foreground">Status changes use the same Session preview.</p>
              </div>
            </div>
            <div className="space-y-3">
              {rows.map((row, index) => (
                <div key={row.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto]">
                  <div className="space-y-2">
                    <Label>Day {index + 1}</Label>
                    <SearchableSelect<(typeof DAYS)[number]>
                      items={DAYS}
                      value={DAYS.find((day) => day.value === row.dayOfWeek) ?? null}
                      onValueChange={(day) => updateRow(row.id, { dayOfWeek: day?.value ?? 1 })}
                      getItemId={(day) => String(day.value)}
                      getItemLabel={(day) => day.label}
                    />
                  </div>
                  <div className="space-y-2"><Label>Start</Label><Input type="time" value={row.startTime} onChange={(event) => updateRow(row.id, { startTime: event.target.value })} /></div>
                  <div className="space-y-2"><Label>End</Label><Input type="time" value={row.endTime} onChange={(event) => updateRow(row.id, { endTime: event.target.value })} /></div>
                  <div className="space-y-2"><Label>Room</Label><Input value={row.room} onChange={(event) => updateRow(row.id, { room: event.target.value })} /></div>
                  <div className="flex items-end">
                    <Button type="button" size="icon" variant="ghost" aria-label={`Remove schedule row ${index + 1}`} disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => setRows((current) => [...current, { id: crypto.randomUUID(), dayOfWeek: 1, startTime: '16:00', endTime: '17:30', room: '' }])}><Plus className="mr-2 h-4 w-4" /> Add day / time</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border p-3"><strong className="block text-2xl">{plan.counts.create}</strong><span className="text-sm text-muted-foreground">create</span></div>
              <div className="rounded-md border p-3"><strong className="block text-2xl">{plan.counts.cancel}</strong><span className="text-sm text-muted-foreground">remove</span></div>
              <div className="rounded-md border p-3"><strong className="block text-2xl">{plan.counts.protected}</strong><span className="text-sm text-muted-foreground">protected</span></div>
            </div>
            {plan.counts.protected > 0 && <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><AlertTriangle className="h-4 w-4" />These exceptional or enriched Sessions will remain unchanged.</div>}
            {plan.conflicts.length > 0 && (
              <div className="rounded-md border border-amber-300 p-3 text-sm">
                <div className="font-medium">Warnings</div>
                {plan.conflicts.map((conflict) => (
                  <p key={conflict.message}>{conflict.message}</p>
                ))}
              </div>
            )}
            <div className="max-h-64 divide-y overflow-y-auto rounded-md border">
              {plan.removals.map((removal) => <div key={removal.session_id} className="flex justify-between p-3 text-sm"><span>{new Date(removal.start_at).toLocaleString('en-AU', { timeZone: 'Australia/Adelaide' })}</span><span>{removal.action.toLowerCase()}</span></div>)}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t pt-4">
          {plan && <Button type="button" variant="outline" disabled={busy} onClick={() => setPlan(null)}>Back</Button>}
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
          {plan ? <Button type="button" disabled={busy} onClick={apply}>{applyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Apply timetable</Button> : <Button type="button" disabled={busy || rows.length === 0} onClick={preview}>{previewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Preview changes</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
