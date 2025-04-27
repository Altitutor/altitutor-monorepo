import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthState, User } from './types';
import { supabase } from '../api/auth';

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  loading: false,
  error: null,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, _get) => ({
      ...initialState,

      login: async (email: string, password: string) => {
        set({ loading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          if (error) throw error;

          set({
            isAuthenticated: true,
            user: data.user,
            token: data.session?.access_token || null,
            loading: false,
          });
        } catch (error) {
          set({
            loading: false,
            error: error instanceof Error ? error.message : 'An error occurred',
          });
        }
      },

      logout: async () => {
        set({ loading: true });
        try {
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
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            set({ isAuthenticated: true, user });
          } else {
            set({ isAuthenticated: false, user: null });
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          set({ isAuthenticated: false, user: null });
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
    }
  )
); 