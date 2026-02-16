export interface WelcomeModalAckResponse {
  success: boolean;
  data: {
    acknowledged_at: string | null;
    alreadyAcknowledged: boolean;
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
      const errorData = await response.json().catch(() => ({ error: 'Failed to load welcome modal context' }));
      throw new Error(errorData.error || 'Failed to load welcome modal context');
    }

    return response.json() as Promise<WelcomeModalContextResponse>;
  },

  acknowledgeWelcomeModal: async (): Promise<WelcomeModalAckResponse> => {
    const response = await fetch('/api/welcome-modal/ack', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to acknowledge welcome modal' }));
      throw new Error(errorData.error || 'Failed to acknowledge welcome modal');
    }

    return response.json() as Promise<WelcomeModalAckResponse>;
  },
};
