'use client';

import { useState, useEffect, useRef } from 'react';
import { Checkbox } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { X, Search, Plus } from 'lucide-react';
import { StudentCard } from '@/shared/components/StudentCard';
import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { cn } from '@/shared/utils/index';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

type StudentAttendanceItem = {
  studentId: string;
  attended: boolean;
};

type Step3StudentAttendanceProps = {
  title?: string;
  sessionId: string;
  studentAttendance: StudentAttendanceItem[];
  onUpdate: (studentAttendance: StudentAttendanceItem[]) => void;
};

export function Step3StudentAttendance({
  title,
  sessionId,
  studentAttendance,
  onUpdate,
}: Step3StudentAttendanceProps) {
  const [sessionStudents, setSessionStudents] = useState<
    Array<Tables<'sessions_students'> & { student: Tables<'students'> }>
  >([]);
  const [allStudents, setAllStudents] = useState<Tables<'students'>[]>([]);
  const [additionalStudents, setAdditionalStudents] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const hasInitialized = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      
      // Get session students
      const { data: ssData, error: ssError } = await supabase
        .from('sessions_students')
        .select('*, student:students(*)')
        .eq('session_id', sessionId);

      if (ssError) {
        console.error('Error fetching session students:', ssError);
        return;
      }

      setSessionStudents(ssData as any);

      // Get all students for search
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .order('first_name');

      if (studentsError) {
        console.error('Error fetching students:', studentsError);
        return;
      }

      setAllStudents(studentsData as Tables<'students'>[]);

      setIsLoading(false);
    };

    fetchData();
  }, [sessionId]);

  // Initialize form data if empty (separate effect to avoid setState during render)
  useEffect(() => {
    if (!hasInitialized.current && studentAttendance.length === 0 && sessionStudents.length > 0 && !isLoading) {
      hasInitialized.current = true;
      const initialAttendance = sessionStudents.map((ss: any) => ({
        studentId: ss.student_id,
        attended: !ss.planned_absence,
      }));
      onUpdate(initialAttendance);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStudents.length, isLoading]); // Only depend on sessionStudents.length and isLoading

  const handleAttendanceChange = (studentId: string, attended: boolean) => {
    const updated = studentAttendance.map((sa) =>
      sa.studentId === studentId ? { ...sa, attended } : sa
    );

    if (!studentAttendance.find((sa) => sa.studentId === studentId)) {
      updated.push({ studentId, attended });
    }

    onUpdate(updated);
  };

  const handleAddStudent = (studentId: string) => {
    if (!additionalStudents.includes(studentId)) {
      setAdditionalStudents([...additionalStudents, studentId]);
      handleAttendanceChange(studentId, true);
    }
    setSearchTerm('');
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
      sessionStudents.some((ss: any) => ss.student_id === studentId) ||
      additionalStudents.includes(studentId)
    );
  };

  const filteredStudents = allStudents.filter(
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
      {title && <h2 className="text-xl font-semibold">{title}</h2>}
      <p className="text-sm text-muted-foreground">
        Select which students attended this session. You can also add additional students.
      </p>

      {/* Planned Students */}
      {sessionStudents.length > 0 && (
        <div className="space-y-3">
          <div className="font-medium">Planned Students</div>
          {sessionStudents.map((ss: any) => {
            const student = ss.student;
            const attendance = getStudentAttendance(ss.student_id);
            const isAttended = attendance?.attended ?? !ss.planned_absence;
            const isExtra = ss.is_extra;

            return (
              <div key={ss.student_id} className="flex items-center gap-3">
                {isExtra ? (
                  <div className="w-6 h-6 flex items-center justify-center text-red-600">
                    <X className="h-5 w-5" />
                  </div>
                ) : (
                  <Checkbox
                    id={`student-${ss.student_id}`}
                    checked={isAttended}
                    onCheckedChange={(checked) =>
                      handleAttendanceChange(ss.student_id, checked === true)
                    }
                  />
                )}
                <div className="flex-1">
                  <StudentCard
                    student={student}
                    showSubjects={false}
                    showActions={false}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Additional Students */}
      {additionalStudents.length > 0 && (
        <div className="space-y-3">
          <div className="font-medium">Additional Students</div>
          {additionalStudents.map((studentId) => {
            const student = allStudents.find((s) => s.id === studentId);
            if (!student) return null;

            return (
              <div key={studentId} className="flex items-center gap-3">
                <Checkbox
                  id={`student-${studentId}`}
                  checked={getStudentAttendance(studentId)?.attended ?? true}
                  onCheckedChange={(checked) =>
                    handleAttendanceChange(studentId, checked === true)
                  }
                />
                <div className="flex-1">
                  <StudentCard
                    student={student}
                    showSubjects={false}
                    showActions={false}
                  />
                </div>
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
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
          
          <div className="max-h-60 overflow-y-auto space-y-1">
            {filteredStudents.map((student) => (
              <button
                key={student.id}
                type="button"
                onClick={() => handleAddStudent(student.id)}
                className="w-full text-left p-2 hover:bg-brand-lightBlue/10 dark:hover:bg-brand-dark-card/70 rounded-md transition-colors flex justify-between items-center"
              >
                <span>
                  {student.first_name} {student.last_name}
                </span>
                {student.year_level != null && (
                  <span className="text-sm text-muted-foreground">Year {student.year_level}</span>
                )}
              </button>
            ))}
            {filteredStudents.length === 0 && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No students found
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


