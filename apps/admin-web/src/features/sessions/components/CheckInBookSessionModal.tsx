'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
  Label,
  SearchableSelect,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useToast,
} from '@altitutor/ui';
import { Loader2, MoreVertical, Trash2, X } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { getTodayAdelaideDate, adelaideWallDateTimePlusMinutesUtcIso } from '@/features/bookings/utils/dateTimeHelpers';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';
import type { CheckInModalPrefill, CheckInSessionType } from '@/shared/contexts/QuickActionsContext';
import { MeetingEntitySearchAdd } from './MeetingEntitySearchAdd';
import { AttendanceCell } from './AttendanceCell';

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

type DurationItem = { minutes: number; label: string };

const DURATION_ITEMS: DurationItem[] = DURATION_OPTIONS.map((minutes) => ({
  minutes,
  label: `${minutes} minutes`,
}));

type IdLabel = { id: string; label: string };

export type CheckInBookSessionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (sessionId: string) => void;
  sessionType?: CheckInSessionType;
  /** Applied when the dialog opens (from global quick actions or entity menus) */
  initialPrefill?: CheckInModalPrefill | null;
};

function picksFromPrefill(prefill: CheckInModalPrefill | null | undefined): {
  staff: IdLabel[];
  students: IdLabel[];
  parents: IdLabel[];
} {
  if (!prefill) {
    return { staff: [], students: [], parents: [] };
  }
  return {
    staff: (prefill.staff ?? []).map((s) => ({
      id: s.id,
      label: `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || 'Staff',
    })),
    students: (prefill.students ?? []).map((s) => ({
      id: s.id,
      label: `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || 'Student',
    })),
    parents: (prefill.parents ?? []).map((p) => ({
      id: p.id,
      label: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Parent',
    })),
  };
}

function nameStaff(s: Tables<'staff'>): string {
  return `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || 'Staff';
}

function nameStudent(s: Tables<'students'>): string {
  return `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || 'Student';
}

function nameParent(p: Tables<'parents'>): string {
  return `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Parent';
}

export function CheckInBookSessionModal({
  isOpen,
  onClose,
  onCreated,
  sessionType = 'CHECK_IN',
  initialPrefill = null,
}: CheckInBookSessionModalProps) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [staffPicks, setStaffPicks] = useState<IdLabel[]>([]);
  const [studentPicks, setStudentPicks] = useState<IdLabel[]>([]);
  const [parentPicks, setParentPicks] = useState<IdLabel[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      setExpanded(false);
      return;
    }
    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      setDate(getTodayAdelaideDate());
      setTime('09:00');
      setDurationMinutes(60);
      const { staff, students, parents } = picksFromPrefill(initialPrefill ?? null);
      setStaffPicks(staff);
      setStudentPicks(students);
      setParentPicks(parents);
    }
  }, [isOpen, initialPrefill]);

  const staffIds = staffPicks.map((p) => p.id);
  const studentIds = studentPicks.map((p) => p.id);
  const parentIds = parentPicks.map((p) => p.id);
  const canManageStudentsAndParents = sessionType !== 'ADMIN_MEETING';

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

  const durationValue =
    DURATION_ITEMS.find((d) => d.minutes === durationMinutes) ?? DURATION_ITEMS.find((d) => d.minutes === 60)!;

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
          session_type: sessionType,
          start_at: startAt,
          end_at: endAt,
          staff_ids: staffIds,
          student_ids: canManageStudentsAndParents ? studentIds : [],
          parent_ids: canManageStudentsAndParents ? parentIds : [],
        }),
      });
      const json = (await res.json()) as { session_id?: string; error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'Failed to create session');
      }
      if (json.session_id) {
        onCreated?.(json.session_id);
      }
      onClose();
    } catch (e) {
      toast({
        title: sessionType === 'ADMIN_MEETING' ? 'Could not create admin meeting' : 'Could not create check in',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'w-full md:max-w-4xl h-[90vh] flex flex-col p-0 [&>button]:hidden',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <div className="flex-shrink-0 border-b bg-background">
          <DialogHeader className="px-6 pt-6 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Button variant="outline" size="icon" onClick={onClose} className="shrink-0" type="button">
                  <X className="h-4 w-4" />
                </Button>
                <div className="flex-1 min-w-0">
                  <DialogTitle>
                    {sessionType === 'ADMIN_MEETING' ? 'Schedule admin meeting' : 'Schedule check in'}
                  </DialogTitle>
                  <DialogDescription>
                    {sessionType === 'ADMIN_MEETING'
                      ? 'Schedule an admin meeting with staff.'
                      : 'Schedule a check in with a staff member, student or parent.'}
                  </DialogDescription>
                </div>
              </div>
              <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-hidden min-h-0">
          <div className="h-full overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="checkin-date">Date</Label>
                  <Input id="checkin-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="checkin-time">Start time</Label>
                  <Input id="checkin-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="checkin-duration">Duration</Label>
                <SearchableSelect<DurationItem>
                  items={DURATION_ITEMS}
                  value={durationValue}
                  onValueChange={(item) => item && setDurationMinutes(item.minutes)}
                  getItemId={(d) => String(d.minutes)}
                  getItemLabel={(d) => d.label}
                  placeholder="Select duration"
                  searchPlaceholder="Search duration…"
                  emptyMessage="No duration matches"
                  disabled={submitting}
                  className="w-full"
                  triggerClassName="w-full"
                />
              </div>

              {canManageStudentsAndParents && (
                <>
                  <Separator />

                  <div>
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <h3 className="text-lg font-semibold">Students ({studentPicks.length})</h3>
                      <MeetingEntitySearchAdd
                        kind="student"
                        placeholder="Search students…"
                        existingIds={studentIds}
                        onPick={async (s) => {
                          addStudent(s);
                        }}
                        disabled={submitting}
                      />
                    </div>
                    {studentPicks.length === 0 ? (
                      <div className="text-center py-4 text-sm text-muted-foreground">No students added</div>
                    ) : (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student</TableHead>
                              <TableHead>Attendance</TableHead>
                              <TableHead className="w-[50px]" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {studentPicks.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell>
                                  <span className="font-medium">{row.label}</span>
                                </TableCell>
                                <TableCell>
                                  <AttendanceCell status="attending" />
                                </TableCell>
                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        disabled={submitting}
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        className="!text-destructive focus:!text-destructive focus:bg-destructive/10"
                                        onClick={() =>
                                          setStudentPicks((prev) => prev.filter((p) => p.id !== row.id))
                                        }
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Remove
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="text-lg font-semibold">Staff ({staffPicks.length})</h3>
                  <MeetingEntitySearchAdd
                    kind="staff"
                    placeholder="Search staff…"
                    existingIds={staffIds}
                    onPick={async (s) => {
                      addStaff(s);
                    }}
                    disabled={submitting}
                  />
                </div>
                {staffPicks.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">No staff added</div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Staff</TableHead>
                          <TableHead>Attendance</TableHead>
                          <TableHead className="w-[50px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staffPicks.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <span className="font-medium">{row.label}</span>
                            </TableCell>
                            <TableCell>
                              <AttendanceCell status="attending" />
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={submitting}
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="!text-destructive focus:!text-destructive focus:bg-destructive/10"
                                    onClick={() => setStaffPicks((prev) => prev.filter((p) => p.id !== row.id))}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remove
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {canManageStudentsAndParents && (
                <>
                  <Separator />

                  <div>
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <h3 className="text-lg font-semibold">Parents ({parentPicks.length})</h3>
                      <MeetingEntitySearchAdd
                        kind="parent"
                        placeholder="Search parents…"
                        existingIds={parentIds}
                        onPick={async (p) => {
                          addParent(p);
                        }}
                        disabled={submitting}
                      />
                    </div>
                    {parentPicks.length === 0 ? (
                      <div className="text-center py-4 text-sm text-muted-foreground">No parents linked</div>
                    ) : (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Parent</TableHead>
                              <TableHead>Attendance</TableHead>
                              <TableHead className="w-[50px]" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {parentPicks.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell>
                                  <span className="font-medium">{row.label}</span>
                                </TableCell>
                                <TableCell>
                                  <AttendanceCell status="attending" />
                                </TableCell>
                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        disabled={submitting}
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        className="!text-destructive focus:!text-destructive focus:bg-destructive/10"
                                        onClick={() =>
                                          setParentPicks((prev) => prev.filter((p) => p.id !== row.id))
                                        }
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Remove
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t bg-background">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {sessionType === 'ADMIN_MEETING' ? 'Create admin meeting' : 'Create check in'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
