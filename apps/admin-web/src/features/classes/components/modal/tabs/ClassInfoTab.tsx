'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { Badge, Button, ClassStatusBadge, Input, Label, SearchableSelect, SmartDatePickerField } from '@altitutor/ui';
import { getSubjectColorStyle } from '@/shared/utils';
import { formatCurrency } from '@/shared/utils/pricing';
import { formatTime, getDayOfWeek } from '@/shared/utils/datetime';
import { useBillingPricing, useSubjectPricingOverrides } from '@/features/billing';
import { useApplyClassSchedule, useClassScheduleTimeline, usePreviewClassSchedule } from '../../../hooks/useClassesQuery';
import type { ClassBillingType, ClassSchedulePlan, ClassScheduleProposal, ClassScheduleRow, ScheduledOfferingType, StoredClassSchedule } from '../../../types/schedule';
import { buildClassScheduleProposal, resolveClassScheduleRows, validateClassScheduleRows } from '../../../utils/classScheduleForm';
import { calculateStandardClassSessionPrice, resolveStandardClassRate } from '../../../utils/classPricing';
import { partitionClassScheduleTimeline } from '../../../utils/classScheduleTimeline';
import { GeneratedTimetablePreview } from '../../GeneratedTimetablePreview';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((label, value) => ({ label, value }));
const FREQUENCIES = [{ label: 'Every week', value: 1 as const }, { label: 'Every fortnight', value: 2 as const }];
const STATUSES = [{ label: 'Active', value: 'ACTIVE' as const }, { label: 'Inactive', value: 'INACTIVE' as const }];
const BILLING_TYPES: Array<{ label: string; value: ClassBillingType }> = [
  { label: 'Class', value: 'CLASS' },
  { label: 'Exam course', value: 'EXAM_COURSE' },
  { label: 'Drafting', value: 'DRAFTING' },
];
const OFFERING_TYPES: Array<{ label: string; value: ScheduledOfferingType }> = [
  { label: 'Class', value: 'CLASS' },
  { label: 'Homework Help', value: 'HOMEWORK_HELP' },
];

function billingTypeLabel(value: ClassBillingType | null): string {
  if (!value) return 'Free';
  return BILLING_TYPES.find((option) => option.value === value)?.label ?? value;
}

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

interface ScheduleConfigurationCardProps {
  title: string;
  revision: StoredClassSchedule;
  subjectId: string | null;
  pricingDate: string;
  pricing: Tables<'billing_pricing'>[];
  overrides: Tables<'billing_pricing_overrides'>[];
  isPricingLoading: boolean;
}

function ScheduleConfigurationCard({
  title,
  revision,
  subjectId,
  pricingDate,
  pricing,
  overrides,
  isPricingLoading,
}: ScheduleConfigurationCardProps) {
  const standardRate = revision.sessionType === 'CLASS' && revision.billingType
    ? resolveStandardClassRate(
        revision.billingType,
        subjectId,
        new Date(`${pricingDate}T12:00:00Z`),
        pricing,
        overrides
      )
    : null;

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium">{title}</h4>
        <Badge variant="outline">
          {revision.sessionType === 'HOMEWORK_HELP' ? 'Homework Help · Free' : billingTypeLabel(revision.billingType)}
        </Badge>
      </div>
      {revision.scheduleType === 'CUSTOM' || revision.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Custom timetable — see Sessions for dated times and prices.</p>
      ) : (
        <div className="divide-y">
          {revision.rows.map((row) => {
            const sessionPrice = revision.sessionType === 'CLASS'
              ? calculateStandardClassSessionPrice(row.startTime, row.endTime, standardRate)
              : null;
            return (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-sm first:pt-0 last:pb-0">
                <div>
                  <span>{getDayOfWeek(row.dayOfWeek)} {formatTime(row.startTime)}–{formatTime(row.endTime)}</span>
                  {row.room ? <span className="text-muted-foreground"> · {row.room}</span> : null}
                </div>
                <span className="font-medium">
                  {revision.sessionType === 'HOMEWORK_HELP'
                    ? 'Free'
                    : isPricingLoading
                    ? 'Loading price…'
                    : sessionPrice
                      ? `${formatCurrency(sessionPrice.amountCents, sessionPrice.currency)}/session`
                      : 'Price not configured'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ClassInfoTab({ classData, subject, subjects, isEditing, isLoading, onEdit, onCancelEdit, onSaved }: ClassInfoTabProps) {
  const { data: scheduleTimeline, isLoading: isScheduleLoading } = useClassScheduleTimeline(classData.id);
  const { data: billingPricing = [], isLoading: isBillingPricingLoading } = useBillingPricing();
  const { data: pricingOverrides = [], isLoading: isPricingOverridesLoading } = useSubjectPricingOverrides();
  const storedSchedule = scheduleTimeline?.[scheduleTimeline.length - 1];
  const previewMutation = usePreviewClassSchedule();
  const applyMutation = useApplyClassSchedule();
  const [level, setLevel] = useState('');
  const [sessionType, setSessionType] = useState<ScheduledOfferingType>('CLASS');
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [billingType, setBillingType] = useState<ClassBillingType>('CLASS');
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
    setSessionType(storedSchedule?.sessionType ?? classData.session_type);
    setSubjectId(classData.subject_id);
    setBillingType(storedSchedule?.billingType ?? classData.billing_type ?? 'CLASS');
    setRows(resolveClassScheduleRows(storedSchedule?.rows, {
      dayOfWeek: classData.day_of_week, startTime: classData.start_time, endTime: classData.end_time, room: classData.room,
    }, () => crypto.randomUUID()));
    setFrequencyWeeks(storedSchedule?.frequencyWeeks ?? 1);
    setClassStatus(classData.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE');
    const today = todayInAdelaide();
    setEffectiveFrom(
      storedSchedule?.effectiveFrom && storedSchedule.effectiveFrom >= today
        ? storedSchedule.effectiveFrom
        : today < classData.session_start_date
          ? classData.session_start_date
          : today
    );
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
      classId: classData.id, sessionType,
      subjectId: sessionType === 'CLASS' ? subjectId : null,
      cohortLabel: level, startDate: classData.session_start_date, endDate,
      billingType: sessionType === 'CLASS' ? billingType : null,
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
  const today = todayInAdelaide();
  const { current: currentSchedule, upcoming: upcomingSchedules } = partitionClassScheduleTimeline(
    scheduleTimeline,
    today
  );
  const isPricingLoading = isBillingPricingLoading || isPricingOverridesLoading;

  if (isEditing) {
    return (
      <form id="class-edit-form" className="space-y-6" onSubmit={(event) => { event.preventDefault(); void (plan ? apply() : preview()); }}>
        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {busy && rows.length === 0 ? <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin" /></div> : !plan ? <>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-x-4 gap-y-3">
            <Label>Offering type:</Label>
            <div>
              <SearchableSelect<(typeof OFFERING_TYPES)[number]> items={OFFERING_TYPES} value={OFFERING_TYPES.find((item) => item.value === sessionType) ?? null} onValueChange={(item) => { setSessionType(item?.value ?? 'CLASS'); markChanged(); }} getItemId={(item) => item.value} getItemLabel={(item) => item.label} disabled />
              <p className="mt-1 text-xs text-muted-foreground">Type is fixed after Sessions have been generated.</p>
            </div>
            <Label htmlFor="level">Level:</Label>
            <Input id="level" value={level} onChange={(event) => { setLevel(event.target.value); markChanged(); }} disabled={busy} placeholder="e.g., A/B/C/D" />

            {sessionType === 'CLASS' ? <>
              <Label>Subject:</Label>
              <SearchableSelect<Tables<'subjects'>> items={subjects} value={subjects.find((item) => item.id === subjectId) ?? null} onValueChange={(item) => { setSubjectId(item?.id ?? null); markChanged(); }} getItemLabel={(item) => item.long_name ?? ''} getItemId={(item) => item.id} placeholder="Select subject" disabled={busy} />

              <Label>Billing type:</Label>
              <SearchableSelect<(typeof BILLING_TYPES)[number]> items={BILLING_TYPES} value={BILLING_TYPES.find((item) => item.value === billingType) ?? null} onValueChange={(item) => { setBillingType(item?.value ?? 'CLASS'); markChanged(); }} getItemId={(item) => item.value} getItemLabel={(item) => item.label} placeholder="Select billing type" disabled={busy} />
            </> : <>
              <Label>Student billing:</Label><p className="text-sm text-muted-foreground">Free — students are not billed.</p>
            </>}

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
            <div><h3 className="font-medium">Repeating timetable</h3><p className="text-sm text-muted-foreground">Add every day and time this scheduled offering runs. Changes only reconcile future Sessions.</p></div>
            {rows.map((row, index) => <div key={row.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto]">
              <div className="flex min-w-0 flex-col gap-2"><Label>Day {index + 1}</Label><SearchableSelect<(typeof DAYS)[number]> items={DAYS} value={DAYS.find((day) => day.value === row.dayOfWeek) ?? null} onValueChange={(day) => updateRow(row.id, { dayOfWeek: day?.value ?? 1 })} getItemId={(day) => String(day.value)} getItemLabel={(day) => day.label} disabled={busy} /></div>
              <div className="space-y-2"><Label>Start</Label><Input type="time" value={row.startTime} disabled={busy} onChange={(event) => updateRow(row.id, { startTime: event.target.value })} /></div>
              <div className="space-y-2"><Label>End</Label><Input type="time" value={row.endTime} disabled={busy} onChange={(event) => updateRow(row.id, { endTime: event.target.value })} /></div>
              <div className="space-y-2"><Label>Room</Label><Input value={row.room} disabled={busy} onChange={(event) => updateRow(row.id, { room: event.target.value })} /></div>
              <div className="flex items-end"><Button type="button" size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`Remove schedule row ${index + 1}`} disabled={busy || rows.length === 1} onClick={() => { setRows((current) => current.filter((item) => item.id !== row.id)); markChanged(); }}><Trash2 className="h-4 w-4" /></Button></div>
            </div>)}
            <Button type="button" variant="outline" disabled={busy} onClick={() => { setRows((current) => [...current, { id: crypto.randomUUID(), dayOfWeek: 1, startTime: '16:00', endTime: '17:30', room: '' }]); markChanged(); }}><Plus className="mr-2 h-4 w-4" />Add day / time</Button>
          </div>
        </> : <div className="space-y-4">
          <div><h3 className="font-medium">Review Class changes</h3><p className="text-sm text-muted-foreground">Confirm the future Session changes before they are applied.</p></div>
          <div className="grid grid-cols-3 gap-3"><div className="rounded-md border p-3"><strong className="block text-2xl">{plan.counts.create}</strong><span className="text-sm text-muted-foreground">create</span></div><div className="rounded-md border p-3"><strong className="block text-2xl">{plan.counts.cancel}</strong><span className="text-sm text-muted-foreground">remove</span></div><div className="rounded-md border p-3"><strong className="block text-2xl">{plan.counts.protected}</strong><span className="text-sm text-muted-foreground">protected</span></div></div>
          {plan.counts.protected > 0 && <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><AlertTriangle className="h-4 w-4 shrink-0" />Exceptional or enriched Sessions will remain unchanged.</div>}
          {plan.conflicts.length > 0 && <div className="rounded-md border border-amber-300 p-3 text-sm"><div className="font-medium">Warnings</div>{plan.conflicts.map((conflict) => <p key={conflict.message}>{conflict.message}</p>)}</div>}
          <GeneratedTimetablePreview occurrences={plan.occurrences} />
          {plan.removals.length > 0 && <div className="max-h-64 divide-y overflow-y-auto rounded-md border">{plan.removals.map((removal) => <div key={removal.session_id} className="flex justify-between p-3 text-sm"><span>{new Date(removal.start_at).toLocaleString('en-AU', { timeZone: 'Australia/Adelaide' })}</span><span>{removal.action.toLowerCase()}</span></div>)}</div>}
          <Button type="button" variant="outline" disabled={busy} onClick={() => { setPlan(null); setProposal(null); }}>Back to editing</Button>
        </div>}
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancelEdit}>Cancel</Button>
          <Button type="submit" disabled={busy || rows.length === 0}>
            {(previewMutation.isPending || applyMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {plan ? 'Apply offering changes' : 'Review changes'}
          </Button>
        </div>
      </form>
    );
  }

  return <div className="space-y-6 pb-6 flex-1 overflow-y-auto px-1 pt-4">
    <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Scheduled offering information</h3><Button variant="outline" size="sm" onClick={onEdit}><Pencil className="h-4 w-4 mr-2" />Edit</Button></div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      <div className="text-sm font-medium">Offering type:</div><div>{classData.session_type === 'HOMEWORK_HELP' ? 'Homework Help' : 'Class'}</div>
      <div className="text-sm font-medium">Level:</div><div>{classData.level || '-'}</div>
      <div className="text-sm font-medium">Status:</div><div><ClassStatusBadge value={classData.status === 'ACTIVE' || classData.status === 'INACTIVE' ? classData.status : null} /></div>
      {classData.session_type === 'CLASS' ? <><div className="text-sm font-medium">Subject:</div><div>{subject ? (() => { const { style, textColorClass } = getSubjectColorStyle(subject); return <Badge className={!subject.color ? 'bg-gray-100 text-gray-800' : textColorClass} style={style.backgroundColor ? style : undefined}>{subject.long_name ?? ''}</Badge>; })() : '-'}</div></> : null}
      <div className="text-sm font-medium">Session Start Date:</div><div>{classData.session_start_date ? format(new Date(classData.session_start_date), 'MMM d, yyyy') : 'Not set'}</div>
      <div className="text-sm font-medium">Session End Date:</div><div>{classData.session_end_date ? format(new Date(classData.session_end_date), 'MMM d, yyyy') : 'Not set'}</div>
    </div>
    <div className="space-y-3">
      <h3 className="text-base font-semibold">Schedule and standard price</h3>
      {isScheduleLoading ? (
        <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <>
          {currentSchedule ? (
            <ScheduleConfigurationCard
              title="Current schedule"
              revision={currentSchedule}
              subjectId={classData.subject_id}
              pricingDate={today}
              pricing={billingPricing}
              overrides={pricingOverrides}
              isPricingLoading={isPricingLoading}
            />
          ) : null}
          {upcomingSchedules.map((revision) => (
            <ScheduleConfigurationCard
              key={revision.id}
              title={`${currentSchedule ? 'From' : 'Starts'} ${format(new Date(`${revision.effectiveFrom}T12:00:00Z`), 'MMM d, yyyy')}`}
              revision={revision}
              subjectId={classData.subject_id}
              pricingDate={revision.effectiveFrom}
              pricing={billingPricing}
              overrides={pricingOverrides}
              isPricingLoading={isPricingLoading}
            />
          ))}
          {!currentSchedule && upcomingSchedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active or upcoming schedule is configured.</p>
          ) : null}
        </>
      )}
    </div>
  </div>;
}
