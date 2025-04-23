import { api } from './client';
import { User } from '../auth/types';

interface LoginResponse {
  user: User;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}

interface LoginRequest {
  email: string;
  password: string;
}

interface PasswordResetRequest {
  email: string;
}

interface PasswordResetConfirmRequest {
  token: string;
  password: string;
}

export const authApi = {
  /**
   * Login with email and password
   */
  login: (credentials: LoginRequest) => 
    api.post<LoginResponse>('/auth/login', credentials),
  
  /**
   * Log out and invalidate the session
   */
  logout: (token: string) => 
    api.post<{ message: string }>('/auth/logout', undefined, token),
  
  /**
   * Request a password reset email
   */
  requestPasswordReset: (data: PasswordResetRequest) => 
    api.post<{ message: string }>('/auth/reset-password', data),
  
  /**
   * Confirm password reset with token and new password
   */
  confirmPasswordReset: (data: PasswordResetConfirmRequest) => 
    api.post<{ message: string }>('/auth/confirm-reset-password', data),
  
  /**
   * Verify if a token is valid
   */
  verifyToken: (token: string) => 
    api.post<{ valid: boolean, user?: User }>('/auth/verify-token', undefined, token),
}; 