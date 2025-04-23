import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthState, AuthStore } from './types';
import { authApi } from '../api/auth';

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  loading: false,
  error: null,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      login: async (email: string, password: string) => {
        set({ loading: true, error: null });
        try {
          const response = await authApi.login({ email, password });
          set({
            isAuthenticated: true,
            user: response.user,
            token: response.session.access_token,
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
        const token = get().token;
        if (!token) {
          set({ ...initialState });
          return;
        }
        
        set({ loading: true });
        try {
          await authApi.logout(token);
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({ ...initialState });
        }
      },

      refreshSession: async () => {
        const token = get().token;
        if (!token) return;

        set({ loading: true });
        try {
          const response = await authApi.verifyToken(token);
          if (response.valid && response.user) {
            set({
              isAuthenticated: true,
              user: response.user,
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