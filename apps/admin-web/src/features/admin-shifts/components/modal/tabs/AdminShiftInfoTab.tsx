import { useEffect, useState } from 'react';
import type { Tables } from '@altitutor/shared';
import { Badge } from '@altitutor/ui';
import { SearchableSelect } from '@altitutor/ui';
import { DurationPicker, TimePicker, addMinutesToTime, durationMinutesBetween, shiftStartKeepingDuration } from '@altitutor/ui';
import { Alert, AlertDescription, AlertTitle } from '@altitutor/ui';
import { SmartDatePickerField } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Pencil, AlertTriangle, Loader2 } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { formatTime, getDayOfWeek } from '@/shared/utils/datetime';
import { PropertyForm, PropertyFormRow } from '@/shared/components/PropertyForm';
import { format } from 'date-fns';
import {
  useAdminShiftSchedule,
  useApplyAdminShiftSchedule,
  usePreviewAdminShiftSchedule,
} from '../../../hooks/useAdminShiftsQuery';
import type { AdminShiftSchedulePlan, AdminShiftScheduleProposal, StoredAdminShiftSchedule } from '../../../types/schedule';
import {
  adelaideCalendarDate,
  buildAdminShiftScheduleProposal,
  partitionAdminShiftScheduleTimeline,
  resolveAdminShiftBounds,
  resolveAdminShiftEffectiveFrom,
  validateAdminShiftSchedule,
} from '../../../utils/adminShiftSchedule';

const STATUS_OPTIONS = [
  { value: 'ACTIVE' as const, label: 'Active' },
  { value: 'INACTIVE' as const, label: 'Inactive' },
] as const;

const DAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

const adminShiftInfoSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'Duration is required'),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  sessionStartDate: z.string().min(1, 'Session start date is required'),
  sessionEndDate: z.string().min(1, 'Session end date is required'),
}).refine((data) => data.sessionEndDate >= data.sessionStartDate, {
  message: 'Session end date must be after or equal to start date',
  path: ['sessionEndDate'],
}).refine((data) => !data.startTime || !data.endTime || data.endTime > data.startTime, {
  message: 'Duration must finish after the start time',
  path: ['endTime'],
});

type AdminShiftInfoFormData = z.infer<typeof adminShiftInfoSchema>;

interface AdminShiftInfoTabProps {
  adminShiftData: Tables<'admin_shifts'>;
  isEditing: boolean;
  isLoading: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void;
  onReviewStateChange?: (state: { label: string; busy: boolean }) => void;
}

function adelaideSessionLabel(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    timeZone: 'Australia/Adelaide',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function SessionChangeList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ start_at: string; end_at: string }>;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{title}</h4>
      <ul className="max-h-48 space-y-1 overflow-auto rounded-md border p-3 text-sm">
        {rows.map((row) => (
          <li key={`${row.start_at}-${row.end_at}`}>{adelaideSessionLabel(row.start_at)}</li>
        ))}
      </ul>
    </div>
  );
}

function ScheduleCard({ title, revision }: { title: string; revision: StoredAdminShiftSchedule }) {
  return (
    <div className="rounded-md border p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h4 className="font-medium">{title}</h4>
        <Badge className={revision.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
          {revision.status === 'ACTIVE' ? 'Active' : 'Inactive'}
        </Badge>
      </div>
      <p className="text-sm">{getDayOfWeek(revision.dayOfWeek)} {formatTime(revision.startTime)}–{formatTime(revision.endTime)}</p>
      <p className="text-sm text-muted-foreground">
        {format(new Date(`${revision.effectiveFrom}T12:00:00Z`), 'MMM d, yyyy')}
        {' – '}
        {format(new Date(`${revision.effectiveTo}T12:00:00Z`), 'MMM d, yyyy')}
      </p>
    </div>
  );
}

export function AdminShiftInfoTab({
  adminShiftData,
  isEditing,
  isLoading,
  onEdit,
  onCancelEdit: _onCancelEdit,
  onSaved,
  onReviewStateChange,
}: AdminShiftInfoTabProps) {
  const { data: scheduleTimeline, isLoading: isScheduleLoading } = useAdminShiftSchedule(adminShiftData.id, true);
  const previewMutation = usePreviewAdminShiftSchedule();
  const applyMutation = useApplyAdminShiftSchedule();
  const [effectiveFrom, setEffectiveFrom] = useState(adelaideCalendarDate());
  const [proposal, setProposal] = useState<AdminShiftScheduleProposal | null>(null);
  const [plan, setPlan] = useState<AdminShiftSchedulePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<AdminShiftInfoFormData>({
    resolver: zodResolver(adminShiftInfoSchema),
    defaultValues: {
      dayOfWeek: 1,
      startTime: '',
      endTime: '',
      status: 'ACTIVE',
      sessionStartDate: '',
      sessionEndDate: '',
    },
  });

  useEffect(() => {
    if (!isEditing || isScheduleLoading || scheduleTimeline === undefined) return;
    const bounds = resolveAdminShiftBounds(adminShiftData);
    const latest = scheduleTimeline[scheduleTimeline.length - 1];
    form.reset({
      dayOfWeek: latest?.dayOfWeek ?? adminShiftData.day_of_week ?? 1,
      startTime: latest?.startTime ?? adminShiftData.start_time ?? '',
      endTime: latest?.endTime ?? adminShiftData.end_time ?? '',
      status: latest?.status ?? (adminShiftData.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'),
      sessionStartDate: bounds.startDate,
      sessionEndDate: bounds.endDate,
    });
    setEffectiveFrom(resolveAdminShiftEffectiveFrom(bounds.startDate, latest?.effectiveFrom));
    setProposal(null);
    setPlan(null);
    setError(null);
  }, [adminShiftData, form, isEditing, isScheduleLoading, scheduleTimeline]);

  useEffect(() => {
    onReviewStateChange?.({
      label: plan ? 'Apply schedule changes' : 'Review changes',
      busy: previewMutation.isPending || applyMutation.isPending,
    });
  }, [applyMutation.isPending, onReviewStateChange, plan, previewMutation.isPending]);

  const markChanged = () => {
    setProposal(null);
    setPlan(null);
    setError(null);
  };

  const preview = async (data: AdminShiftInfoFormData) => {
    const validationError = validateAdminShiftSchedule({
      startTime: data.startTime,
      endTime: data.endTime,
      startDate: data.sessionStartDate,
      endDate: data.sessionEndDate,
      effectiveFrom,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    const nextProposal = buildAdminShiftScheduleProposal({
      adminShiftId: adminShiftData.id,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      status: data.status,
      startDate: data.sessionStartDate,
      endDate: data.sessionEndDate,
      effectiveFrom,
    });
    try {
      setPlan(await previewMutation.mutateAsync(nextProposal));
      setProposal(nextProposal);
      setError(null);
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
      setError(applyError instanceof Error ? applyError.message : 'Unable to update this admin shift.');
    }
  };

  const busy = isLoading || isScheduleLoading || previewMutation.isPending || applyMutation.isPending;
  const today = adelaideCalendarDate();
  const { current: currentSchedule, upcoming: upcomingSchedules } = partitionAdminShiftScheduleTimeline(
    scheduleTimeline,
    today
  );

  if (isEditing) {
    return (
      <form
        id="admin-shift-edit-form"
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (plan) {
            void apply();
            return;
          }
          void form.handleSubmit(preview)();
        }}
      >
        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {isScheduleLoading ? <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin" /></div> : !plan ? (
          <PropertyForm>
            <PropertyFormRow label="Status" valueClassName="space-y-1">
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <SearchableSelect<(typeof STATUS_OPTIONS)[number]>
                    items={[...STATUS_OPTIONS]}
                    value={STATUS_OPTIONS.find((option) => option.value === field.value) ?? null}
                    onValueChange={(item) => {
                      field.onChange(item?.value);
                      markChanged();
                    }}
                    getItemLabel={(option) => option.label}
                    getItemId={(option) => option.value}
                    placeholder="Select status"
                    disabled={busy}
                    ariaLabel="Status"
                  />
                )}
              />
            </PropertyFormRow>
            <PropertyFormRow label="Day of week" valueClassName="space-y-1">
              <Controller
                control={form.control}
                name="dayOfWeek"
                render={({ field }) => (
                  <SearchableSelect<(typeof DAY_OPTIONS)[number]>
                    items={[...DAY_OPTIONS]}
                    value={DAY_OPTIONS.find((option) => option.value === field.value) ?? DAY_OPTIONS[1]}
                    onValueChange={(item) => {
                      field.onChange(item?.value ?? 1);
                      markChanged();
                    }}
                    getItemLabel={(option) => option.label}
                    getItemId={(option) => String(option.value)}
                    placeholder="Select day"
                    disabled={busy}
                    ariaLabel="Day of week"
                  />
                )}
              />
            </PropertyFormRow>
            <PropertyFormRow label="Start time *" htmlFor="startTime" valueClassName="space-y-1">
              <Controller
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <TimePicker
                    id="startTime"
                    aria-label="Start time"
                    value={field.value}
                    disabled={busy}
                    onChange={(nextStart) => {
                      const next = shiftStartKeepingDuration(field.value, form.getValues('endTime'), nextStart);
                      if (!next) {
                        form.setError('endTime', { message: 'Duration must finish on the same day' });
                        return;
                      }
                      form.clearErrors('endTime');
                      field.onChange(next.startTime);
                      form.setValue('endTime', next.endTime, { shouldValidate: true });
                      markChanged();
                    }}
                  />
                )}
              />
              {form.formState.errors.startTime && (
                <p className="text-sm text-red-500">{form.formState.errors.startTime.message}</p>
              )}
            </PropertyFormRow>
            <PropertyFormRow label="Duration *" htmlFor="endTime" valueClassName="space-y-1">
              <Controller
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <DurationPicker
                    id="endTime"
                    aria-label="Duration"
                    value={durationMinutesBetween(form.watch('startTime'), field.value)}
                    disabled={busy}
                    onChange={(minutes) => {
                      const endTime = addMinutesToTime(form.getValues('startTime'), minutes);
                      if (!endTime) {
                        form.setError('endTime', { message: 'Duration must finish on the same day' });
                        return;
                      }
                      form.clearErrors('endTime');
                      field.onChange(endTime);
                      markChanged();
                    }}
                  />
                )}
              />
              {form.formState.errors.endTime && (
                <p className="text-sm text-red-500">{form.formState.errors.endTime.message}</p>
              )}
            </PropertyFormRow>
            <PropertyFormRow label="Session start date" valueClassName="space-y-1">
              <Controller
                control={form.control}
                name="sessionStartDate"
                render={({ field }) => (
                  <SmartDatePickerField
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value ?? '');
                      markChanged();
                    }}
                  />
                )}
              />
            </PropertyFormRow>
            <PropertyFormRow label="Session end date" valueClassName="space-y-1">
              <Controller
                control={form.control}
                name="sessionEndDate"
                render={({ field }) => (
                  <SmartDatePickerField
                    value={field.value}
                    minDate={form.watch('sessionStartDate') || undefined}
                    onChange={(value) => {
                      field.onChange(value ?? '');
                      markChanged();
                    }}
                  />
                )}
              />
            </PropertyFormRow>
            <PropertyFormRow label="Changes effective from" valueClassName="space-y-1">
              <SmartDatePickerField
                value={effectiveFrom}
                minDate={today}
                onChange={(value) => {
                  setEffectiveFrom(value ?? '');
                  markChanged();
                }}
              />
              <p className="text-xs text-muted-foreground">Sessions before this date stay as they are.</p>
            </PropertyFormRow>
          </PropertyForm>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">Review shift changes</h3>
              <p className="text-sm">
                {getDayOfWeek(form.getValues('dayOfWeek'))} {formatTime(form.getValues('startTime'))}–{formatTime(form.getValues('endTime'))}
              </p>
              <p className="text-sm text-muted-foreground">
                From {format(new Date(`${effectiveFrom}T12:00:00Z`), 'MMM d, yyyy')}, confirm the session changes before they are applied.
              </p>
            </div>
            <SessionChangeList
              title="Sessions from this date"
              rows={plan.occurrences.filter((occurrence) => occurrence.action === 'CREATE' || occurrence.action === 'PRESERVE')}
            />
            <SessionChangeList
              title="Sessions removed"
              rows={plan.removals.filter((removal) => removal.action === 'CANCEL')}
            />
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border p-3"><strong className="block text-2xl">{plan.counts.create}</strong><span className="text-sm text-muted-foreground">create</span></div>
              <div className="rounded-md border p-3"><strong className="block text-2xl">{plan.counts.cancel}</strong><span className="text-sm text-muted-foreground">remove</span></div>
              <div className="rounded-md border p-3"><strong className="block text-2xl">{plan.counts.protected}</strong><span className="text-sm text-muted-foreground">protected</span></div>
            </div>
            {plan.counts.protected > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Protected sessions</AlertTitle>
                <AlertDescription>Appointments and sessions that already have operational history stay unchanged.</AlertDescription>
              </Alert>
            )}
            {plan.conflicts.length > 0 && (
              <div className="rounded-md border border-amber-300 p-3 text-sm">
                <div className="font-medium">Warnings</div>
                {plan.conflicts.map((conflict) => <p key={conflict.message}>{conflict.message}</p>)}
              </div>
            )}
            <Button type="button" variant="outline" disabled={busy} onClick={() => { setPlan(null); setProposal(null); }}>
              Back to editing
            </Button>
          </div>
        )}
      </form>
    );
  }

  const bounds = resolveAdminShiftBounds(adminShiftData);
  return (
    <div className="space-y-6 pb-6 flex-1 overflow-y-auto px-1 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Admin Shift Information</h3>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>
      <PropertyForm>
        <PropertyFormRow label="Status">
          <Badge className={adminShiftData.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
            {adminShiftData.status}
          </Badge>
        </PropertyFormRow>
        <PropertyFormRow label="Session start date">
          {format(new Date(`${bounds.startDate}T12:00:00Z`), 'MMM d, yyyy')}
        </PropertyFormRow>
        <PropertyFormRow label="Session end date">
          {format(new Date(`${bounds.endDate}T12:00:00Z`), 'MMM d, yyyy')}
        </PropertyFormRow>
      </PropertyForm>
      <div className="space-y-3">
        <h3 className="text-base font-semibold">Schedule</h3>
        {isScheduleLoading ? (
          <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            {currentSchedule ? <ScheduleCard title="Current schedule" revision={currentSchedule} /> : null}
            {upcomingSchedules.map((revision) => (
              <ScheduleCard
                key={revision.id}
                title={`${currentSchedule ? 'From' : 'Starts'} ${format(new Date(`${revision.effectiveFrom}T12:00:00Z`), 'MMM d, yyyy')}`}
                revision={revision}
              />
            ))}
            {!currentSchedule && upcomingSchedules.length === 0 ? (
              <ScheduleCard
                title="Schedule"
                revision={{
                  id: adminShiftData.id,
                  dayOfWeek: adminShiftData.day_of_week,
                  startTime: adminShiftData.start_time,
                  endTime: adminShiftData.end_time,
                  status: adminShiftData.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
                  effectiveFrom: bounds.startDate,
                  effectiveTo: bounds.endDate,
                }}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
