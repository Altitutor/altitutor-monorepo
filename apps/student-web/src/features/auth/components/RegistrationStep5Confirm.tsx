'use client';

import { UseFormReturn } from 'react-hook-form';
import { Badge } from '@altitutor/ui';
import { useState, useEffect } from 'react';
import type { Tables } from '@altitutor/shared';
import { formatSubjectDisplay, getSubjectColorStyle, cn } from '@/shared/utils';

type RegistrationFormValues = {
  student: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    school?: string;
    curriculum?: 'SACE' | 'IB' | 'PRESACE' | 'PRIMARY';
    year_level?: number;
    subject_ids: string[];
  };
  parents: Array<{
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  }>;
  availability: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday_am: boolean;
    saturday_pm: boolean;
    sunday_am: boolean;
    sunday_pm: boolean;
  };
  password: string;
  confirmPassword?: string;
  paymentMethodVerified: boolean;
};

interface RegistrationStep5ConfirmProps {
  form: UseFormReturn<RegistrationFormValues>;
}

const AVAILABILITY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday_am: 'Saturday Morning',
  saturday_pm: 'Saturday Afternoon',
  sunday_am: 'Sunday Morning',
  sunday_pm: 'Sunday Afternoon',
};

export function RegistrationStep5Confirm({
  form,
}: RegistrationStep5ConfirmProps) {
  const formData = form.getValues();
  const selectedAvailability = Object.entries(formData.availability)
    .filter(([_, value]) => value === true)
    .map(([key]) => AVAILABILITY_LABELS[key] || key);
  
  const [selectedSubjects, setSelectedSubjects] = useState<Tables<'subjects'>[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);

  // Fetch subjects if we have subject_ids but no subject details
  useEffect(() => {
    if (formData.student.subject_ids && formData.student.subject_ids.length > 0 && selectedSubjects.length === 0) {
      setIsLoadingSubjects(true);
      // Fetch all subjects and filter by IDs
      fetch('/api/subjects/search?limit=200')
        .then(async (response) => {
          if (!response.ok) throw new Error('Failed to fetch subjects');
          const data = await response.json();
          const subjects = (data.subjects || []).filter((s: Tables<'subjects'>) => 
            formData.student.subject_ids?.includes(s.id)
          );
          setSelectedSubjects(subjects);
        })
        .catch((error) => {
          console.error('Error fetching subjects:', error);
        })
        .finally(() => {
          setIsLoadingSubjects(false);
        });
    }
  }, [formData.student.subject_ids, selectedSubjects.length]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Confirm Your Details</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Please review your information before completing registration.
        </p>
      </div>

      <div className="space-y-4">
        {/* Student Details */}
        <div className="border rounded-lg p-4 space-y-3">
          <h4 className="font-semibold">Student Details</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="text-muted-foreground">Name:</div>
            <div>{formData.student.first_name} {formData.student.last_name}</div>
            
            <div className="text-muted-foreground">Email:</div>
            <div>{formData.student.email}</div>
            
            <div className="text-muted-foreground">Phone:</div>
            <div>{formData.student.phone}</div>
            
            {formData.student.school && (
              <>
                <div className="text-muted-foreground">School:</div>
                <div>{formData.student.school}</div>
              </>
            )}
            
            {formData.student.curriculum && (
              <>
                <div className="text-muted-foreground">Curriculum:</div>
                <div>{formData.student.curriculum}</div>
              </>
            )}
            
            {formData.student.year_level !== undefined && (
              <>
                <div className="text-muted-foreground">Year Level:</div>
                <div>{formData.student.year_level === 0 ? 'Reception' : `Year ${formData.student.year_level}`}</div>
              </>
            )}
            
            {formData.student.subject_ids && formData.student.subject_ids.length > 0 && (
              <>
                <div className="text-muted-foreground">Subjects:</div>
                <div>
                  {isLoadingSubjects ? (
                    <span className="text-muted-foreground text-sm">Loading subjects...</span>
                  ) : selectedSubjects.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedSubjects.map((subject) => {
                        const { style, textColorClass } = getSubjectColorStyle(subject);
                        const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
                        return (
                          <Badge
                            key={subject.id}
                            className={cn(
                              defaultClass || `${textColorClass} border-0`,
                              !defaultClass && 'border-0'
                            )}
                            style={style.backgroundColor ? style : undefined}
                          >
                            {formatSubjectDisplay(subject)}
                          </Badge>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-sm">
                      {formData.student.subject_ids.length} subject{formData.student.subject_ids.length !== 1 ? 's' : ''} selected
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Parents */}
        <div className="border rounded-lg p-4 space-y-3">
          <h4 className="font-semibold">Parents ({formData.parents.length})</h4>
          {formData.parents.map((parent, index) => (
            <div key={index} className="text-sm">
              <div className="font-medium">{parent.first_name} {parent.last_name}</div>
              <div className="text-muted-foreground">{parent.email} • {parent.phone}</div>
            </div>
          ))}
        </div>

        {/* Availability */}
        {selectedAvailability.length > 0 && (
          <div className="border rounded-lg p-4 space-y-3">
            <h4 className="font-semibold">Availability</h4>
            <div className="flex flex-wrap gap-2">
              {selectedAvailability.map((day) => (
                <Badge key={day} variant="secondary">{day}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
