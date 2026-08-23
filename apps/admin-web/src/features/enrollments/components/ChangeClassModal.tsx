'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@altitutor/ui';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { AdminDialogShell } from '@/shared/components/dialog-shell';
import { useChangeClassData, useChangeClassFlow } from '../hooks';
import { filterClassesForChange } from '../utils/changeClassFilters';
import {
  ChangeClassStep1SelectClass,
  ChangeClassStep2SelectDate,
  ChangeClassStep3Summary,
  ChangeClassStep4MessageScreen,
} from './steps';
import type { ChangeClassModalProps } from '../types/enrollment';

export function ChangeClassModal({
  isOpen,
  onClose,
  student,
  studentSubjects: _studentSubjects = [],
  oldClass,
  oldClassSubject,
  oldClassStaff = [],
  onFetchClasses: _onFetchClasses,
  onChange,
  currentStaffId,
}: ChangeClassModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedNewClassId, setSelectedNewClassId] = useState<string | null>(null);
  const [changeoverDate, setChangeoverDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dayFilters, setDayFilters] = useState<number[]>([]);
  const [timeOverlapWarning, setTimeOverlapWarning] = useState<string | null>(null);

  // Fetch data using RPC (no search query passed - we filter client-side)
  const { classes, isFetching } = useChangeClassData({
    isOpen,
    step,
    oldClassSubjectId: oldClassSubject?.id,
    searchQuery: '', // Don't pass search to RPC - we filter client-side
  });

  // Get available days from classes
  const availableDays = useMemo(() => {
    const daysSet = new Set<number>();
    classes.forEach(c => {
      if (c.day_of_week !== undefined && c.day_of_week !== null) {
        daysSet.add(c.day_of_week);
      }
    });
    return Array.from(daysSet).sort();
  }, [classes]);

  // Filter classes
  const filteredClasses = useMemo(() => {
    return filterClassesForChange(classes, oldClass, searchQuery, dayFilters);
  }, [classes, oldClass, searchQuery, dayFilters]);

  // Get selected new class for display
  const selectedNewClass = classes.find(c => c.id === selectedNewClassId);

  // Flow management
  const { isChanging, handleConfirm, changeSuccess } = useChangeClassFlow({
    isOpen,
    student,
    oldClass,
    selectedNewClassId,
    changeoverDate,
    onChange,
    currentStaffId,
    onClose,
  });

  // Move to step 4 when change succeeds
  useEffect(() => {
    if (changeSuccess && step === 3) {
      setStep(4);
    }
  }, [changeSuccess, step]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedNewClassId(null);
      setChangeoverDate('');
      setSearchQuery('');
      setDayFilters([]);
      setTimeOverlapWarning(null);
    }
  }, [isOpen]);

  const toggleDay = useCallback((day: number) => {
    setDayFilters(prev => 
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setDayFilters([]);
  }, []);

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
    } else if (step === 2 && changeoverDate && changeoverDate.trim() !== '') {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as 1 | 2);
    }
  };

  const getStepTitle = (step: 1 | 2 | 3 | 4): string => {
    switch (step) {
      case 1:
        return 'Select New Class';
      case 2:
        return 'Select Changeover Date';
      case 3:
        return 'Summary & Confirm';
      case 4:
        return 'Send Message';
      default:
        return '';
    }
  };

  return (
    <AdminDialogShell
      open={isOpen}
      onClose={onClose}
      fillHeight
      title="Change Class"
      subtitle={`Step ${step} of 4: ${getStepTitle(step)}`}
      contentClassName="md:max-w-4xl"
      bodyClassName="min-h-0 flex-1 overflow-hidden flex flex-col p-0"
      headerExtra={
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className={`flex-1 h-2 rounded-full transition-colors ${
                  index < step - 1
                    ? 'bg-primary'
                    : index === step - 1
                      ? 'bg-primary/50'
                      : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>
      }
      footer={
        step === 4 ? (
          <div className="flex w-full justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="flex w-full justify-between sm:justify-between">
            <div className="flex gap-2">
              {step > 1 && (
                <Button variant="outline" onClick={handleBack} disabled={isChanging}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              {step < 3 ? (
                <Button
                  onClick={handleNext}
                  disabled={
                    (step === 1 && !selectedNewClassId) ||
                    (step === 2 && (!changeoverDate || changeoverDate.trim() === ''))
                  }
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
          </div>
        )
      }
    >
      {step === 4 ? (
        <ChangeClassStep4MessageScreen
          student={student}
          oldClass={oldClass}
          oldClassSubject={oldClassSubject}
          selectedNewClass={selectedNewClass}
          changeoverDate={changeoverDate}
        />
      ) : (
        <div className="h-full overflow-y-auto">
          <div className="p-6">
            {step === 1 && (
              <ChangeClassStep1SelectClass
                student={student}
                oldClass={oldClass}
                oldClassSubject={oldClassSubject}
                selectedNewClass={selectedNewClass}
                isFetching={isFetching}
                filteredClasses={filteredClasses}
                selectedNewClassId={selectedNewClassId}
                searchQuery={searchQuery}
                dayFilters={dayFilters}
                availableDays={availableDays}
                onSearchChange={setSearchQuery}
                onToggleDay={toggleDay}
                onClearFilters={clearFilters}
                onSelectClass={setSelectedNewClassId}
              />
            )}

            {step === 2 && (
              <ChangeClassStep2SelectDate
                changeoverDate={changeoverDate}
                onDateChange={setChangeoverDate}
                studentId={student.id}
                selectedStudent={student}
                selectedNewClass={selectedNewClass}
                oldClass={oldClass}
                oldClassSubject={oldClassSubject}
                oldClassStaff={oldClassStaff}
              />
            )}

            {step === 3 && (
              <ChangeClassStep3Summary
                studentId={student.id}
                student={student}
                oldClass={oldClass}
                oldClassSubject={oldClassSubject}
                oldClassStaff={oldClassStaff}
                selectedNewClass={selectedNewClass}
                changeoverDate={changeoverDate}
                timeOverlapWarning={timeOverlapWarning}
              />
            )}
          </div>
        </div>
      )}
    </AdminDialogShell>
  );
}
