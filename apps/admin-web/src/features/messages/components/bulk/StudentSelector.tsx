'use client';

import { useState } from 'react';
import { X, Plus, Calendar as CalendarIcon } from 'lucide-react';
import { Button, Badge, ScrollArea, Calendar, Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { format } from 'date-fns';
import { StudentCard } from '@/shared/components/StudentCard';
import type { Tables } from '@altitutor/shared';
import {
  getAllSubjects,
  getAllClasses,
  getStudentsBySubject,
  getStudentsByClass,
  getStudentsByYearLevel,
  getStudentsBySessionDate,
} from '../../api/bulk';
import { formatSubjectDisplay, formatClassName } from '@/shared/utils';
import { useQuery } from '@tanstack/react-query';

interface StudentSelectorProps {
  selectedStudents: Tables<'students'>[];
  onStudentsChange: (students: Tables<'students'>[]) => void;
  onNext: () => void;
}

export function StudentSelector({ selectedStudents, onStudentsChange, onNext }: StudentSelectorProps) {
  const [filterType, setFilterType] = useState<'subject' | 'class' | 'year' | 'session' | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number | ''>('');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [isLoading, setIsLoading] = useState(false);

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-all'],
    queryFn: getAllSubjects,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-all'],
    queryFn: getAllClasses,
  });

  const handleAddByFilter = async () => {
    setIsLoading(true);
    try {
      let newStudents: Tables<'students'>[] = [];

      if (filterType === 'subject' && selectedSubject) {
        newStudents = await getStudentsBySubject(selectedSubject);
      } else if (filterType === 'class' && selectedClass) {
        newStudents = await getStudentsByClass(selectedClass);
      } else if (filterType === 'year' && selectedYear) {
        newStudents = await getStudentsByYearLevel(selectedYear as number);
      } else if (filterType === 'session' && selectedDate) {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        newStudents = await getStudentsBySessionDate(dateStr);
      }

      // Merge with existing, deduplicate by ID
      const existingIds = new Set(selectedStudents.map(s => s.id));
      const uniqueNewStudents = newStudents.filter(s => !existingIds.has(s.id));
      onStudentsChange([...selectedStudents, ...uniqueNewStudents]);

      // Reset filter
      setFilterType(null);
      setSelectedSubject('');
      setSelectedClass('');
      setSelectedYear('');
      setSelectedDate(undefined);
    } catch (error) {
      console.error('Error adding students by filter:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveStudent = (studentId: string) => {
    onStudentsChange(selectedStudents.filter(s => s.id !== studentId));
  };

  const yearLevels = [7, 8, 9, 10, 11, 12, 13];

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold">Select Students</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose filters to add students to your bulk message list
        </p>
      </div>

      <div className="p-6 border-b space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterType === 'subject' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('subject')}
          >
            By Subject
          </Button>
          <Button
            variant={filterType === 'class' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('class')}
          >
            By Class
          </Button>
          <Button
            variant={filterType === 'year' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('year')}
          >
            By Year Level
          </Button>
          <Button
            variant={filterType === 'session' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('session')}
          >
            By Session Date
          </Button>
        </div>

        {filterType === 'subject' && (
          <div className="flex gap-2">
            <select
              className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              <option value="">Select a subject...</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {formatSubjectDisplay(subject)}
                </option>
              ))}
            </select>
            <Button
              onClick={handleAddByFilter}
              disabled={!selectedSubject || isLoading}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        )}

        {filterType === 'class' && (
          <div className="flex gap-2">
            <select
              className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="">Select a class...</option>
              {classes.map(({ class: cls, subject }) => (
                <option key={cls.id} value={cls.id}>
                  {formatClassName(cls, subject)}
                </option>
              ))}
            </select>
            <Button
              onClick={handleAddByFilter}
              disabled={!selectedClass || isLoading}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        )}

        {filterType === 'year' && (
          <div className="flex gap-2">
            <select
              className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Select a year level...</option>
              {yearLevels.map((year) => (
                <option key={year} value={year}>
                  Year {year}
                </option>
              ))}
            </select>
            <Button
              onClick={handleAddByFilter}
              disabled={!selectedYear || isLoading}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        )}

        {filterType === 'session' && (
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button
              onClick={handleAddByFilter}
              disabled={!selectedDate || isLoading}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 p-6 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">
            Selected Students ({selectedStudents.length})
          </h3>
          {selectedStudents.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onStudentsChange([])}
            >
              Clear All
            </Button>
          )}
        </div>

        {selectedStudents.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No students selected. Use filters above to add students.
          </div>
        ) : (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-2">
              {selectedStudents.map((student) => (
                <div key={student.id} className="relative">
                  <StudentCard student={student} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => handleRemoveStudent(student.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <div className="p-6 border-t flex justify-end">
        <Button
          onClick={onNext}
          disabled={selectedStudents.length === 0}
        >
          Next
        </Button>
      </div>
    </div>
  );
}



