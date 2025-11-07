import { User as SupabaseUser } from '@supabase/supabase-js';

// Auth types
export type UserRole = 'ADMINSTAFF' | 'TUTOR' | 'STUDENT';

export type User = SupabaseUser;

export interface AuthState {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
} 