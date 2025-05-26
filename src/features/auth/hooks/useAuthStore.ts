import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/shared/lib/supabase/db/types';
import { AuthState, User } from '../types';

const initialState: Omit<AuthState, 'login' | 'logout' | 'refreshSession' | 'clearError' | 'setLoading' | 'setAuth' | 'clearAuth' | 'initializeAuth'> = {
  isAuthenticated: false,
  user: null,
  token: null,
  loading: false,
  error: null,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialState,

      login: async (email: string, password: string) => {
        set({ loading: true, error: null });
        try {
          console.log('Attempting login with:', { email }); // Debug log
          
          // Use client component client directly for browser auth
          const supabase = createClientComponentClient<Database>();
          
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          if (error) {
            console.error('Login error:', error.message);
            throw error;
          }

          if (!data.user || !data.session) {
            console.error('Login successful but no user or session returned');
            throw new Error('Authentication failed: No user or session data');
          }

          console.log('Login successful:', { 
            user: data.user.email,
            hasSession: !!data.session
          });

          set({
            isAuthenticated: true,
            user: data.user,
            token: data.session?.access_token || null,
            loading: false,
          });
        } catch (error) {
          console.error('Login error details:', error);
          set({
            loading: false,
            error: error instanceof Error ? error.message : 'An error occurred',
          });
        }
      },

      logout: async () => {
        set({ loading: true });
        try {
          const supabase = createClientComponentClient<Database>();
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({ ...initialState });
        }
      },

      refreshSession: async () => {
        set({ loading: true });
        try {
          const supabase = createClientComponentClient<Database>();
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) throw error;
          
          if (session) {
            set({
              isAuthenticated: true,
              user: session.user,
              token: session.access_token,
              loading: false,
            });
          } else {
            set({ ...initialState });
          }
        } catch (error) {
          set({ ...initialState });
        }
      },

      clearError: () => set({ error: null }),
      setLoading: (loading: boolean) => set({ loading }),

      setAuth: (user: User) => set({ isAuthenticated: true, user }),
      clearAuth: () => set({ isAuthenticated: false, user: null }),
      
      initializeAuth: async () => {
        set({ loading: true });
        try {
          const supabase = createClientComponentClient<Database>();
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Auth initialization error:', error);
            set({ isAuthenticated: false, user: null, loading: false });
            return;
          }
          
          if (session?.user) {
            console.log('Session restored:', { user: session.user.email });
            set({ 
              isAuthenticated: true, 
              user: session.user,
              token: session.access_token,
              loading: false 
            });
          } else {
            console.log('No existing session found');
            set({ isAuthenticated: false, user: null, loading: false });
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          set({ isAuthenticated: false, user: null, loading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      // Add hydration handling to initialize auth on app start
      onRehydrateStorage: () => (state) => {
        if (state && typeof window !== 'undefined') {
          // Only initialize on client side
          setTimeout(() => {
            state.initializeAuth();
          }, 0);
        }
      },
    }
  )
); 