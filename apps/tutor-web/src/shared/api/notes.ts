import type { Tables, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Notes API client for tutor-web
 * 
 * IMPORTANT: Tutors can only create/edit/delete their own notes
 * All operations must go through API routes that validate ownership
 */
export const notesApi = {
  /**
   * Get notes with staff details for a session
   * Uses vtutor_notes view which only shows notes for entities tutors can access
   */
  getNotesWithStaff: async (params: {
    targetType: string;
    targetId: string;
  }): Promise<Array<Tables<'notes'> & { staff?: Tables<'staff'> | null }>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    // Cast to unknown since vtutor_notes view may not be in generated types yet
    const { data, error } = await (supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            eq: (column: string, value: string) => {
              order: (column: string, options: { ascending: boolean }) => Promise<{
                data: unknown[] | null;
                error: Error | null;
              }>;
            };
          };
        };
      };
    })
      .from('vtutor_notes')
      .select('*')
      .eq('target_type', params.targetType)
      .eq('target_id', params.targetId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Transform the data to match expected format (staff is already included as JSON)
    type NoteWithStaff = {
      id: string;
      target_type: string;
      target_id: string;
      note: string;
      created_at: string;
      created_by: string;
      staff?: Tables<'staff'> | null;
    };
    
    return ((data || []) as NoteWithStaff[]).map((note) => ({
      id: note.id,
      target_type: note.target_type,
      target_id: note.target_id,
      note: note.note,
      created_at: note.created_at,
      created_by: note.created_by,
      staff: note.staff || null,
    })) as Array<Tables<'notes'> & { staff?: Tables<'staff'> | null }>;
  },
};

