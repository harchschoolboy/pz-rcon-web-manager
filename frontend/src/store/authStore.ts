import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '../api/client';

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  token: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      username: null,
      token: null,

      login: async (username: string, password: string) => {
        try {
          const response = await authAPI.login({ username, password });
          authAPI.setToken(response.access_token);
          set({ 
            isAuthenticated: true, 
            username,
            token: response.access_token
          });
          return true;
        } catch (error) {
          console.error('Login failed:', error);
          return false;
        }
      },

      logout: () => {
        localStorage.removeItem('auth_token');
        set({ isAuthenticated: false, username: null, token: null });
      },

      checkAuth: async () => {
        const token = authAPI.getToken();
        if (!token) {
          set({ isAuthenticated: false, username: null, token: null });
          return false;
        }
        
        try {
          const response = await authAPI.verify();
          set({ 
            isAuthenticated: true, 
            username: response.username,
            token
          });
          return true;
        } catch (error) {
          localStorage.removeItem('auth_token');
          set({ isAuthenticated: false, username: null, token: null });
          return false;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        isAuthenticated: state.isAuthenticated,
        username: state.username 
      }),
    }
  )
);
