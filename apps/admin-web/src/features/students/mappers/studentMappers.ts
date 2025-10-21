import type { TablesUpdate } from '@altitutor/shared';
import type { DetailsFormData, StudentAccountFormData } from '../components/tabs';

export function mapDetailsFormToStudentUpdate(data: DetailsFormData): TablesUpdate<'students'> {
  return {
    first_name: data.firstName,
    last_name: data.lastName,
    email: (data.email || null) as any,
    phone: (data.phone || null) as any,
    school: data.school || null,
    // Keep enum tightening for Phase 7; for now allow null or provided value
    curriculum: (data.curriculum || null) as any,
    year_level: data.yearLevel ?? null,
    status: data.status,
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
    email: (data.studentEmail || null) as any,
  } as TablesUpdate<'students'>;
}


