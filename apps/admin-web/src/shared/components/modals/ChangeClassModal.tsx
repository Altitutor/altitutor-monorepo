'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Alert, AlertDescription } from '@altitutor/ui';
import { Loader2, Search, ChevronLeft, ChevronRight, AlertTriangle, Calendar as CalendarIcon, ArrowRight } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { StudentCard } from '../StudentCard';
import { ClassCard } from '../ClassCard';
import { calculateFirstSessionDate, calculateLastSessionDate, formatSessionDateTime } from '@/shared/utils/schedule';
import { checkTimeOverlap, getMidnightAdelaide } from '@/shared/utils/enrollment';

interface ChangeClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  
  // Current enrollment details
  student: Tables<'students'>;
  studentSubjects?: Tables<'subjects'>[];
  oldClass: Tables<'classes'>;
  oldClassSubject?: Tables<'subjects'>;
  oldClassStaff?: Tables<'staff'>[];
  
  // Available classes to switch to
  onFetchClasses: () => Promise<Array<Tables<'classes'> & { 
    subject?: Tables<'subjects'>; 
    staff?: Tables<'staff'>[];
    students?: Tables<'students'>[];
  }>>;
  
  // Change class handler
  onChange: (params: {
    studentId: string;
    oldClassId: string;
    newClassId: string;
    changeoverDate: Date;
    staffId: string;
  }) => Promise<void>;
  
  currentStaffId: string;
}

export function ChangeClassModal({
  isOpen,
  onClose,
  student,
  studentSubjects = [],
  oldClass,
  oldClassSubject,
  oldClassStaff = [],
  onFetchClasses,
  onChange,
  currentStaffId
}: ChangeClassModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedNewClassId, setSelectedNewClassId] = useState<string | null>(null);
  const [changeoverDate, setChangeoverDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  
  // Data state
  const [classes, setClasses] = useState<Array<Tables<'classes'> & { 
    subject?: Tables<'subjects'>; 
    staff?: Tables<'staff'>[];
    students?: Tables<'students'>[];
  }>>([]);
  
  // Conflicts
  const [timeOverlapWarning, setTimeOverlapWarning] = useState<string | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedNewClassId(null);
      setChangeoverDate(new Date().toISOString().split('T')[0]);
      setSearchQuery('');
      setTimeOverlapWarning(null);
    }
  }, [isOpen]);

  // Fetch classes when modal opens
  useEffect(() => {
    if (isOpen && step === 1) {
      setIsFetching(true);
      onFetchClasses()
        .then(setClasses)
        .finally(() => setIsFetching(false));
    }
  }, [isOpen, step, onFetchClasses]);

  // Check for time conflicts when moving to summary
  useEffect(() => {
    if (step === 3 && selectedNewClassId) {
      const newClass = classes.find(c => c.id === selectedNewClassId);
      if (!newClass) return;
      
      // Check against student's other classes (we'd need to fetch these)
      // For now, just clear the warning
      setTimeOverlapWarning(null);
    }
  }, [step, selectedNewClassId, classes]);

  // Filter classes (same subject only)
  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      // Only show classes with the same subject
      if (c.subject_id !== oldClass.subject_id) return false;
      
      // Exclude the old class itself
      if (c.id === oldClass.id) return false;
      
      // Search filter
      if (searchQuery.trim() && c.subject) {
        const query = searchQuery.toLowerCase();
        const subjectName = c.subject.name.toLowerCase();
        if (!subjectName.includes(query)) return false;
      }
      
      return true;
    });
  }, [classes, oldClass, searchQuery]);

  const handleNext = () => {
    if (step === 1 && selectedNewClassId) {
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
    if (!selectedNewClassId) return;
    
    setIsChanging(true);
    try {
      await onChange({
        studentId: student.id,
        oldClassId: oldClass.id,
        newClassId: selectedNewClassId,
        changeoverDate: getMidnightAdelaide(new Date(changeoverDate)),
        staffId: currentStaffId
      });
      onClose();
    } catch (error) {
      console.error('Error changing class:', error);
    } finally {
      setIsChanging(false);
    }
  };

  // Get selected new class for display
  const selectedNewClass = classes.find(c => c.id === selectedNewClassId);

  // Calculate session dates
  const lastSessionOldClass = oldClass && changeoverDate
    ? calculateLastSessionDate(oldClass, getMidnightAdelaide(new Date(changeoverDate)))
    : null;
  
  const firstSessionNewClass = selectedNewClass && changeoverDate
    ? calculateFirstSessionDate(selectedNewClass, getMidnightAdelaide(new Date(changeoverDate)))
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Change Class</DialogTitle>
          <DialogDescription>
            Move the student from their current class to a different class with the same subject.
          </DialogDescription>
        </DialogHeader>

        {/* Always show student and old class at top */}
        <div className="space-y-3 pb-4 border-b">
          <div>
            <Label className="text-xs text-muted-foreground">Student</Label>
            <StudentCard
              student={student}
              subjects={studentSubjects}
            />
          </div>
          
          <div>
            <Label className="text-xs text-muted-foreground">Current Class</Label>
            <ClassCard
              class={oldClass}
              subject={oldClassSubject}
              staff={oldClassStaff}
            />
          </div>
        </div>

        {/* Step 1: Select New Class */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search classes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-[300px]">
              {isFetching ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredClasses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No alternative classes found for this subject
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredClasses.map((c) => (
                    <ClassCard
                      key={c.id}
                      class={c}
                      subject={c.subject}
                      staff={c.staff || []}
                      students={c.students}
                      isSelecting
                      isSelected={selectedNewClassId === c.id}
                      onClick={() => setSelectedNewClassId(c.id)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {/* Step 2: Select Changeover Date */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="changeover-date">Changeover Date</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="changeover-date"
                  type="date"
                  value={changeoverDate}
                  onChange={(e) => setChangeoverDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Student will be unenrolled from the old class and enrolled in the new class on this date
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Summary & Confirm */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <ClassCard
                  class={oldClass}
                  subject={oldClassSubject}
                  staff={oldClassStaff}
                />
              </div>
              
              <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                {selectedNewClass && (
                  <ClassCard
                    class={selectedNewClass}
                    subject={selectedNewClass.subject}
                    staff={selectedNewClass.staff || []}
                    students={selectedNewClass.students}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {lastSessionOldClass && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Last Session (Old Class)</p>
                  <p className="text-sm text-muted-foreground">
                    {formatSessionDateTime(lastSessionOldClass)}
                  </p>
                </div>
              )}

              {firstSessionNewClass && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">First Session (New Class)</p>
                  <p className="text-sm text-muted-foreground">
                    {formatSessionDateTime(firstSessionNewClass)}
                  </p>
                </div>
              )}
            </div>

            {/* Warning */}
            {timeOverlapWarning && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{timeOverlapWarning}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={handleBack} disabled={isChanging}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isChanging}>
              Cancel
            </Button>
            
            {step < 3 ? (
              <Button 
                onClick={handleNext}
                disabled={step === 1 && !selectedNewClassId}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleConfirm} disabled={isChanging}>
                {isChanging ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Changing...
                  </>
                ) : (
                  'Confirm Change'
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

