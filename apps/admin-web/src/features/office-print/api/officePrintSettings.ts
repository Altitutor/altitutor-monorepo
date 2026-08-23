import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { TutorOfficePrintAccess } from '../lib/tutorOfficePrintAccess';

export type OfficePrintSettingsRow = {
  tutor_access: TutorOfficePrintAccess;
};

const ACCESS_VALUES = new Set<TutorOfficePrintAccess>(['off', 'office_hours', 'unrestricted']);

function parseAccess(value: unknown): TutorOfficePrintAccess {
  if (typeof value === 'string' && ACCESS_VALUES.has(value as TutorOfficePrintAccess)) {
    return value as TutorOfficePrintAccess;
  }
  throw new Error('Invalid tutor office print access');
}

export async function getOfficePrintSettings(): Promise<OfficePrintSettingsRow> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('office_print_settings')
    .select('tutor_access')
    .eq('singleton', true)
    .single();
  if (error) throw new Error(error.message);
  return { tutor_access: parseAccess(data.tutor_access) };
}

export async function updateOfficePrintSettings(
  tutorAccess: TutorOfficePrintAccess,
): Promise<OfficePrintSettingsRow> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('office_print_settings')
    .update({ tutor_access: tutorAccess })
    .eq('singleton', true)
    .select('tutor_access')
    .single();
  if (error) throw new Error(error.message);
  return { tutor_access: parseAccess(data.tutor_access) };
}
