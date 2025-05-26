import { User as SupabaseUser } from '@supabase/supabase-js';

// Auth types
export type UserRole = 'ADMINSTAFF' | 'TUTOR' | 'STUDENT';

export type User = SupabaseUser;

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
  setAuth: (user: User) => void;
  clearAuth: () => void;
  initializeAuth: () => Promise<void>;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  password: string;
} 