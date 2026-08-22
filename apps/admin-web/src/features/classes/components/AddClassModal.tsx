'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  useToast,
} from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { SubjectSelectPopover } from '@/features/subjects/components/SubjectSelectPopover';
import {
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
  ExpandButton,
} from '@/shared/components/expandable-dialog';
import { cn, showEntityCreatedToast } from '@/shared/utils';
import { useApplyClassSchedule, usePreviewClassSchedule } from '../hooks/useClassesQuery';
import type {
  ClassSchedulePlan,
  ClassScheduleProposal,
  ClassScheduleRow,
} from '../types/schedule';
import {
  buildClassScheduleProposal,
  validateClassScheduleRows,
} from '../utils/classScheduleForm';

const DAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

const FREQUENCY_OPTIONS = [
  { value: 1 as const, label: 'Every week' },
  { value: 2 as const, label: 'Every fortnight' },
];

const STEP_TITLES = ['Class details', 'Repeating timetable', 'Review sessions'];

interface AddClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClassAdded: () => void;
}

function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function newScheduleRow(): ClassScheduleRow {
  return {
    id: crypto.randomUUID(),
    dayOfWeek: 1,
    startTime: '16:00',
    endTime: '17:30',
    room: '',
  };
}

export function AddClassModal({ isOpen, onClose, onClassAdded }: AddClassModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const previewMutation = usePreviewClassSchedule();
  const applyMutation = useApplyClassSchedule();
  const defaultEndDate = useMemo(() => `${new Date().getFullYear()}-12-31`, []);
  const [expanded, setExpanded] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [classId, setClassId] = useState('');
  const [cohortLabel, setCohortLabel] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<Tables<'subjects'> | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [frequencyWeeks, setFrequencyWeeks] = useState<1 | 2>(1);
  const [rows, setRows] = useState<ClassScheduleRow[]>([]);
  const [proposal, setProposal] = useState<ClassScheduleProposal | null>(null);
  const [plan, setPlan] = useState<ClassSchedulePlan | null>(null);

  const reset = () => {
    setStep(0);
    setError(null);
    setClassId(crypto.randomUUID());
    setCohortLabel('');
    setSelectedSubject(null);
    setStartDate(dateInputValue(new Date()));
    setEndDate(defaultEndDate);
    setFrequencyWeeks(1);
    setRows([newScheduleRow()]);
    setProposal(null);
    setPlan(null);
  };

  useEffect(() => {
    if (isOpen) {
      reset();
    } else {
      setExpanded(false);
    }
    // Reset is intentionally scoped to dialog openings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const updateRow = (id: string, patch: Partial<ClassScheduleRow>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setPlan(null);
  };

  const validateDetails = () => {
    if (!selectedSubject) return 'A subject is required.';
    if (!startDate || !endDate) return 'Class start and end dates are required.';
    if (endDate < startDate) return 'Class end date must be on or after its start date.';
    return null;
  };

  const handleNext = async () => {
    setError(null);
    if (step === 0) {
      const detailsError = validateDetails();
      if (detailsError) {
        setError(detailsError);
        return;
      }
      setStep(1);
      return;
    }

    const rowsError = validateClassScheduleRows(rows);
    if (rowsError) {
      setError(rowsError);
      return;
    }

    const nextProposal = buildClassScheduleProposal({
      classId,
      subjectId: selectedSubject?.id ?? null,
      cohortLabel,
      startDate,
      endDate,
      frequencyWeeks,
      rows,
    });

    try {
      const nextPlan = await previewMutation.mutateAsync(nextProposal);
      setProposal(nextProposal);
      setPlan(nextPlan);
      setStep(2);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Unable to preview this timetable.');
    }
  };

  const handleConfirm = async () => {
    if (!proposal || !plan) return;
    setError(null);
    try {
      const result = await applyMutation.mutateAsync({
        proposal,
        expectedProposalHash: plan.proposal_hash,
      });
      showEntityCreatedToast({
        toast,
        router,
        entityType: 'class',
        entityId: result.class_id ?? classId,
        message: 'Class and repeating sessions created successfully.',
      });
      onClassAdded();
      onClose();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Unable to create this Class.');
    }
  };

  const isBusy = previewMutation.isPending || applyMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'sm:max-w-[760px]',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DialogTitle>Add New Class</DialogTitle>
              <DialogDescription>
                Step {step + 1} of 3: {STEP_TITLES[step]}
              </DialogDescription>
            </div>
            <ExpandButton expanded={expanded} onToggle={() => setExpanded((value) => !value)} />
          </div>
        </DialogHeader>

        <div className="flex gap-2" aria-label="Class creation progress">
          {STEP_TITLES.map((title, index) => (
            <div
              key={title}
              className={cn('h-1 flex-1 rounded-full', index <= step ? 'bg-primary' : 'bg-muted')}
            />
          ))}
        </div>

        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        <div className="max-h-[62vh] space-y-5 overflow-y-auto pr-1">
          {step === 0 && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Subject *</Label>
                  <SubjectSelectPopover
                    selectedSubject={selectedSubject}
                    onSelectSubject={setSelectedSubject}
                    placeholder="Select subject"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cohort-label">Class name / code</Label>
                  <Input
                    id="cohort-label"
                    value={cohortLabel}
                    onChange={(event) => setCohortLabel(event.target.value)}
                    placeholder="A, B, Interview Course"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start date *</Label>
                  <SmartDatePickerField value={startDate} onChange={(value) => setStartDate(value ?? '')} />
                </div>
                <div className="space-y-2">
                  <Label>End date *</Label>
                  <SmartDatePickerField
                    value={endDate}
                    onChange={(value) => setEndDate(value ?? '')}
                    minDate={startDate || undefined}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Sessions use Australia/Adelaide time and are generated only inside these dates.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="max-w-xs space-y-2">
                <Label>Repeat</Label>
                <SearchableSelect<(typeof FREQUENCY_OPTIONS)[number]>
                  items={FREQUENCY_OPTIONS}
                  value={FREQUENCY_OPTIONS.find((option) => option.value === frequencyWeeks) ?? null}
                  onValueChange={(option) => {
                    setFrequencyWeeks(option?.value ?? 1);
                    setPlan(null);
                  }}
                  getItemId={(option) => String(option.value)}
                  getItemLabel={(option) => option.label}
                />
              </div>

              <div className="space-y-3">
                {rows.map((row, index) => (
                  <div key={row.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto]">
                    <div className="space-y-2">
                      <Label>Day {index + 1}</Label>
                      <SearchableSelect<(typeof DAY_OPTIONS)[number]>
                        items={[...DAY_OPTIONS]}
                        value={DAY_OPTIONS.find((day) => day.value === row.dayOfWeek) ?? null}
                        onValueChange={(day) => updateRow(row.id, { dayOfWeek: day?.value ?? 1 })}
                        getItemId={(day) => String(day.value)}
                        getItemLabel={(day) => day.label}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`start-${row.id}`}>Start</Label>
                      <Input
                        id={`start-${row.id}`}
                        type="time"
                        value={row.startTime}
                        onChange={(event) => updateRow(row.id, { startTime: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`end-${row.id}`}>End</Label>
                      <Input
                        id={`end-${row.id}`}
                        type="time"
                        value={row.endTime}
                        onChange={(event) => updateRow(row.id, { endTime: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`room-${row.id}`}>Room</Label>
                      <Input
                        id={`room-${row.id}`}
                        value={row.room}
                        onChange={(event) => updateRow(row.id, { room: event.target.value })}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove schedule row ${index + 1}`}
                        disabled={rows.length === 1}
                        onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={() => setRows((current) => [...current, newScheduleRow()])}>
                  <Plus className="mr-2 h-4 w-4" /> Add day / time
                </Button>
              </div>
            </div>
          )}

          {step === 2 && plan && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border p-3">
                  <div className="text-2xl font-semibold">{plan.counts.create}</div>
                  <div className="text-sm text-muted-foreground">Sessions to create</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-2xl font-semibold">{plan.counts.preserve}</div>
                  <div className="text-sm text-muted-foreground">Sessions kept</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-2xl font-semibold">{plan.counts.cancel}</div>
                  <div className="text-sm text-muted-foreground">Future Sessions removed</div>
                </div>
              </div>

              {plan.counts.protected > 0 && (
                <div className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {plan.counts.protected} exceptional or enriched Sessions will be kept unchanged.
                </div>
              )}

              {plan.conflicts.length > 0 && (
                <div className="rounded-md border border-amber-300 p-3 text-sm">
                  <div className="font-medium">Warnings</div>
                  {plan.conflicts.map((conflict) => <p key={conflict.message}>{conflict.message}</p>)}
                </div>
              )}

              <div className="space-y-2">
                <h3 className="font-medium">Generated timetable</h3>
                <div className="max-h-64 divide-y overflow-y-auto rounded-md border">
                  {plan.occurrences.map((occurrence) => (
                    <div key={`${occurrence.source_key}-${occurrence.start_at}`} className="flex justify-between gap-4 p-3 text-sm">
                      <span>{new Date(occurrence.start_at).toLocaleString('en-AU', { timeZone: 'Australia/Adelaide', dateStyle: 'medium', timeStyle: 'short' })}</span>
                      <span className="text-muted-foreground">{occurrence.room ?? 'No room'} · {occurrence.action.toLowerCase()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 border-t pt-4">
          <div>
            {step > 0 && (
              <Button type="button" variant="outline" disabled={isBusy} onClick={() => setStep((current) => current - 1)}>
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>Cancel</Button>
            {step < 2 ? (
              <Button type="button" onClick={handleNext} disabled={isBusy}>
                {previewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {step === 1 ? 'Preview sessions' : 'Next'}
              </Button>
            ) : (
              <Button type="button" onClick={handleConfirm} disabled={isBusy || !plan}>
                {applyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Class
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
