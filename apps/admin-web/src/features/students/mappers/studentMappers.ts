import type { TablesUpdate } from '@altitutor/shared';
import type { DetailsFormData } from '../components/tabs';

export function mapDetailsFormToStudentUpdate(data: DetailsFormData): TablesUpdate<'students'> {
  return {
    first_name: data.firstName,
    last_name: data.lastName,
    email: data.email || null,
    phone: data.phone || null,
  } as TablesUpdate<'students'>;
}

