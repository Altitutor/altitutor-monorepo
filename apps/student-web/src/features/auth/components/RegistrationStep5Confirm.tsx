'use client';

import { UseFormReturn } from 'react-hook-form';
import { Badge } from '@altitutor/ui';
import { formatSubjectDisplay, getSubjectColorStyle, cn } from '@/shared/utils';

type RegistrationFormValues = {
  student: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    school: string;
    curriculum: string | undefined;
    year_level: number | undefined;
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
  confirmPassword: string;
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
