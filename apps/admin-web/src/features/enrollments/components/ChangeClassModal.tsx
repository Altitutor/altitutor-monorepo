'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { StudentCard } from '@/shared/components/StudentCard';
import { ClassCard } from '@/shared/components/ClassCard';
import { useChangeClassData, useChangeClassFlow } from '../hooks';
import { filterClassesForChange } from '../utils/changeClassFilters';
import {
  ChangeClassStep1SelectClass,
  ChangeClassStep2SelectDate,
  ChangeClassStep3Summary,
} from './steps';
import type { ChangeClassModalProps } from '../types/enrollment';

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
  currentStaffId,
}: ChangeClassModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedNewClassId, setSelectedNewClassId] = useState<string | null>(null);
  const [changeoverDate, setChangeoverDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [timeOverlapWarning, setTimeOverlapWarning] = useState<string | null>(null);

  // Fetch data
  const { classes, isFetching } = useChangeClassData({
    isOpen,
    step,
    onFetchClasses,
  });

  // Filter classes
  const filteredClasses = useMemo(() => {
    return filterClassesForChange(classes, oldClass, searchQuery);
  }, [classes, oldClass, searchQuery]);

  // Get selected new class for display
  const selectedNewClass = classes.find(c => c.id === selectedNewClassId);

  // Flow management
  const { isChanging, handleConfirm } = useChangeClassFlow({
    isOpen,
    student,
    oldClass,
    selectedNewClassId,
    changeoverDate,
    onChange,
    currentStaffId,
    onClose,
  });

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

  // Check for time conflicts when moving to summary
  useEffect(() => {
    if (step === 3 && selectedNewClassId) {
      // For now, just clear the warning
      // Could add conflict checking here if needed
      setTimeOverlapWarning(null);
    }
  }, [step, selectedNewClassId]);

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <DialogTitle>Change Class</DialogTitle>
          <DialogDescription>
            Move the student from their current class to a different class with the same subject.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
          {/* Always show student and old class at top */}
          <div className="space-y-3 pb-4 border-b mb-4">
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
            <ChangeClassStep1SelectClass
              isFetching={isFetching}
              filteredClasses={filteredClasses}
              selectedNewClassId={selectedNewClassId}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectClass={setSelectedNewClassId}
            />
          )}

          {/* Step 2: Select Changeover Date */}
          {step === 2 && (
            <ChangeClassStep2SelectDate
              changeoverDate={changeoverDate}
              onDateChange={setChangeoverDate}
            />
          )}

          {/* Step 3: Summary & Confirm */}
          {step === 3 && (
            <ChangeClassStep3Summary
              oldClass={oldClass}
              oldClassSubject={oldClassSubject}
              oldClassStaff={oldClassStaff}
              selectedNewClass={selectedNewClass}
              changeoverDate={changeoverDate}
              timeOverlapWarning={timeOverlapWarning}
            />
          )}
        </div>

        <DialogFooter className="flex-shrink-0 flex justify-between sm:justify-between px-6 py-4 border-t">
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

