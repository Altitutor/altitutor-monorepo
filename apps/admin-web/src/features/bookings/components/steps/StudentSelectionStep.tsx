import { Input, Label } from '@altitutor/ui';
import { Search, Loader2 } from 'lucide-react';
import { StudentCard } from '@/shared/components/StudentCard';
import type { Tables } from '@altitutor/shared';

interface StudentSelectionStepProps {
  studentSearch: string;
  onSearchChange: (value: string) => void;
  students: Tables<'students'>[] | undefined;
  isLoading: boolean;
  selectedStudentId: string;
  onSelectStudent: (studentId: string) => void;
}

export function StudentSelectionStep({
  studentSearch,
  onSearchChange,
  students,
  isLoading,
  selectedStudentId,
  onSelectStudent,
}: StudentSelectionStepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="student-search">Search Student</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="student-search"
            value={studentSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Type student name or email..."
            className="pl-10"
          />
        </div>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : students && students.length > 0 ? (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {students.map((student) => (
            <div
              key={student.id}
              onClick={() => onSelectStudent(student.id)}
            >
              <StudentCard
                student={student}
                isSelecting={true}
                isSelected={selectedStudentId === student.id}
                showSubjects={false}
                showActions={false}
              />
            </div>
          ))}
        </div>
      ) : studentSearch.length >= 2 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No students found</p>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p>Type at least 2 characters to search</p>
        </div>
      )}
    </div>
  );
}
