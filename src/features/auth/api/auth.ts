import { supabaseServer } from '@/shared/lib/supabase/client';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/shared/lib/supabase/db/types';
import { LoginRequest, PasswordResetRequest, PasswordResetConfirmRequest } from '../types';

export const authApi = {
  /**
   * Login with email and password
   */
  login: async (credentials: LoginRequest) => {
    const { data, error } = await supabaseServer.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) throw error;

    return {
      user: data.user,
      session: {
        access_token: data.session?.access_token || '',
        refresh_token: data.session?.refresh_token || '',
        expires_at: data.session?.expires_at || 0,
      },
    };
  },
  
  /**
   * Log out and invalidate the session
   */
  logout: async () => {
    const { error } = await supabaseServer.auth.signOut();
    if (error) throw error;
    return { message: 'Logged out successfully' };
  },
  
  /**
   * Request a password reset email
   */
  requestPasswordReset: async (data: PasswordResetRequest) => {
    if (typeof window === 'undefined') {
      throw new Error('This method must be called from the browser');
    }
    
    // Use client component client for better auth handling
    const supabase = createClientComponentClient<Database>();
    
    const { error } = await supabase.auth.resetPasswordForEmail(
      data.email,
      {
        redirectTo: `${window.location.origin}/auth/callback`,
      }
    );
    
    if (error) {
      console.error('Password reset request error:', error);
      throw new Error(error.message || 'Failed to send password reset email');
    }
    
    return { message: 'Password reset email sent successfully' };
  },
  
  /**
   * Confirm password reset with new password
   * This works with both modern (query params) and legacy (hash) Supabase flows
   */
  confirmPasswordReset: async (data: PasswordResetConfirmRequest) => {
    try {
      // Use client component client for proper auth context
      const supabase = createClientComponentClient<Database>();

      // First, check if we have a valid session from the reset token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error during password reset:', sessionError);
        throw new Error('Invalid or expired reset token. Please request a new password reset.');
      }

      if (!session) {
        throw new Error('No active session found. Please click the reset link again.');
      }

      // Update the user's password
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password: data.password
      });
      
      if (updateError) {
        console.error('Password update error:', updateError);
        
        // Provide more specific error messages
        if (updateError.message.includes('same as the old password')) {
          throw new Error('New password must be different from your current password.');
        } else if (updateError.message.includes('password')) {
          throw new Error('Password does not meet security requirements. Please choose a stronger password.');
        } else {
          throw new Error(updateError.message || 'Failed to update password. Please try again.');
        }
      }

      if (!updateData.user) {
        throw new Error('Failed to update password. Please try again.');
      }

      return { 
        message: 'Password updated successfully',
        user: updateData.user 
      };
    } catch (error) {
      console.error('Password reset confirmation error:', error);
      
      if (error instanceof Error) {
        throw error; // Re-throw custom errors
      }
      
      throw new Error('An unexpected error occurred. Please try again or request a new reset link.');
    }
  },
  
  /**
   * Verify if current session is valid
   */
  verifyToken: async () => {
    try {
      const { data: { session }, error } = await supabaseServer.auth.getSession();
      if (error) {
        console.error('Token verification error:', error);
        return { valid: false, error: error.message };
      }
      
      return {
        valid: !!session,
        user: session?.user || undefined,
        session: session || undefined,
      };
    } catch (error) {
      console.error('Token verification failed:', error);
      return { valid: false, error: 'Failed to verify token' };
    }
  },

  /**
   * Get current authenticated user
   */
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabaseServer.auth.getUser();
      if (error) {
        throw new Error(error.message || 'Failed to get current user');
      }
      return user;
    } catch (error) {
      console.error('Get current user error:', error);
      throw error;
    }
  },

  /**
   * Get current session
   */
  async getSession() {
    try {
      const { data: { session }, error } = await supabaseServer.auth.getSession();
      if (error) {
        throw new Error(error.message || 'Failed to get session');
      }
      return session;
    } catch (error) {
      console.error('Get session error:', error);
      throw error;
    }
  },
}; 