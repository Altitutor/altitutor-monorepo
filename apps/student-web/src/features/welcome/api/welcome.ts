import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { STUDENT_WELCOME_TOUR } from '../lib/onboarding';

export interface WelcomeModalAckResponse {
  success: boolean;
  data: {
    acknowledged_at: string;
  };
}

export interface WelcomeModalContextResponse {
  success: boolean;
  data: {
    student_id: string;
    subjects: Array<{
      id: string;
      name: string;
      long_name: string | null;
      curriculum: string | null;
      year_level: number | null;
      color: string | null;
      discipline: string | null;
      hourly_rate_cents: number;
    }>;
    homework_help_time: string | null;
    default_class_hourly_rate_cents: number;
  };
}

export const welcomeApi = {
  getWelcomeModalContext: async (): Promise<WelcomeModalContextResponse> => {
    const response = await fetch('/api/welcome-modal/context', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: 'Failed to load welcome modal context',
      }));
      throw new Error(errorData.error || 'Failed to load welcome modal context');
    }

    return response.json() as Promise<WelcomeModalContextResponse>;
  },

  /**
   * Mark the full-screen welcome wizard complete via SECURITY DEFINER RPC.
   * Portal orientation stays on the dashboard spotlight tour
   * (`student-portal-intro`), which auto-starts after welcome is done.
   */
  acknowledgeWelcomeModal: async (): Promise<WelcomeModalAckResponse> => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc('student_complete_onboarding_tour', {
      p_tour_id: STUDENT_WELCOME_TOUR,
      p_version: 1,
    });

    if (error) {
      throw new Error(error.message || 'Failed to acknowledge welcome guide');
    }

    return {
      success: true,
      data: {
        acknowledged_at: new Date().toISOString(),
      },
    };
  },
};
