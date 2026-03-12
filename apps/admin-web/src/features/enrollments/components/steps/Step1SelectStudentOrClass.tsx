'use client';

import { Input } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { Checkbox } from '@altitutor/ui';
import { Loader2, Search, Filter, X } from 'lucide-react';
import { StudentCard } from '@/shared/components/StudentCard';
import { ClassCard } from '@/shared/components/ClassCard';
import { getDayOfWeek } from '@/shared/utils/datetime';
import { cn } from '@/shared/utils';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import type { EnrollmentContext, StudentWithEnrollmentInfo } from '../../types/enrollment';
import type { ClassConflictInfo } from '../../hooks/useClassConflicts';

interface Step1SelectStudentOrClassProps {
  context: EnrollmentContext;
  isFetching: boolean;
  
  // Class context props
  classData?: Tables<'classes'>;
  classSubject?: Tables<'subjects'>;
  classStaff?: Tables<'staff'>[];
  
  // Student context props
  student?: Tables<'students'>;
  studentSubjects?: Tables<'subjects'>[];
  
  // Data
  filteredStudents: StudentWithEnrollmentInfo[];
  filteredClasses: ClassWithExpandedSubject[];
  availableDays: number[];
  
  // Selection
  selectedStudentId: string | null;
  selectedClassId: string | null;
  onSelectStudent: (studentId: string) => void;
  onSelectClass: (classId: string) => void;
  
  // Filters
  searchQuery: string;
  dayFilters: number[];
  onSearchChange: (query: string) => void;
  onToggleDay: (day: number) => void;
  onClearFilters: () => void;
  
  // Warning handling
  onStudentClick: (student: StudentWithEnrollmentInfo) => void;
  
  // Conflict information (for student context)
  classConflicts?: Map<string, ClassConflictInfo>;
}

export function Step1SelectStudentOrClass({
  context,
  isFetching,
  classData,
  classSubject,
  classStaff: _classStaff,
  student,
  studentSubjects: _studentSubjects,
  filteredStudents,
  filteredClasses,
  availableDays,
  selectedStudentId,
  selectedClassId,
  onSelectStudent: _onSelectStudent,
  onSelectClass,
  searchQuery,
  dayFilters,
  onSearchChange,
  onToggleDay,
  onClearFilters,
  onStudentClick,
  classConflicts,
}: Step1SelectStudentOrClassProps) {
  // Get student name for info card
  const studentName = context === 'class' 
    ? (selectedStudentId && filteredStudents.find(s => s.id === selectedStudentId)
        ? `${filteredStudents.find(s => s.id === selectedStudentId)!.first_name} ${filteredStudents.find(s => s.id === selectedStudentId)!.last_name}`
        : 'choose student')
    : (student 
        ? `${student.first_name} ${student.last_name}`
        : 'choose student');

  // Get class name for info card
  const className = context === 'student'
    ? (selectedClassId && filteredClasses.find(c => c.id === selectedClassId)
        ? (filteredClasses.find(c => c.id === selectedClassId)?.long_name?.trim() ?? '')
        : 'choose class')
    : (classData && classSubject
        ? (classData.long_name?.trim() ?? '')
        : 'choose class');

  const isStudentChosen = studentName !== 'choose student';
  const isClassChosen = className !== 'choose class';

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      {/* Info Card */}
      <div className="mb-4 p-4 bg-muted rounded-lg">
        <p className="text-sm font-medium">
          Enroll{' '}
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
            isStudentChosen
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20"
          )}>
            {studentName}
          </span>{' '}
          in{' '}
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
            isClassChosen
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20"
          )}>
            {className}
          </span>
        </p>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={context === 'class' ? 'Search students...' : 'Search by day, time, staff, or student...'}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Filters */}
      {context === 'student' && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Filter className="h-3 w-3" />
            <span>Filters:</span>
          </div>
          
          {/* Day Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                Day {dayFilters.length > 0 && `(${dayFilters.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="start">
              <div className="space-y-2">
                <div className="font-medium text-sm">Days</div>
                <div className="space-y-2">
                  {availableDays.map(day => (
                    <label key={day} className="flex items-center space-x-2 cursor-pointer">
                      <Checkbox
                        checked={dayFilters.includes(day)}
                        onCheckedChange={() => onToggleDay(day)}
                      />
                      <span className="text-sm">{getDayOfWeek(day)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Clear Filters */}
          {(dayFilters.length > 0 || searchQuery.trim()) && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs" 
              onClick={onClearFilters}
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0">
        {isFetching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : context === 'class' ? (
          <div className="space-y-2">
            {filteredStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No students found
              </p>
            ) : (
              filteredStudents.map((s) => {
                const isGreyedOut = s.isAlreadyEnrolled || false;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "relative",
                      isGreyedOut && "opacity-50"
                    )}
                  >
                    <StudentCard
                      student={s}
                      subjects={s.subjects || []}
                      isSelecting
                      isSelected={selectedStudentId === s.id}
                      onClick={() => onStudentClick(s)}
                    />
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No classes found
              </p>
            ) : (
              filteredClasses.map((c) => {
                const conflictInfo = classConflicts?.get(c.id);
                const hasConflict = !!conflictInfo;
                
                return (
                  <div
                    key={c.id}
                    className="relative"
                  >
                    {hasConflict && conflictInfo && (
                      <div className="absolute bottom-2 left-2 right-2 z-20 pointer-events-none">
                        <div className="bg-red-500 text-white text-xs px-2 py-1 rounded shadow-sm">
                          Conflict with {(conflictInfo.conflictingClass as { long_name?: string | null }).long_name?.trim() ?? ''}
                        </div>
                      </div>
                    )}
                    <ClassCard
                      class={c}
                      subject={c.subject}
                      staff={c.staff || []}
                      students={c.students || []}
                      isSelecting
                      isSelected={selectedClassId === c.id}
                      onClick={() => onSelectClass(c.id)}
                    />
                  </div>
                );
              })
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

