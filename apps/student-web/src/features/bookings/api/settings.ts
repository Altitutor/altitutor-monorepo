import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';

export type BookingSettingsRow = Tables<'booking_settings'>;

export const bookingSettingsApi = {
  async getSettingValue(settingKey: string): Promise<string | null> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('vbooking_settings')
      .select('setting_value')
      .eq('setting_key', settingKey)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data?.setting_value ?? null;
  },

  async getSessionDurationMinutes(sessionType: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW'): Promise<number> {
    let settingKey: string;
    switch (sessionType) {
      case 'DRAFTING':
        settingKey = 'drafting_session_duration_minutes';
        break;
      case 'TRIAL_SESSION':
        settingKey = 'trial_session_duration_minutes';
        break;
      case 'SUBSIDY_INTERVIEW':
        settingKey = 'subsidy_interview_duration_minutes';
        break;
    }
    
    const value = await this.getSettingValue(settingKey);
    if (value === null) {
      // Return default values if setting not found
      switch (sessionType) {
        case 'DRAFTING':
          return 60;
        case 'TRIAL_SESSION':
          return 45;
        case 'SUBSIDY_INTERVIEW':
          return 45;
      }
    }
    
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      // Return default if parsing fails
      switch (sessionType) {
        case 'DRAFTING':
          return 60;
        case 'TRIAL_SESSION':
          return 45;
        case 'SUBSIDY_INTERVIEW':
          return 45;
      }
    }
    
    return parsed;
  },
};

