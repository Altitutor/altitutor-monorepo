'use client';

import { Button, Input, Label } from '@altitutor/ui';
import { Loader2, Plus, Search } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { AdminTrialContactForm, type AdminTrialContactFormValues } from '../AdminTrialContactForm';
import { StudentCard } from '@/shared/components/StudentCard';
import type { UseFormReturn } from 'react-hook-form';

interface TrialStudentSelectionStepProps {
  studentSearch: string;
  onSearchChange: (value: string) => void;
  students: Tables<'students'>[] | undefined;
  isLoading: boolean;
  selectedStudentId: string;
  onSelectStudent: (studentId: string) => void;
  isCreatingStudent: boolean;
  onStartCreatingStudent: () => void;
  onCancelCreatingStudent: () => void;
  trialContactData: AdminTrialContactFormValues | null;
  onFormSubmit: (data: AdminTrialContactFormValues) => void;
  onFormReady: (form: UseFormReturn<AdminTrialContactFormValues>) => void;
  onValidityChange: (isValid: boolean) => void;
}

export function TrialStudentSelectionStep({
  studentSearch,
  onSearchChange,
  students,
  isLoading,
  selectedStudentId,
  onSelectStudent,
  isCreatingStudent,
  onStartCreatingStudent,
  onCancelCreatingStudent,
  trialContactData,
  onFormSubmit,
  onFormReady,
  onValidityChange,
}: TrialStudentSelectionStepProps) {
  if (isCreatingStudent) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-medium">Create new student</h3>
            <p className="text-sm text-muted-foreground">
              Add the student details now, then continue with the trial booking.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancelCreatingStudent}
          >
            Cancel
          </Button>
        </div>

        <AdminTrialContactForm
          onSubmit={onFormSubmit}
          defaultValues={trialContactData || undefined}
          onFormReady={onFormReady}
          onValidityChange={onValidityChange}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Search for an existing student or create a new one on the spot.
      </p>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="trial-student-search"
            value={studentSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Type student name or email..."
            className="pl-10"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onStartCreatingStudent}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create new
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="trial-student-search">Existing Students</Label>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : students && students.length > 0 ? (
          <div className="max-h-[400px] space-y-2 overflow-y-auto">
            {students.map((student) => (
              <div
                key={student.id}
                onClick={() => onSelectStudent(student.id)}
              >
                <StudentCard
                  student={student}
                  isSelecting
                  isSelected={selectedStudentId === student.id}
                  showSubjects={false}
                  showActions={false}
                />
              </div>
            ))}
          </div>
        ) : studentSearch.length >= 2 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>No students found</p>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <p>Type at least 2 characters to search</p>
          </div>
        )}
      </div>
    </div>
  );
}
