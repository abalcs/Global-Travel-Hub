/**
 * useAuth Hook — DISABLED
 * Auth is currently disabled. This returns safe no-op defaults.
 * To re-enable: restore the original implementation from git history.
 */
import { useState } from 'react';
import type { User } from 'firebase/auth';

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export interface AuthActions {
  signup: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export function useAuth(): AuthState & AuthActions {
  const [state] = useState<AuthState>({
    user: null,
    loading: false,
    error: null,
  });

  const signup = async () => { throw new Error('Auth disabled'); };
  const login = async () => { throw new Error('Auth disabled'); };
  const logout = async () => { throw new Error('Auth disabled'); };
  const clearError = () => {};

  return { ...state, signup, login, logout, clearError };
}
