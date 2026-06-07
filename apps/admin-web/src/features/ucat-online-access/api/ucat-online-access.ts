import type { Database, Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

export type UcatOnlineTierOverride =
  | 'default'
  | 'force_free'
  | 'force_unlimited'
  | 'force_pro';

/** Extends generated student row until db:types includes tier override column */
export type StudentWithUcatTierOverride = Pick<
  Tables<'students'>,
  'id' | 'first_name' | 'last_name' | 'status'
> & {
  ucat_online_tier_override?: UcatOnlineTierOverride;
};

/** Admin-granted manual online access row with joined student and subject */
export type ManualOnlineAccessRow = Tables<'students_online_access_manual'> & {
  student: StudentWithUcatTierOverride | null;
  subject: Pick<Tables<'subjects'>, 'id' | 'name' | 'short_name' | 'long_name'> | null;
};

const UCAT_SUBJECT_NAME = 'UCAT';

async function getUcatSubjectId(supabase: SupabaseClient<Database>): Promise<string | null> {
  const { data, error } = await supabase
    .from('subjects')
    .select('id')
    .eq('name', UCAT_SUBJECT_NAME)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function isUcatSubject(
  supabase: SupabaseClient<Database>,
  subjectId: string,
): Promise<boolean> {
  const ucatSubjectId = await getUcatSubjectId(supabase);
  return ucatSubjectId != null && ucatSubjectId === subjectId;
}

async function syncStudentsSubjectsLink(
  supabase: SupabaseClient<Database>,
  studentId: string,
  subjectId: string,
  action: 'insert' | 'delete',
): Promise<void> {
  if (action === 'insert') {
    const { error } = await supabase
      .from('students_subjects')
      .insert({ student_id: studentId, subject_id: subjectId });
    if (error && error.code !== '23505') throw error;
  } else {
    const { error } = await supabase
      .from('students_subjects')
      .delete()
      .eq('student_id', studentId)
      .eq('subject_id', subjectId);
    if (error) throw error;
  }
}

async function setStudentUcatTierOverride(
  supabase: SupabaseClient<Database>,
  studentId: string,
  tierOverride: UcatOnlineTierOverride,
): Promise<void> {
  const { error } = await supabase
    .from('students')
    .update({ ucat_online_tier_override: tierOverride } as never)
    .eq('id', studentId);
  if (error) throw error;
}

async function hasRemainingUcatManualGrant(
  supabase: SupabaseClient<Database>,
  studentId: string,
  excludeGrantId?: string,
): Promise<boolean> {
  const ucatSubjectId = await getUcatSubjectId(supabase);
  if (!ucatSubjectId) return false;

  let query = supabase
    .from('students_online_access_manual')
    .select('id')
    .eq('student_id', studentId)
    .eq('subject_id', ucatSubjectId);

  if (excludeGrantId) {
    query = query.neq('id', excludeGrantId);
  }

  const { data, error } = await query.limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export const manualOnlineAccessApi = {
  list: async (): Promise<ManualOnlineAccessRow[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('students_online_access_manual')
      .select(
        'id, created_at, created_by, notes, student_id, subject_id, student:students(id, first_name, last_name, status, ucat_online_tier_override), subject:subjects(id, name, short_name, long_name)',
      )
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as ManualOnlineAccessRow[];
  },

  grant: async (params: {
    studentId: string;
    subjectId: string;
    notes?: string | null;
    createdBy?: string | null;
  }): Promise<Tables<'students_online_access_manual'>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('students_online_access_manual')
      .insert({
        student_id: params.studentId,
        subject_id: params.subjectId,
        notes: params.notes ?? null,
        created_by: params.createdBy ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    await syncStudentsSubjectsLink(supabase, params.studentId, params.subjectId, 'insert');

    if (await isUcatSubject(supabase, params.subjectId)) {
      await setStudentUcatTierOverride(supabase, params.studentId, 'force_unlimited');
    }

    return data as Tables<'students_online_access_manual'>;
  },

  revoke: async (id: string): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data: row, error: fetchErr } = await supabase
      .from('students_online_access_manual')
      .select('student_id, subject_id')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!row) return;

    const isUcat = await isUcatSubject(supabase, row.subject_id);

    const { error } = await supabase.from('students_online_access_manual').delete().eq('id', id);
    if (error) throw error;
    await syncStudentsSubjectsLink(supabase, row.student_id, row.subject_id, 'delete');

    if (isUcat) {
      const hasOtherUcatGrant = await hasRemainingUcatManualGrant(supabase, row.student_id);
      if (!hasOtherUcatGrant) {
        await setStudentUcatTierOverride(supabase, row.student_id, 'default');
      }
    }
  },

  setUcatTierOverride: async (
    studentId: string,
    tierOverride: UcatOnlineTierOverride,
  ): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    await setStudentUcatTierOverride(supabase, studentId, tierOverride);
  },
};

/** @deprecated Use manualOnlineAccessApi */
export const ucatOnlineAccessApi = manualOnlineAccessApi;
export type UcatOnlineAccessRow = ManualOnlineAccessRow;

export const UCAT_TIER_OVERRIDE_LABELS: Record<UcatOnlineTierOverride, string> = {
  default: 'Default (Stripe-derived)',
  force_free: 'Force UCAT Free',
  force_unlimited: 'Force UCAT Unlimited',
  force_pro: 'Force UCAT Pro',
};
