export interface WelcomeModalAckResponse {
  success: boolean;
  data: {
    acknowledged_at: string | null;
    alreadyAcknowledged: boolean;
  };
}

export const welcomeApi = {
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
