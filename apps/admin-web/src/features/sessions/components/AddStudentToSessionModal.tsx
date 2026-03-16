'use client';

import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from '@altitutor/ui';
import { Loader2, Search, X, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { studentsApi } from '@/features/students/api/students';
import { cn } from '@/shared/utils';
import { StudentCard } from '@/shared/components/StudentCard';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';

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
  const [step, setStep] = useState<1 | 2>(1);
  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);

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

  const selectableStudents = useMemo(() => {
    const excluded = new Set(existingStudentIds);
    return students.filter((s) => !excluded.has(s.id));
  }, [students, existingStudentIds]);

  const selectedStudent = useMemo(
    () => selectableStudents.find((s) => s.id === selectedStudentId) || null,
    [selectableStudents, selectedStudentId]
  );

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
    if (!selectedStudent) return;
    try {
      await onConfirm(selectedStudent);
      handleClose();
    } catch {
      // Keep modal open if mutation fails so user can retry.
    }
  };

  const warningText = selectedStudent
    ? `${studentName} will only be added to a single session on ${sessionTime} ${sessionDay}, they will not be enrolled in the class`
    : '';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className={cn(
          'w-full md:max-w-3xl h-[80vh] flex flex-col p-0 [&>button]:hidden',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <div className="flex-shrink-0 border-b bg-background">
          <DialogHeader className="px-6 pt-6 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Button variant="outline" size="icon" onClick={handleClose} className="shrink-0">
                  <X className="h-4 w-4" />
                </Button>
                <div className="flex-1 min-w-0">
                  <DialogTitle>Add Student to Session</DialogTitle>
                  <DialogDescription>
                    Step {step} of 2: {step === 1 ? 'Select Student' : 'Confirm'}
                  </DialogDescription>
                </div>
                <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
              </div>
            </div>
          </DialogHeader>
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
        </div>

        <div className="flex-1 overflow-hidden min-h-0">
          <div className="h-full overflow-y-auto p-6 space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium">
                Add{' '}
                <span className={cn(
                  'inline-flex items-center px-2 py-1 rounded-md font-semibold border',
                  selectedStudent ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20'
                )}>
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
                ) : selectableStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    No students available to add
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectableStudents.map((student) => (
                      <StudentCard
                        key={student.id}
                        student={student}
                        subjects={[]}
                        showSubjects={false}
                        showActions={false}
                        isSelecting
                        isSelected={selectedStudentId === student.id}
                        onClick={() => setSelectedStudentId(student.id)}
                      />
                    ))}
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
        </div>

        <div className="flex-shrink-0 border-t bg-background px-6 py-4">
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => (step === 1 ? handleClose() : setStep(1))}>
              {step === 1 ? 'Cancel' : (
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
              <Button onClick={handleConfirm} disabled={isPending || !selectedStudent}>
                {isPending ? (
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
