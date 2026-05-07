'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Badge,
} from '@altitutor/ui';
import { useQuery } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { studentsApi } from '@/features/students/api/students';
import { staffApi } from '@/features/staff/api/staff';
import { parentsApi } from '@/features/parents/api/parents';
import { getTodayAdelaideDate, adelaideWallDateTimePlusMinutesUtcIso } from '@/features/bookings/utils/dateTimeHelpers';
import { useToast } from '@altitutor/ui';

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

type IdLabel = { id: string; label: string };

export type CheckInBookSessionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (sessionId: string) => void;
};

function nameStaff(s: Tables<'staff'>): string {
  return `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || 'Staff';
}

function nameStudent(s: Tables<'students'>): string {
  return `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || 'Student';
}

function nameParent(p: Tables<'parents'>): string {
  return `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Parent';
}

export function CheckInBookSessionModal({ isOpen, onClose, onCreated }: CheckInBookSessionModalProps) {
  const { toast } = useToast();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [staffPicks, setStaffPicks] = useState<IdLabel[]>([]);
  const [studentPicks, setStudentPicks] = useState<IdLabel[]>([]);
  const [parentPicks, setParentPicks] = useState<IdLabel[]>([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [parentSearch, setParentSearch] = useState('');
  const [debouncedStaff, setDebouncedStaff] = useState('');
  const [debouncedStudent, setDebouncedStudent] = useState('');
  const [debouncedParent, setDebouncedParent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDate(getTodayAdelaideDate());
      setTime('09:00');
      setDurationMinutes(60);
      setStaffPicks([]);
      setStudentPicks([]);
      setParentPicks([]);
      setStaffSearch('');
      setStudentSearch('');
      setParentSearch('');
    }
  }, [isOpen]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedStaff(staffSearch), 300);
    return () => clearTimeout(t);
  }, [staffSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedStudent(studentSearch), 300);
    return () => clearTimeout(t);
  }, [studentSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedParent(parentSearch), 300);
    return () => clearTimeout(t);
  }, [parentSearch]);

  const staffIds = staffPicks.map((p) => p.id);
  const studentIds = studentPicks.map((p) => p.id);
  const parentIds = parentPicks.map((p) => p.id);

  const { data: staffResults = [], isFetching: staffLoading } = useQuery({
    queryKey: ['check-in-staff-search', debouncedStaff],
    queryFn: async () => {
      const { staff } = await staffApi.searchForAbsence({
        search: debouncedStaff,
        page: 0,
        pageSize: 25,
      });
      return staff;
    },
    enabled: isOpen,
    staleTime: 30_000,
  });

  const { data: studentResults = [], isFetching: studentLoading } = useQuery({
    queryKey: ['check-in-student-search', debouncedStudent],
    queryFn: async () => {
      const { students } = await studentsApi.listMinimal({
        search: debouncedStudent,
        statuses: ['ACTIVE', 'TRIAL'],
        limit: 25,
        offset: 0,
        orderBy: 'first_name',
        ascending: true,
      });
      return students as Tables<'students'>[];
    },
    enabled: isOpen,
    staleTime: 30_000,
  });

  const { data: parentResults = [], isFetching: parentLoading } = useQuery({
    queryKey: ['check-in-parent-search', debouncedParent],
    queryFn: async () => {
      const { parents } = await parentsApi.list({
        search: debouncedParent,
        limit: 25,
        offset: 0,
        orderBy: 'last_name',
        ascending: true,
      });
      return parents as Tables<'parents'>[];
    },
    enabled: isOpen,
    staleTime: 30_000,
  });

  const addStaff = useCallback((s: Tables<'staff'>) => {
    const id = s.id;
    const label = nameStaff(s);
    setStaffPicks((prev) => (prev.some((p) => p.id === id) ? prev : [...prev, { id, label }]));
  }, []);

  const addStudent = useCallback((s: Tables<'students'>) => {
    const id = s.id;
    const label = nameStudent(s);
    setStudentPicks((prev) => (prev.some((p) => p.id === id) ? prev : [...prev, { id, label }]));
  }, []);

  const addParent = useCallback((p: Tables<'parents'>) => {
    const id = p.id;
    const label = nameParent(p);
    setParentPicks((prev) => (prev.some((x) => x.id === id) ? prev : [...prev, { id, label }]));
  }, []);

  const handleSubmit = async () => {
    if (!date || !time) {
      toast({ title: 'Missing fields', description: 'Choose date and start time.', variant: 'destructive' });
      return;
    }
    if (staffIds.length === 0) {
      toast({ title: 'Staff required', description: 'Add at least one staff member.', variant: 'destructive' });
      return;
    }
    const { startAt, endAt } = adelaideWallDateTimePlusMinutesUtcIso(date, time, durationMinutes);
    setSubmitting(true);
    try {
      const res = await fetch('/api/sessions/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_at: startAt,
          end_at: endAt,
          staff_ids: staffIds,
          student_ids: studentIds,
          parent_ids: parentIds,
        }),
      });
      const json = (await res.json()) as { session_id?: string; error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'Failed to create check-in');
      }
      if (json.session_id) {
        onCreated?.(json.session_id);
      }
      toast({ title: 'Check-in scheduled', description: 'Session was created.' });
      onClose();
    } catch (e) {
      toast({
        title: 'Could not create check-in',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule check-in</DialogTitle>
          <DialogDescription>
            Times use Australia/Adelaide. Add staff, students, and optional parents.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="checkin-date">Date</Label>
              <Input id="checkin-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkin-time">Start time</Label>
              <Input id="checkin-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="checkin-duration">Duration (minutes)</Label>
            <select
              id="checkin-duration"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
            >
              {DURATION_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Staff</Label>
            <div className="flex flex-wrap gap-1 mb-1">
              {staffPicks.map((s) => (
                <Badge key={s.id} variant="secondary" className="gap-1">
                  {s.label}
                  <button
                    type="button"
                    className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2"
                    onClick={() => setStaffPicks((ids) => ids.filter((x) => x.id !== s.id))}
                    aria-label={`Remove ${s.label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              placeholder="Search staff…"
              value={staffSearch}
              onChange={(e) => setStaffSearch(e.target.value)}
            />
            <div className="border rounded-md max-h-32 overflow-y-auto text-sm">
              {staffLoading && <div className="p-2 text-muted-foreground">Searching…</div>}
              {!staffLoading &&
                staffResults
                  .filter((s) => !staffIds.includes(s.id))
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="w-full text-left px-2 py-1.5 hover:bg-muted"
                      onClick={() => addStaff(s)}
                    >
                      {nameStaff(s)}
                    </button>
                  ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Students (optional)</Label>
            <div className="flex flex-wrap gap-1 mb-1">
              {studentPicks.map((s) => (
                <Badge key={s.id} variant="secondary" className="gap-1">
                  {s.label}
                  <button
                    type="button"
                    className="ml-1"
                    onClick={() => setStudentPicks((ids) => ids.filter((x) => x.id !== s.id))}
                    aria-label={`Remove ${s.label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              placeholder="Search students…"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
            />
            <div className="border rounded-md max-h-32 overflow-y-auto text-sm">
              {studentLoading && <div className="p-2 text-muted-foreground">Searching…</div>}
              {!studentLoading &&
                studentResults
                  .filter((s) => !studentIds.includes(s.id))
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="w-full text-left px-2 py-1.5 hover:bg-muted"
                      onClick={() => addStudent(s)}
                    >
                      {nameStudent(s)}
                    </button>
                  ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Parents (optional)</Label>
            <div className="flex flex-wrap gap-1 mb-1">
              {parentPicks.map((p) => (
                <Badge key={p.id} variant="secondary" className="gap-1">
                  {p.label}
                  <button
                    type="button"
                    className="ml-1"
                    onClick={() => setParentPicks((ids) => ids.filter((x) => x.id !== p.id))}
                    aria-label={`Remove ${p.label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              placeholder="Search parents…"
              value={parentSearch}
              onChange={(e) => setParentSearch(e.target.value)}
            />
            <div className="border rounded-md max-h-32 overflow-y-auto text-sm">
              {parentLoading && <div className="p-2 text-muted-foreground">Searching…</div>}
              {!parentLoading &&
                parentResults
                  .filter((p) => !parentIds.includes(p.id))
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-2 py-1.5 hover:bg-muted"
                      onClick={() => addParent(p)}
                    >
                      {nameParent(p)}
                    </button>
                  ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create check-in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
