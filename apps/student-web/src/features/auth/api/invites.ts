/**
 * API client functions for student invite workflows
 */

export interface ValidateInviteResponse {
  valid: boolean;
  type?: 'student';
  data?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
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
  data?: any;
  session?: any;
}

export const invitesApi = {
  /**
   * Validate an invite token
   */
  validateInvite: async (token: string): Promise<ValidateInviteResponse> => {
    const response = await fetch(`/api/invites/validate?token=${token}`);

    if (!response.ok) {
      const error = await response.json();
      return { valid: false, error: error.error || 'Invalid or expired token' };
    }

    return response.json();
  },

  /**
   * Accept an invite and create an account
   */
  acceptInvite: async (data: AcceptInviteRequest): Promise<AcceptInviteResponse> => {
    const response = await fetch('/api/invites/accept', {
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

