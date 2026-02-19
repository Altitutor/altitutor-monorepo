'use client';

import { useState, useEffect } from 'react';
import { Checkbox } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Plus, X, Search } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { useTutorLogStep3Data } from '../../hooks/useTutorLogStep3Data';
import { tutorViewsApi } from '../../api/tutor-views';
import { tutorLogStep3Keys } from '../../hooks/useTutorLogStep3Data';
import { sessionsApi } from '@/features/sessions/api/sessions';
import { useQueryClient } from '@tanstack/react-query';
import { sessionsKeys } from '@/features/sessions/hooks/useSessionsQuery';

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

  const [additionalStudents, setAdditionalStudents] = useState<string[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Tables<'students'>[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // Cache of students we've searched for, so we can display them even if not in allStudents
  const [searchedStudentsCache, setSearchedStudentsCache] = useState<Map<string, Tables<'students'>>>(new Map());

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

  // Sync additionalStudents: remove students that are now in sessionStudents
  useEffect(() => {
    if (!isLoading && sessionStudents.length > 0 && additionalStudents.length > 0) {
      const sessionStudentIds = new Set(sessionStudents.map((ss) => ss.student_id));
      const stillAdditional = additionalStudents.filter((id) => !sessionStudentIds.has(id));
      if (stillAdditional.length !== additionalStudents.length) {
        setAdditionalStudents(stillAdditional);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, sessionStudents, additionalStudents.length]);

  const handleAttendanceChange = (studentId: string, attended: boolean) => {
    const updated = studentAttendance.map((sa) =>
      sa.studentId === studentId ? { ...sa, attended } : sa
    );

    if (!studentAttendance.find((sa) => sa.studentId === studentId)) {
      updated.push({ studentId, attended });
    }

    onUpdate(updated);
  };

  const handleSearchStudents = async (search: string) => {
    setSearchTerm(search);
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
      // Cache all searched students so we can display them later
      const newCache = new Map(searchedStudentsCache);
      results.forEach((student) => {
        newCache.set(student.id, student);
      });
      setSearchedStudentsCache(newCache);
      
      // Filter out students already in session or already added
      const existingStudentIds = new Set([
        ...sessionStudents.map((ss) => ss.student_id),
        ...additionalStudents,
      ]);
      setSearchResults(results.filter((s) => !existingStudentIds.has(s.id)));
    } catch (error) {
      console.error('Error searching students:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddStudent = async (studentId: string) => {
    if (!additionalStudents.includes(studentId)) {
      // Add student to session via API
      try {
        await sessionsApi.addStudentToSession(sessionId, studentId);
        // Invalidate session data to refetch with new student
        queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(sessionId) });
        // Also invalidate session students query
        queryClient.invalidateQueries({ queryKey: tutorLogStep3Keys.sessionStudents(sessionId) });
      } catch (error) {
        console.error('Error adding student to session:', error);
        // Still allow adding to attendance even if API call fails
        // (student might already be in session)
      }
      
      setAdditionalStudents([...additionalStudents, studentId]);
      handleAttendanceChange(studentId, true);
    }
    setSearchTerm('');
    setSearchResults([]);
    setShowSearch(false);
  };

  const handleRemoveStudent = (studentId: string) => {
    setAdditionalStudents(additionalStudents.filter((id) => id !== studentId));
    onUpdate(studentAttendance.filter((sa) => sa.studentId !== studentId));
  };

  const getStudentAttendance = (studentId: string) => {
    return studentAttendance.find((sa) => sa.studentId === studentId);
  };

  const isStudentAlreadyAdded = (studentId: string) => {
    return (
      sessionStudents.some((ss) => ss.student_id === studentId) ||
      additionalStudents.includes(studentId)
    );
  };

  // Use search results if available, otherwise filter from allStudents
  const filteredStudents = searchTerm.trim() && searchResults.length > 0
    ? searchResults
    : allStudents.filter(
        (student) =>
          !isStudentAlreadyAdded(student.id) &&
          (searchTerm === '' ||
            `${student.first_name} ${student.last_name}`
              .toLowerCase()
              .includes(searchTerm.toLowerCase()))
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
          <div className="font-medium">Planned Students</div>
          {sessionStudents.map((ss) => {
            const student = ss.student;
            const attendance = getStudentAttendance(ss.student_id);
            const isAttended = attendance?.attended ?? !ss.planned_absence;

            return (
              <div key={ss.student_id} className="flex items-center gap-3 p-3 border rounded-md">
                <Checkbox
                  id={`student-${ss.student_id}`}
                  checked={isAttended}
                  onCheckedChange={(checked) =>
                    handleAttendanceChange(ss.student_id, checked === true)
                  }
                />
                <Label htmlFor={`student-${ss.student_id}`} className="flex-1 cursor-pointer">
                  {student.first_name} {student.last_name}
                  {ss.planned_absence && (
                    <span className="ml-2 text-xs text-muted-foreground">(Planned Absence)</span>
                  )}
                </Label>
              </div>
            );
          })}
        </div>
      )}

      {/* Additional Students */}
      {additionalStudents.length > 0 && (
        <div className="space-y-3">
          <div className="font-medium">Additional Students</div>
          {additionalStudents
            .filter((studentId) => {
              // Only show if student is not already in sessionStudents
              // (they might have been added to session via API and now appear there)
              return !sessionStudents.some((ss) => ss.student_id === studentId);
            })
            .map((studentId) => {
              // Try to find student in allStudents first, then in cache
              let student = allStudents.find((s) => s.id === studentId);
              if (!student) {
                student = searchedStudentsCache.get(studentId);
              }
              if (!student) return null;

              return (
                <div key={studentId} className="flex items-center gap-3 p-3 border rounded-md bg-blue-50/50 dark:bg-blue-900/10">
                  <Checkbox
                    id={`student-${studentId}`}
                    checked={!!(getStudentAttendance(studentId)?.attended ?? true)}
                    onCheckedChange={(checked) =>
                      handleAttendanceChange(studentId, checked === true)
                    }
                  />
                  <Label htmlFor={`student-${studentId}`} className="flex-1 cursor-pointer">
                    {student.first_name} {student.last_name}
                    {student.status === 'TRIAL' && (
                      <span className="ml-2 text-xs text-muted-foreground">(Trial)</span>
                    )}
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveStudent(studentId)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
        </div>
      )}

      {/* Add Student Button */}
      {!showSearch && (
        <Button variant="outline" onClick={() => setShowSearch(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Student
        </Button>
      )}

      {/* Search Interface */}
      {showSearch && (
        <div className="space-y-2 border rounded-md p-4 bg-muted/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => handleSearchStudents(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
          
          <div className="max-h-60 overflow-y-auto space-y-1">
            {isSearching ? (
              <div className="text-center py-4 text-muted-foreground text-sm">Searching...</div>
            ) : filteredStudents.length > 0 ? (
              filteredStudents.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => handleAddStudent(student.id)}
                  className="w-full text-left p-2 hover:bg-accent rounded-md transition-colors flex justify-between items-center"
                >
                  <span>
                    {student.first_name} {student.last_name}
                    {student.status === 'TRIAL' && (
                      <span className="ml-2 text-xs text-muted-foreground">(Trial)</span>
                    )}
                  </span>
                  {student.year_level != null && (
                    <span className="text-sm text-muted-foreground">Year {student.year_level}</span>
                  )}
                </button>
              ))
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                {searchTerm ? 'No students found' : 'Start typing to search for students'}
              </div>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={() => setShowSearch(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}


