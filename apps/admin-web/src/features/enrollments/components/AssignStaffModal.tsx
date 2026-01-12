'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import {
  useAssignStaffData,
  useAssignStaffConflicts,
  useAssignStaffFlow,
} from '../hooks';
import {
  AssignStaffStep1SelectClassOrStaff,
  AssignStaffStep2SelectDate,
  AssignStaffStep3Summary,
} from './steps';
import type { AssignStaffModalProps, AssignStaffContext } from '../types/enrollment';
import { ClassCard } from '@/shared/components/ClassCard';
import { StaffCard } from '@/shared/components/StaffCard';

export function AssignStaffModal({
  isOpen,
  onClose,
  context,
  staff,
  staffSubjects = [],
  assignedClassIds = [],
  classData,
  classSubject,
  classStaff = [],
  assignedStaffIds = [],
  onAssign,
  currentStaffId,
}: AssignStaffModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [assignmentDate, setAssignmentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [dayFilters, setDayFilters] = useState<number[]>([]);
  const [subjectFilters, setSubjectFilters] = useState<string[]>([]);

  // Fetch data using hooks
  const { classes, staff: staffList, isFetching } = useAssignStaffData({
    isOpen,
    step,
    context,
    searchQuery,
    dayFilters,
    subjectFilters,
    classData,
    staff,
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

  // Filter classes/staff based on already assigned
  const filteredClasses = useMemo(() => {
    return classes.filter(c => !assignedClassIds.includes(c.id));
  }, [classes, assignedClassIds]);

  const filteredStaff = useMemo(() => {
    return staffList.filter(s => !assignedStaffIds.includes(s.id));
  }, [staffList, assignedStaffIds]);

  // Get selected items for display
  const selectedClasses = filteredClasses.filter(c => selectedClassIds.includes(c.id));
  const selectedStaff = filteredStaff.filter(s => selectedStaffIds.includes(s.id));

  // Check conflicts
  const {
    staffConflicts,
    classConflicts,
    staffUnavailability,
    classUnavailability,
  } = useAssignStaffConflicts({
    context,
    step,
    selectedStaffId: context === 'staff' ? staff?.id || null : null,
    selectedClassIds: context === 'staff' ? selectedClassIds : [],
    selectedStaffIds: context === 'class' ? selectedStaffIds : [],
    staff,
    classData,
    classes: filteredClasses,
    staffList: filteredStaff,
    assignmentDate,
    enabled: isOpen && step === 1,
  });

  // Flow management
  const { isAssigning, handleConfirm } = useAssignStaffFlow({
    isOpen,
    context,
    onAssign,
    currentStaffId,
    staff,
    classData,
    selectedStaffIds,
    selectedClassIds,
    assignmentDate,
    onClose,
  });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedClassIds([]);
      setSelectedStaffIds([]);
      setAssignmentDate(new Date().toISOString().split('T')[0]);
      setSearchQuery('');
      setDayFilters([]);
      setSubjectFilters([]);
    }
  }, [isOpen]);

  const toggleDay = useCallback((day: number) => {
    setDayFilters(prev => 
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  }, []);

  const toggleSubject = useCallback((subjectId: string) => {
    setSubjectFilters(prev => 
      prev.includes(subjectId)
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setDayFilters([]);
    setSubjectFilters([]);
  }, []);

  const toggleClass = useCallback((classId: string) => {
    setSelectedClassIds(prev => 
      prev.includes(classId)
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  }, []);

  const toggleStaff = useCallback((staffId: string) => {
    setSelectedStaffIds(prev => 
      prev.includes(staffId)
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  }, []);

  const handleNext = () => {
    if (step === 1) {
      if (context === 'staff' && selectedClassIds.length > 0) {
        setStep(2);
      } else if (context === 'class' && selectedStaffIds.length > 0) {
        setStep(2);
      }
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as 1 | 2);
    }
  };

  const canProceed = step === 1
    ? (context === 'staff' && selectedClassIds.length > 0) || (context === 'class' && selectedStaffIds.length > 0)
    : true;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b space-y-3">
          <div className="flex-1">
            <DialogTitle>Assign Staff</DialogTitle>
            {(context === 'class' && classData && classSubject) || 
             (context === 'staff' && staff) || 
             selectedClasses.length > 0 || 
             selectedStaff.length > 0 ? (
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                {/* Show class card for class context */}
                {context === 'class' && classData && classSubject && (
                  <div className="flex-shrink-0">
                    <ClassCard
                      class={classData}
                      subject={classSubject}
                      staff={classStaff || []}
                      students={[]}
                      compact={true}
                    />
                  </div>
                )}
                
                {/* Show staff card for staff context */}
                {context === 'staff' && staff && (
                  <div className="flex-shrink-0">
                    <StaffCard
                      staff={staff}
                      subjects={staffSubjects || []}
                      showSubjects={true}
                      showActions={false}
                    />
                  </div>
                )}
                
                {/* Show selected staff cards for class context */}
                {context === 'class' && selectedStaff.map(s => (
                  <div key={s.id} className="flex-shrink-0">
                    <StaffCard
                      staff={s}
                      subjects={[]}
                      showSubjects={false}
                      showActions={false}
                    />
                  </div>
                ))}
                
                {/* Show selected class cards for staff context */}
                {context === 'staff' && selectedClasses.map(c => (
                  <div key={c.id} className="flex-shrink-0">
                    <ClassCard
                      class={c}
                      subject={c.subject}
                      staff={c.staff || []}
                      students={c.students || []}
                      compact={true}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0 px-6 py-4 flex flex-col">
          {/* Step 1: Select Classes or Staff */}
          {step === 1 && (
            <AssignStaffStep1SelectClassOrStaff
              context={context}
              isFetching={isFetching}
              classData={classData}
              classSubject={classSubject}
              classStaff={classStaff}
              staff={staff}
              staffSubjects={staffSubjects}
              filteredClasses={filteredClasses}
              filteredStaff={filteredStaff}
              availableDays={availableDays}
              selectedClassIds={selectedClassIds}
              selectedStaffIds={selectedStaffIds}
              onToggleClass={toggleClass}
              onToggleStaff={toggleStaff}
              searchQuery={searchQuery}
              dayFilters={dayFilters}
              subjectFilters={subjectFilters}
              onSearchChange={setSearchQuery}
              onToggleDay={toggleDay}
              onToggleSubject={toggleSubject}
              onClearFilters={clearFilters}
              staffConflicts={staffConflicts}
              classConflicts={classConflicts}
              staffUnavailability={staffUnavailability}
              classUnavailability={classUnavailability}
            />
          )}

          {/* Step 2: Select Assignment Date */}
          {step === 2 && (
            <div className="flex-1 overflow-y-auto">
              <AssignStaffStep2SelectDate
                context={context}
                assignmentDate={assignmentDate}
                onDateChange={setAssignmentDate}
                classData={classData}
                classSubject={classSubject}
                classStaff={classStaff}
                selectedStaff={selectedStaff}
                staff={staff}
                staffSubjects={staffSubjects}
                selectedClasses={selectedClasses}
              />
            </div>
          )}

          {/* Step 3: Summary & Confirm */}
          {step === 3 && (
            <div className="flex-1 overflow-y-auto">
              <AssignStaffStep3Summary
                context={context}
                selectedStaff={selectedStaff}
                selectedClasses={selectedClasses}
                staff={staff}
                staffSubjects={staffSubjects}
                classData={classData}
                classSubject={classSubject}
                classStaff={classStaff}
                assignmentDate={assignmentDate}
                staffConflicts={staffConflicts}
                classConflicts={classConflicts}
                staffUnavailability={staffUnavailability}
                classUnavailability={classUnavailability}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 flex justify-between sm:justify-between px-6 py-4 border-t">
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={handleBack} disabled={isAssigning}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isAssigning}>
              Cancel
            </Button>
            
            {step < 3 ? (
              <Button 
                onClick={handleNext}
                disabled={!canProceed}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleConfirm} disabled={isAssigning}>
                {isAssigning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  'Confirm Assignment'
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

