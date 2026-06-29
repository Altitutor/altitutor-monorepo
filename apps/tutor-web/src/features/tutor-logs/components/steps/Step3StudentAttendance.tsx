'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Checkbox } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { SearchableSelect } from '@altitutor/ui';
import { Loader2, Plus } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import {
  useTutorLogStep3Data,
  tutorLogStep3Keys,
} from '../../hooks/useTutorLogStep3Data';
import type { SessionStudentRow } from '../../api/tutor-views';
import { tutorViewsApi } from '../../api/tutor-views';
import { sessionsApi } from '@/features/sessions/api/sessions';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/shared/utils';
import { tutorBtnOutline, tutorCardCn } from '@/shared/lib/tutor-visual';

type StudentAttendanceItem = {
  studentId: string;
  attended: boolean;
};

type Step3StudentAttendanceProps = {
  sessionId: string;
  studentAttendance: StudentAttendanceItem[];
  onUpdate: (studentAttendance: StudentAttendanceItem[]) => void;
};

export function Step3StudentAttendance({
  sessionId,
  studentAttendance,
  onUpdate,
}: Step3StudentAttendanceProps) {
  const queryClient = useQueryClient();
  const { sessionStudents, allStudents, isLoading } =
    useTutorLogStep3Data(sessionId);

  const [studentAddQuery, setStudentAddQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Tables<'students'>[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingStudentId, setAddingStudentId] = useState<string | null>(null);

  // Initialize form data if empty when data loads
  useEffect(() => {
    if (!isLoading && studentAttendance.length === 0 && sessionStudents.length > 0) {
      const initialAttendance = sessionStudents.map((ss) => ({
        studentId: ss.student_id,
        attended: !ss.planned_absence,
      }));
      onUpdate(initialAttendance);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, studentAttendance.length, sessionStudents.length]);

  const handleAttendanceChange = (studentId: string, attended: boolean) => {
    const updated = studentAttendance.map((sa) =>
      sa.studentId === studentId ? { ...sa, attended } : sa
    );

    if (!studentAttendance.find((sa) => sa.studentId === studentId)) {
      updated.push({ studentId, attended });
    }

    onUpdate(updated);
  };

  const existingStudentIds = useMemo(
    () => new Set(sessionStudents.map((ss) => ss.student_id)),
    [sessionStudents]
  );

  const localAddCandidates = useMemo(
    () => allStudents.filter((s) => !existingStudentIds.has(s.id)),
    [allStudents, existingStudentIds]
  );

  const addStudentSelectItems = useMemo(() => {
    if (!studentAddQuery.trim()) return localAddCandidates;
    if (searchResults.length > 0) return searchResults;
    const q = studentAddQuery.toLowerCase();
    return localAddCandidates.filter((s) =>
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)
    );
  }, [studentAddQuery, searchResults, localAddCandidates]);

  const handleStudentAddSearchChange = useCallback(
    async (search: string) => {
      setStudentAddQuery(search);
      if (!search.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await tutorViewsApi.searchStudents({
          search,
          limit: 50,
        });

        setSearchResults(results.filter((s) => !existingStudentIds.has(s.id)));
      } catch (error) {
        console.error('Error searching students:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [existingStudentIds]
  );

  const handleAddStudent = async (student: Tables<'students'>) => {
    const studentId = student.id;
    if (existingStudentIds.has(studentId) || addingStudentId) return;

    const attendanceSnapshot = studentAttendance;
    const nextAttendance = attendanceSnapshot.find((sa) => sa.studentId === studentId)
      ? attendanceSnapshot.map((sa) =>
          sa.studentId === studentId ? { ...sa, attended: true } : sa
        )
      : [...attendanceSnapshot, { studentId, attended: true }];

    setAddingStudentId(studentId);
    setSearchResults([]);
    setStudentAddQuery('');

    queryClient.setQueryData<SessionStudentRow[]>(
      tutorLogStep3Keys.sessionStudents(sessionId),
      (old) => {
        const current = old ?? [];
        if (current.some((row) => row.student_id === studentId)) return current;
        return [...current, { student_id: studentId, planned_absence: false }];
      }
    );

    queryClient.setQueryData<Tables<'students'>[]>(
      tutorLogStep3Keys.allStudents(),
      (old) => {
        const current = old ?? [];
        if (current.some((row) => row.id === studentId)) return current;
        return [...current, student];
      }
    );

    onUpdate(nextAttendance);

    try {
      await sessionsApi.addStudentToSession(sessionId, studentId);
      await queryClient.invalidateQueries({
        queryKey: tutorLogStep3Keys.sessionStudents(sessionId),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('already assigned')) {
        await queryClient.invalidateQueries({
          queryKey: tutorLogStep3Keys.sessionStudents(sessionId),
        });
      } else {
        console.error('Error adding student to session:', error);
        queryClient.setQueryData<SessionStudentRow[]>(
          tutorLogStep3Keys.sessionStudents(sessionId),
          (old) => old?.filter((row) => row.student_id !== studentId) ?? []
        );
        queryClient.setQueryData<Tables<'students'>[]>(
          tutorLogStep3Keys.allStudents(),
          (old) => old?.filter((row) => row.id !== studentId) ?? []
        );
        onUpdate(attendanceSnapshot);
      }
    } finally {
      setAddingStudentId(null);
    }
  };

  const getStudentAttendance = (studentId: string) => {
    return studentAttendance.find((sa) => sa.studentId === studentId);
  };

  const addStudentTrigger = (
    <Button
      variant="outline"
      className={cn(tutorBtnOutline, 'w-full sm:w-auto')}
      disabled={!!addingStudentId}
    >
      {addingStudentId ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Plus className="mr-2 h-4 w-4" />
      )}
      Add Student
    </Button>
  );

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select which students attended this session. You can also add additional students.
      </p>

      {/* Planned Students */}
      {sessionStudents.length > 0 && (
        <div className="space-y-3">
          <div className="font-medium">Students</div>
          {sessionStudents.map((ss) => {
            const student = ss.student;
            const attendance = getStudentAttendance(ss.student_id);
            const isAttended = attendance?.attended ?? !ss.planned_absence;
            const isAdding = addingStudentId === ss.student_id;

            return (
              <div key={ss.student_id} className={tutorCardCn('flex items-center gap-3 p-3')}>
                <Checkbox
                  id={`student-${ss.student_id}`}
                  checked={isAttended}
                  disabled={isAdding}
                  onCheckedChange={(checked) =>
                    handleAttendanceChange(ss.student_id, checked === true)
                  }
                />
                <Label htmlFor={`student-${ss.student_id}`} className="flex-1 cursor-pointer">
                  {student.first_name} {student.last_name}
                  {ss.planned_absence && (
                    <span className="ml-2 text-xs text-muted-foreground">(Planned Absence)</span>
                  )}
                  {student.status === 'TRIAL' && (
                    <span className="ml-2 text-xs text-muted-foreground">(Trial)</span>
                  )}
                </Label>
                {isAdding ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <SearchableSelect<Tables<'students'>>
        items={addStudentSelectItems}
        value={null}
        onValueChange={(selectedStudent) => {
          if (selectedStudent) void handleAddStudent(selectedStudent);
        }}
        getItemId={(s) => s.id}
        getItemLabel={(s) => `${s.first_name} ${s.last_name}`}
        getItemValue={(s) =>
          `${s.first_name} ${s.last_name} ${s.email ?? ''} ${s.year_level ?? ''}`.toLowerCase()
        }
        onSearchChange={handleStudentAddSearchChange}
        loading={isSearching || !!addingStudentId}
        searchPlaceholder="Search students..."
        emptyMessage={
          studentAddQuery.trim()
            ? 'No students found'
            : localAddCandidates.length === 0
              ? 'All known students are already on this session'
              : 'Browse the list or type to search'
        }
        trigger={addStudentTrigger}
        align="start"
        contentWidth="min(400px, 92vw)"
        renderItem={(student) => (
          <div className="flex w-full items-center justify-between gap-2 min-w-0">
            <span className="min-w-0 truncate">
              {student.first_name} {student.last_name}
              {student.status === 'TRIAL' && (
                <span className="ml-2 text-xs text-muted-foreground">(Trial)</span>
              )}
            </span>
            {student.year_level != null && (
              <span className="text-sm text-muted-foreground shrink-0">
                Year {student.year_level}
              </span>
            )}
          </div>
        )}
        />
      </div>
    </div>
  );
}


