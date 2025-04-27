import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  login: async (credentials: LoginRequest) => {
    const { data, error } = await supabase.auth.signInWithPassword({
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
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { message: 'Logged out successfully' };
  },
  
  /**
   * Request a password reset email
   */
  requestPasswordReset: async (data: PasswordResetRequest) => {
    const { error } = await supabase.auth.resetPasswordForEmail(data.email);
    if (error) throw error;
    return { message: 'Password reset email sent' };
  },
  
  /**
   * Confirm password reset with token and new password
   */
  confirmPasswordReset: async (data: PasswordResetConfirmRequest) => {
    const { error } = await supabase.auth.updateUser({
      password: data.password,
    });
    if (error) throw error;
    return { message: 'Password updated successfully' };
  },
  
  /**
   * Verify if a token is valid
   */
  verifyToken: async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    
    return {
      valid: !!session,
      user: session?.user || undefined,
    };
  },

  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      throw error;
    }
    return user;
  },

  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }
    return session;
  },
}; 