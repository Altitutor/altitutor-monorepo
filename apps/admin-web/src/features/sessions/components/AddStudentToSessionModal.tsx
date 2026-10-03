'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  AlertDescription,
  Button,
  Input,
  useToast,
} from '@altitutor/ui';
import { Loader2, Search, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { studentsApi } from '@/features/students/api/students';
import { cn } from '@/shared/utils';
import { StudentCard } from '@/shared/components/StudentCard';
import { AdminDialogShell } from '@/shared/components';

type AddStudentToSessionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sessionTitle: string;
  sessionTime: string;
  sessionDay: string;
  existingStudentIds: string[];
  isPending?: boolean;
  onConfirm: (student: Tables<'students'>) => Promise<void>;
};

export function AddStudentToSessionModal({
  isOpen,
  onClose,
  sessionTitle,
  sessionTime,
  sessionDay,
  existingStudentIds,
  isPending = false,
  onConfirm,
}: AddStudentToSessionModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const confirmationInFlight = useRef(false);
  const pending = isPending || isConfirming;

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['add-student-to-session', isOpen, search],
    queryFn: async () => {
      const result = await studentsApi.listMinimal({
        search,
        statuses: ['ACTIVE', 'TRIAL'],
        limit: 50,
        offset: 0,
        orderBy: 'first_name',
        ascending: true,
      });
      return result.students as Tables<'students'>[];
    },
    enabled: isOpen,
    staleTime: 1000 * 30,
  });

  const existingIds = useMemo(() => new Set(existingStudentIds), [existingStudentIds]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId && !existingIds.has(s.id)) || null,
    [students, selectedStudentId, existingIds]
  );

  const handleSelect = (student: Tables<'students'>) => {
    if (existingIds.has(student.id)) {
      const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'This student';
      toast({
        title: 'Already in this session',
        description: `${name} is already in this session and cannot be added again.`,
      });
      return;
    }
    setSelectedStudentId(student.id);
  };

  const studentName = selectedStudent
    ? `${selectedStudent.first_name || ''} ${selectedStudent.last_name || ''}`.trim()
    : 'choose student';

  const canGoNext = step === 1 ? !!selectedStudent : true;

  const handleClose = () => {
    setStep(1);
    setSearch('');
    setSelectedStudentId(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!selectedStudent || isPending || confirmationInFlight.current) return;
    confirmationInFlight.current = true;
    setIsConfirming(true);
    try {
      await onConfirm(selectedStudent);
      handleClose();
    } catch {
      // Keep modal open if mutation fails so user can retry.
    } finally {
      confirmationInFlight.current = false;
      setIsConfirming(false);
    }
  };

  const warningText = selectedStudent
    ? `${studentName} will only be added to a single session on ${sessionTime} ${sessionDay}, they will not be enrolled in the class`
    : '';

  return (
    <AdminDialogShell
      fillHeight
      open={isOpen}
      onClose={handleClose}
      title="Add Student to Session"
      subtitle={`Step ${step} of 2: ${step === 1 ? 'Select Student' : 'Confirm'}`}
      contentClassName="md:max-w-3xl"
      headerExtra={
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={cn(
                  'flex-1 h-2 rounded-full transition-colors',
                  s < step ? 'bg-primary' : s === step ? 'bg-primary/50' : 'bg-muted'
                )}
              />
            ))}
          </div>
        </div>
      }
      footer={
        <div className="flex w-full justify-between">
          <Button variant="outline" onClick={() => (step === 1 ? handleClose() : setStep(1))}>
            {step === 1 ? (
              'Cancel'
            ) : (
              <span className="inline-flex items-center gap-2">
                <ChevronLeft className="h-4 w-4" />
                Back
              </span>
            )}
          </Button>

          {step === 1 ? (
            <Button onClick={() => setStep(2)} disabled={!canGoNext}>
              <span className="inline-flex items-center gap-2">
                Next
                <ChevronRight className="h-4 w-4" />
              </span>
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={pending || !selectedStudent}>
              {pending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </span>
              ) : (
                'Confirm Add Student'
              )}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm font-medium">
            Add{' '}
            <span
              className={cn(
                'inline-flex items-center px-2 py-1 rounded-md font-semibold border',
                selectedStudent
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20'
              )}
            >
              {studentName}
            </span>{' '}
            to{' '}
            <span className="inline-flex items-center px-2 py-1 rounded-md font-semibold border bg-primary/10 text-primary border-primary/20">
              {sessionTitle}
            </span>
          </p>
        </div>

        {step === 1 && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : students.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                No students available to add
              </p>
            ) : (
              <div className="space-y-2">
                {students.map((student) => {
                  const alreadyInSession = existingIds.has(student.id);
                  const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
                  return (
                    <div
                      key={student.id}
                      role="button"
                      tabIndex={0}
                      aria-label={alreadyInSession ? `${name}, already in this session` : name}
                      aria-disabled={alreadyInSession}
                      aria-pressed={alreadyInSession ? undefined : selectedStudentId === student.id}
                      className={cn(
                        'rounded-lg border outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&>div]:border-0',
                        alreadyInSession && 'cursor-not-allowed bg-muted text-muted-foreground [&>div]:bg-transparent [&_h4]:text-muted-foreground',
                      )}
                      onClick={() => handleSelect(student)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        if (!event.repeat) handleSelect(student);
                      }}
                    >
                      <StudentCard
                        student={student}
                        subjects={[]}
                        showSubjects={false}
                        showActions={false}
                        isSelecting={!alreadyInSession}
                        isSelected={!alreadyInSession && selectedStudentId === student.id}
                      />
                      {alreadyInSession && (
                        <p className="pb-3 pl-16 pr-3 text-xs font-medium text-muted-foreground">
                          Already in this session
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{warningText}</AlertDescription>
          </Alert>
        )}
      </div>
    </AdminDialogShell>
  );
}
