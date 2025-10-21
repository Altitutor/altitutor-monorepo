import type { TablesUpdate } from '@altitutor/shared';
import type { DetailsFormData, StudentAccountFormData } from '../components/tabs';

export function mapDetailsFormToStudentUpdate(data: DetailsFormData): TablesUpdate<'students'> {
  return {
    first_name: data.firstName,
    last_name: data.lastName,
    student_email: data.studentEmail || null,
    student_phone: data.studentPhone || null,
    school: data.school || null,
    // Keep enum tightening for Phase 7; for now allow null or provided value
    curriculum: (data.curriculum || null) as any,
    year_level: data.yearLevel ?? null,
    status: data.status,
    notes: data.notes || null,
    parent_first_name: data.parentFirstName || null,
    parent_last_name: data.parentLastName || null,
    parent_email: data.parentEmail || null,
    parent_phone: data.parentPhone || null,
    availability_monday: data.availability_monday,
    availability_tuesday: data.availability_tuesday,
    availability_wednesday: data.availability_wednesday,
    availability_thursday: data.availability_thursday,
    availability_friday: data.availability_friday,
    availability_saturday_am: data.availability_saturday_am,
    availability_saturday_pm: data.availability_saturday_pm,
    availability_sunday_am: data.availability_sunday_am,
    availability_sunday_pm: data.availability_sunday_pm,
  } as TablesUpdate<'students'>;
}

export function mapAccountFormToStudentUpdate(data: StudentAccountFormData): TablesUpdate<'students'> {
  return {
    first_name: data.firstName,
    last_name: data.lastName,
    student_email: data.studentEmail || null,
  } as TablesUpdate<'students'>;
}


