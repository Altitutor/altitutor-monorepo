import type { Database, Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Admin-granted manual online access row with joined student and subject */
export type ManualOnlineAccessRow = Tables<'students_online_access_manual'> & {
  student: Pick<Tables<'students'>, 'id' | 'first_name' | 'last_name' | 'status'> | null;
  subject: Pick<Tables<'subjects'>, 'id' | 'name' | 'short_name' | 'long_name'> | null;
};

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

export const manualOnlineAccessApi = {
  list: async (): Promise<ManualOnlineAccessRow[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('students_online_access_manual')
      .select(
        'id, created_at, created_by, notes, student_id, subject_id, student:students(id, first_name, last_name, status), subject:subjects(id, name, short_name, long_name)',
      )
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ManualOnlineAccessRow[];
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

    const { error } = await supabase.from('students_online_access_manual').delete().eq('id', id);
    if (error) throw error;
    await syncStudentsSubjectsLink(supabase, row.student_id, row.subject_id, 'delete');
  },
};

/** @deprecated Use manualOnlineAccessApi */
export const ucatOnlineAccessApi = manualOnlineAccessApi;
export type UcatOnlineAccessRow = ManualOnlineAccessRow;
