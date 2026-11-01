import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { TeachingError } from './auth';

/** Only called after active staff bearer authentication. Never a public roster. */
export async function teachingStaffDirectory() {
  const service = getServiceRoleClient();
  const directory: Array<{ id: string; name: string; email: string }> = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await service.from('staff')
      .select('id,first_name,last_name,email')
      .eq('status', 'ACTIVE').in('role', ['TUTOR', 'ADMINSTAFF'])
      .is('deleted_at', null).not('user_id', 'is', null).not('email', 'is', null)
      .order('first_name').order('last_name').order('id').range(offset, offset + 499);
    if (error) throw new TeachingError(503, 'The staff list is temporarily unavailable.', error);
    for (const staff of data ?? []) {
      if (staff.email) directory.push({ id: staff.id, name: [staff.first_name, staff.last_name].filter(Boolean).join(' '), email: staff.email });
    }
    if ((data?.length ?? 0) < 500) return directory;
  }
}
