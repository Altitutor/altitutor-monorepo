import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Database } from '../database/generated';

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
        const supabase = createClientComponentClient<Database>();
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
  const supabase = createClientComponentClient<Database>();
  const { data: { user } } = await supabase.auth.getUser();
  useAuthStore.getState().setUser(user as User);
  useAuthStore.getState().setLoading(false);
}

// Auth state change listener
export function setupAuthListener() {
  const supabase = createClientComponentClient<Database>();
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      const user = session?.user ?? null;
      useAuthStore.getState().setUser(user as User);
      useAuthStore.getState().setLoading(false);
    }
  );

  return subscription;
} 