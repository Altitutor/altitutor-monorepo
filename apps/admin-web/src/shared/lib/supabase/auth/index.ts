import { User as SupabaseUser } from '@supabase/supabase-js';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

// Auth types - role checking is now done via staff table in database
export type UserRole = 'ADMINSTAFF' | 'TUTOR' | 'STUDENT';
export type User = SupabaseUser;

export interface AuthState {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      loading: true,
      setUser: (user) => set({ user }),
      setLoading: (loading) => set({ loading }),
      signOut: async () => {
        const supabase = getSupabaseClient();
        await supabase.auth.signOut();
        set({ user: null });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
);

// Initialize auth state
export async function initializeAuth() {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  useAuthStore.getState().setUser(user as User);
  useAuthStore.getState().setLoading(false);
}

// Auth state change listener
export function setupAuthListener() {
  const supabase = getSupabaseClient();
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      // For SIGNED_OUT events, set user to null
      if (event === 'SIGNED_OUT') {
        useAuthStore.getState().setUser(null);
        useAuthStore.getState().setLoading(false);
        return;
      }
      
      // For other events, validate the user against the server
      // This prevents using potentially tampered session data from cookies
      if (session) {
        supabase.auth.getUser().then(({ data: { user }, error }) => {
          if (error || !user) {
            console.error('Error validating user:', error);
            useAuthStore.getState().setUser(null);
          } else {
      useAuthStore.getState().setUser(user as User);
          }
        });
      } else {
        useAuthStore.getState().setUser(null);
      }
      
      useAuthStore.getState().setLoading(false);
    }
  );

  return subscription;
} 