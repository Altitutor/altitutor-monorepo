import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Tables } from '@altitutor/shared';

export type NotepadRow = Tables<'staff_notepad'>;

export const notepadApi = {
  /**
   * Get current user's notepad
   */
  getNotepad: async (): Promise<NotepadRow | null> => {
    const supabase = getSupabaseClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      return null;
    }
    
    // Get current staff record
    const { data: staffRecord, error: staffError } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', userData.user.id)
      .maybeSingle<{ id: string }>();
    
    if (staffError || !staffRecord) {
      return null;
    }
    
    // Get notepad for this staff member
    const { data, error } = await supabase
      .from('staff_notepad')
      .select('*')
      .eq('staff_id', staffRecord.id)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Update notepad content
   * Uses upsert to create if doesn't exist, update if exists
   */
  updateNotepad: async (content: string): Promise<NotepadRow> => {
    const supabase = getSupabaseClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      throw new Error('Unauthorized');
    }
    
    // Get current staff record
    const { data: staffRecord, error: staffError } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', userData.user.id)
      .maybeSingle<{ id: string }>();
    
    if (staffError || !staffRecord) {
      throw new Error('Staff record not found');
    }
    
    // Upsert notepad (insert or update)
    const { data, error } = await supabase
      .from('staff_notepad')
      .upsert({
        staff_id: staffRecord.id,
        content,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
};
