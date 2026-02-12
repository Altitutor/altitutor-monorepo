/**
 * Shared invites API for cross-feature use (e.g. staff send invite).
 * Avoids cross-feature imports from auth feature.
 */

export interface GenerateInviteRequest {
  type: 'staff' | 'student';
  id: string;
}

export interface GenerateInviteResponse {
  token: string;
  id: string;
}

export interface SendInviteEmailRequest {
  type: 'staff' | 'student';
  id: string;
  token: string;
}

export interface SendInviteSmsRequest {
  type: 'staff' | 'student';
  id: string;
  token: string;
}

export const sharedInvitesApi = {
  generateInviteToken: async (
    data: GenerateInviteRequest
  ): Promise<GenerateInviteResponse> => {
    const response = await fetch('/api/invites/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate invite token');
    }
    return response.json();
  },

  sendInviteEmail: async (
    data: SendInviteEmailRequest
  ): Promise<{ success: boolean; message: string; inviteUrl?: string }> => {
    const response = await fetch('/api/invites/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send invite email');
    }
    return response.json();
  },

  sendInviteSms: async (
    data: SendInviteSmsRequest
  ): Promise<{ success: boolean; message: string; messageId?: string }> => {
    const response = await fetch('/api/invites/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send invite SMS');
    }
    return response.json();
  },
};
