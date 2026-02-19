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

  create: async (date: string): Promise<DailyNote> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('notes_daily')
      .insert({ date, content: '' })
      .select()
      .single();

    if (error) throw error;
    return data as DailyNote;
  },

  ensureForDate: async (date: string): Promise<DailyNote> => {
    const existing = await dailyNotesApi.getByDate(date);
    if (existing) return existing;
    return dailyNotesApi.create(date);
  },

  update: async (id: string, updates: DailyNoteUpdate): Promise<DailyNote> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('notes_daily')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as DailyNote;
  },
};
