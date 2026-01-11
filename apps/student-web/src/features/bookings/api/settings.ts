import type { Tables } from '@altitutor/shared';

export type BookingSettingsRow = Tables<'booking_settings'>;

export const bookingSettingsApi = {
  async getSettingValue(settingKey: string): Promise<string | null> {
    const response = await fetch(`/api/bookings/settings?key=${encodeURIComponent(settingKey)}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch booking setting: ${response.statusText}`);
    }
    const data = await response.json();
    return data.setting_value ?? null;
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
          return 90;
        case 'TRIAL_SESSION':
          return 45;
        case 'SUBSIDY_INTERVIEW':
          return 45;
      }
    }
    
    return parsed;
  },
};

