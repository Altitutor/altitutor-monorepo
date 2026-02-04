/**
 * API client functions for invite workflows
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

export interface ValidateInviteResponse {
  valid: boolean;
  type?: 'staff' | 'student';
  data?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role?: string;
  };
  error?: string;
}

export interface AcceptInviteRequest {
  token: string;
  email: string;
  password: string;
}

export interface AcceptInviteResponse {
  success: boolean;
  message: string;
  data?: unknown;
  session?: unknown;
}

export const invitesApi = {
  /**
   * Generate an invite token for a staff member or student
   */
  generateInviteToken: async (data: GenerateInviteRequest): Promise<GenerateInviteResponse> => {
    const response = await fetch('/api/invites/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate invite token');
    }

    return response.json();
  },

  /**
   * Send an invite via email
   */
  sendInviteEmail: async (data: SendInviteEmailRequest): Promise<{ success: boolean; message: string; inviteUrl?: string }> => {
    const response = await fetch('/api/invites/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send invite email');
    }

    return response.json();
  },

  /**
   * Send an invite via SMS
   */
  sendInviteSms: async (data: SendInviteSmsRequest): Promise<{ success: boolean; message: string; messageId?: string }> => {
    const response = await fetch('/api/invites/send-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send invite SMS');
    }

    return response.json();
  },

  /**
   * Validate an invite token
   */
  validateInvite: async (token: string, baseUrl: string = ''): Promise<ValidateInviteResponse> => {
    const url = baseUrl ? `${baseUrl}/api/invites/validate?token=${token}` : `/api/invites/validate?token=${token}`;
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json();
      return { valid: false, error: error.error || 'Invalid or expired token' };
    }

    return response.json();
  },

  /**
   * Accept an invite and create an account
   */
  acceptInvite: async (data: AcceptInviteRequest, baseUrl: string = ''): Promise<AcceptInviteResponse> => {
    const url = baseUrl ? `${baseUrl}/api/invites/accept` : `/api/invites/accept`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to accept invite');
    }

    return response.json();
  },
};

