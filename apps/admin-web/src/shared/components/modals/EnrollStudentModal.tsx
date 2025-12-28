'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { Alert, AlertDescription } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { Checkbox } from '@altitutor/ui';
import { Loader2, Search, ChevronLeft, ChevronRight, AlertTriangle, Calendar as CalendarIcon, Filter, X } from 'lucide-react';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import { StudentCard } from '../StudentCard';
import { ClassCard } from '../ClassCard';
import { calculateFirstSessionDate, formatSessionDateTime } from '@/shared/utils/schedule';
import { getEnrollmentConflicts, getMidnightAdelaide } from '@/shared/utils/enrollment';
import { getDayOfWeek } from '@/shared/utils/datetime';
import { formatSubjectDisplay } from '@/shared/utils';
import { cn } from '@/shared/utils';

type EnrollmentContext = 'class' | 'student';

interface EnrollStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: EnrollmentContext;
  
  // When context is 'class'
  classData?: Tables<'classes'>;
  classSubject?: Tables<'subjects'>;
  classStaff?: Tables<'staff'>[];
  enrolledStudentIds?: string[];
  
  // When context is 'student'
  student?: Tables<'students'>;
  studentSubjects?: Tables<'subjects'>[];
  enrolledClassIds?: string[];
  
  // Data fetching
  onFetchStudents?: () => Promise<Array<Tables<'students'> & { subjects?: Tables<'subjects'>[] }>>;
  onFetchClasses?: () => Promise<ClassWithExpandedSubject[]>;
  
  // Enrollment handler
  onEnroll: (params: {
    studentId: string;
    classId: string;
    enrolledAt: Date;
    staffId: string;
  }) => Promise<void>;
  
  currentStaffId: string;
}

export function EnrollStudentModal({
  isOpen,
  onClose,
  context,
  classData,
  classSubject,
  classStaff = [],
  enrolledStudentIds = [],
  student,
  studentSubjects = [],
  enrolledClassIds = [],
  onFetchStudents,
  onFetchClasses,
  onEnroll,
  currentStaffId
}: EnrollStudentModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [enrollmentDate, setEnrollmentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [yearLevelFilters, setYearLevelFilters] = useState<number[]>([]);
  const [subjectFilters, setSubjectFilters] = useState<string[]>([]);
  const [dayFilters, setDayFilters] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  
  // Data state
  const [students, setStudents] = useState<Array<Tables<'students'> & { subjects?: Tables<'subjects'>[] }>>([]);
  const [classes, setClasses] = useState<ClassWithExpandedSubject[]>([]);
  
  // Conflicts
  const [conflicts, setConflicts] = useState<{
    sameSubjectWarning: string | null;
    timeOverlapWarnings: string[];
  }>({ sameSubjectWarning: null, timeOverlapWarnings: [] });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) return;
    
    setStep(1);
    setSelectedStudentId(null);
    setSelectedClassId(null);
    setEnrollmentDate(new Date().toISOString().split('T')[0]);
    setSearchQuery('');
    setConflicts({ sameSubjectWarning: null, timeOverlapWarnings: [] });
    
    // Set default filters based on context
    if (context === 'class' && classSubject) {
      if (classSubject.year_level) {
        setYearLevelFilters([classSubject.year_level]);
      }
      setSubjectFilters([classSubject.id]);
    } else if (context === 'student' && student) {
      if (student.year_level) {
        setYearLevelFilters([student.year_level]);
      }
      // For students, filter by subjects with no enrollment (will be handled in filtering logic)
      const studentSubjectIds = studentSubjects.map(s => s.id);
      setSubjectFilters(studentSubjectIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen && step === 1) {
      if (context === 'class' && onFetchStudents) {
        setIsFetching(true);
        onFetchStudents()
          .then(setStudents)
          .finally(() => setIsFetching(false));
      } else if (context === 'student' && onFetchClasses) {
        setIsFetching(true);
        onFetchClasses()
          .then(setClasses)
          .finally(() => setIsFetching(false));
      }
    }
  }, [isOpen, step, context, onFetchStudents, onFetchClasses]);

  // Check for conflicts when moving to summary
  useEffect(() => {
    if (step === 3 && selectedStudentId && selectedClassId) {
      const finalStudentId = context === 'student' ? student!.id : selectedStudentId;
      const finalClassId = context === 'class' ? classData!.id : selectedClassId;
      
      getEnrollmentConflicts(
        finalStudentId,
        finalClassId,
        getMidnightAdelaide(new Date(enrollmentDate))
      ).then(setConflicts);
    }
  }, [step, selectedStudentId, selectedClassId, enrollmentDate, context, student, classData]);

  // Filter logic
  const filteredStudents = useMemo(() => {
    if (context !== 'class') return [];
    
    return students.filter(s => {
      // Exclude already enrolled students
      if (enrolledStudentIds.includes(s.id)) return false;
      
      // Year level filter
      if (yearLevelFilters.length > 0 && s.year_level && !yearLevelFilters.includes(s.year_level)) {
        return false;
      }
      
      // Subject filter (AND logic - student must have ALL selected subjects)
      if (subjectFilters.length > 0) {
        const studentSubjectIds = s.subjects?.map(sub => sub.id) || [];
        const hasAllSubjects = subjectFilters.every(filterId => 
          studentSubjectIds.includes(filterId)
        );
        if (!hasAllSubjects) return false;
      }
      
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
        if (!fullName.includes(query)) return false;
      }
      
      return true;
    });
  }, [students, enrolledStudentIds, yearLevelFilters, subjectFilters, searchQuery, context]);

  const filteredClasses = useMemo(() => {
    if (context !== 'student') return [];
    
    return classes.filter(c => {
      // Exclude already enrolled classes
      if (enrolledClassIds.includes(c.id)) return false;
      
      // Year level filter
      if (yearLevelFilters.length > 0 && c.subject?.year_level) {
        if (!yearLevelFilters.includes(c.subject.year_level)) return false;
      }
      
      // Subject filter (OR logic)
      if (subjectFilters.length > 0 && c.subject_id) {
        if (!subjectFilters.includes(c.subject_id)) return false;
      }
      
      // Day filter
      if (dayFilters.length > 0) {
        if (!dayFilters.includes(c.day_of_week)) return false;
      }
      
      // Search filter
      if (searchQuery.trim() && c.subject) {
        const query = searchQuery.toLowerCase();
        const subjectName = c.subject.name.toLowerCase();
        if (!subjectName.includes(query)) return false;
      }
      
      return true;
    });
  }, [classes, enrolledClassIds, yearLevelFilters, subjectFilters, dayFilters, searchQuery, context]);

  // Get available filter options
  const availableYearLevels = useMemo(() => {
    const levels = new Set<number>();
    if (context === 'class') {
      students.forEach(s => s.year_level && levels.add(s.year_level));
    } else {
      classes.forEach(c => c.subject?.year_level && levels.add(c.subject.year_level));
    }
    return Array.from(levels).sort((a, b) => a - b);
  }, [students, classes, context]);

  const availableSubjects = useMemo(() => {
    const subjectMap = new Map<string, Tables<'subjects'>>();
    if (context === 'class') {
      students.forEach(s => {
        s.subjects?.forEach(sub => {
          if (!subjectMap.has(sub.id)) {
            subjectMap.set(sub.id, sub);
          }
        });
      });
    } else {
      classes.forEach(c => {
        if (c.subject && !subjectMap.has(c.subject.id)) {
          subjectMap.set(c.subject.id, c.subject);
        }
      });
    }
    return Array.from(subjectMap.values());
  }, [students, classes, context]);

  const availableDays = useMemo(() => {
    if (context !== 'student') return [];
    const days = new Set<number>();
    classes.forEach(c => days.add(c.day_of_week));
    return Array.from(days).sort((a, b) => a - b);
  }, [classes, context]);

  // Filter handlers
  const toggleYearLevel = (level: number) => {
    setYearLevelFilters(prev => 
      prev.includes(level) 
        ? prev.filter(l => l !== level)
        : [...prev, level]
    );
  };

  const toggleSubject = (subjectId: string) => {
    setSubjectFilters(prev => 
      prev.includes(subjectId) 
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const toggleDay = (day: number) => {
    setDayFilters(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const clearFilters = () => {
    setYearLevelFilters([]);
    setSubjectFilters([]);
    setDayFilters([]);
  };

  const handleNext = () => {
    if (step === 1 && (selectedStudentId || selectedClassId)) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as 1 | 2);
    }
  };

  const handleConfirm = async () => {
    const finalStudentId = context === 'student' ? student!.id : selectedStudentId;
    const finalClassId = context === 'class' ? classData!.id : selectedClassId;
    
    if (!finalStudentId || !finalClassId) return;
    
    setIsEnrolling(true);
    try {
      await onEnroll({
        studentId: finalStudentId,
        classId: finalClassId,
        enrolledAt: getMidnightAdelaide(new Date(enrollmentDate)),
        staffId: currentStaffId
      });
      onClose();
    } catch (error) {
      console.error('Error enrolling student:', error);
    } finally {
      setIsEnrolling(false);
    }
  };

  // Get selected data for display
  const selectedStudent = context === 'student' 
    ? student 
    : students.find(s => s.id === selectedStudentId);
  
  const selectedClass: ClassWithExpandedSubject | undefined = context === 'class'
    ? classData ? {
        ...classData,
        subject: classSubject,
        staff: classStaff,
        students: []
      } as ClassWithExpandedSubject
    : undefined
    : classes.find(c => c.id === selectedClassId);

  // Calculate first session date
  const firstSessionDate = selectedClass && enrollmentDate && selectedClass.day_of_week !== undefined && selectedClass.start_time
    ? calculateFirstSessionDate(
        { day_of_week: selectedClass.day_of_week, start_time: selectedClass.start_time },
        getMidnightAdelaide(new Date(enrollmentDate))
      )
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {context === 'class' ? 'Enroll Student in Class' : 'Enroll Student in Class'}
          </DialogTitle>
          <DialogDescription>
            {context === 'class' 
              ? 'Select a student to enroll in this class. They will be added to all future sessions.'
              : 'Select a class to enroll the student in. They will be added to all future sessions.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Select Student or Class */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={context === 'class' ? 'Search students...' : 'Search classes...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Filter className="h-3 w-3" />
                <span>Filters:</span>
              </div>
              
              {/* Year Level Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    Year Level {yearLevelFilters.length > 0 && `(${yearLevelFilters.length})`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56" align="start">
                  <div className="space-y-2">
                    <div className="font-medium text-sm">Year Levels</div>
                    <ScrollArea className="max-h-60">
                      <div className="space-y-2">
                        {availableYearLevels.map(level => (
                          <label key={level} className="flex items-center space-x-2 cursor-pointer">
                            <Checkbox
                              checked={yearLevelFilters.includes(level)}
                              onCheckedChange={() => toggleYearLevel(level)}
                            />
                            <span className="text-sm">Year {level}</span>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Subject Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    Subject {subjectFilters.length > 0 && `(${subjectFilters.length})`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="start">
                  <div className="space-y-2">
                    <div className="font-medium text-sm">Subjects</div>
                    <ScrollArea className="max-h-60">
                      <div className="space-y-2">
                        {availableSubjects.map(subject => (
                          <label key={subject.id} className="flex items-center space-x-2 cursor-pointer">
                            <Checkbox
                              checked={subjectFilters.includes(subject.id)}
                              onCheckedChange={() => toggleSubject(subject.id)}
                            />
                            <span className="text-sm">{formatSubjectDisplay(subject)}</span>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Day Filter (only for student context) */}
              {context === 'student' && (
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
                              onCheckedChange={() => toggleDay(day)}
                            />
                            <span className="text-sm">{getDayOfWeek(day)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              
              {/* Clear Filters */}
              {(yearLevelFilters.length > 0 || subjectFilters.length > 0 || dayFilters.length > 0) && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs" 
                  onClick={clearFilters}
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            <ScrollArea className="h-[400px]">
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
                    filteredStudents.map((s) => (
                      <StudentCard
                        key={s.id}
                        student={s}
                        subjects={s.subjects || []}
                        isSelecting
                        isSelected={selectedStudentId === s.id}
                        onClick={() => setSelectedStudentId(s.id)}
                      />
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredClasses.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No classes found
                    </p>
                  ) : (
                    filteredClasses.map((c) => (
                      <ClassCard
                        key={c.id}
                        class={c}
                        subject={c.subject}
                        staff={c.staff || []}
                        students={c.students || []}
                        isSelecting
                        isSelected={selectedClassId === c.id}
                        onClick={() => setSelectedClassId(c.id)}
                      />
                    ))
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {/* Step 2: Select Enrollment Date */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="enrollment-date">Enrollment Start Date</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="enrollment-date"
                  type="date"
                  value={enrollmentDate}
                  onChange={(e) => setEnrollmentDate(e.target.value)}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Student will be added to all sessions on or after this date
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Summary & Confirm */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-3">
              {selectedStudent && (
                <div>
                  <Label className="text-xs text-muted-foreground">Student</Label>
                  <StudentCard
                    student={selectedStudent as Tables<'students'>}
                    subjects={('subjects' in selectedStudent ? (selectedStudent as any).subjects : studentSubjects) || []}
                  />
                </div>
              )}

              {selectedClass && (
                <div>
                  <Label className="text-xs text-muted-foreground">Class</Label>
                  <ClassCard
                    class={selectedClass}
                    subject={selectedClass.subject}
                    staff={selectedClass.staff || []}
                    students={selectedClass.students || []}
                  />
                </div>
              )}

              {firstSessionDate && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">First Session</p>
                  <p className="text-sm text-muted-foreground">
                    {formatSessionDateTime(firstSessionDate)}
                  </p>
                </div>
              )}
            </div>

            {/* Warnings */}
            {(conflicts.sameSubjectWarning || conflicts.timeOverlapWarnings.length > 0) && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {conflicts.sameSubjectWarning && (
                    <p className="font-medium">{conflicts.sameSubjectWarning}</p>
                  )}
                  {conflicts.timeOverlapWarnings.map((warning, i) => (
                    <p key={i} className="text-sm">{warning}</p>
                  ))}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={handleBack} disabled={isEnrolling}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isEnrolling}>
              Cancel
            </Button>
            
            {step < 3 ? (
              <Button 
                onClick={handleNext}
                disabled={step === 1 && !selectedStudentId && !selectedClassId}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleConfirm} disabled={isEnrolling}>
                {isEnrolling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enrolling...
                  </>
                ) : (
                  'Confirm Enrollment'
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

