import { mutateWorkItem } from '@/features/admin-mcp/client/operations';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { DailyNote, DailyNoteUpdate } from '../types';

export const dailyNotesApi = {
  getByDate: async (date: string): Promise<DailyNote | null> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('notes_daily')
      .select('*')
      .eq('date', date)
      .maybeSingle();

    if (error) throw error;
    return data as DailyNote | null;
  },

  create: async (date: string): Promise<DailyNote> => mutateWorkItem<DailyNote>('daily_note', { date, content: '' }),

  ensureForDate: async (date: string): Promise<DailyNote> => {
    const existing = await dailyNotesApi.getByDate(date);
    if (existing) return existing;
    return dailyNotesApi.create(date);
  },

  update: async (id: string, updates: DailyNoteUpdate, revision?: number): Promise<DailyNote> => {
    return mutateWorkItem<DailyNote>('daily_note', updates, id, revision);
  },
};
