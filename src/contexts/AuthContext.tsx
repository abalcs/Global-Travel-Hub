import React, { createContext } from 'react';
import type { ReactNode } from 'react';
import { useAuth, type AuthState, type AuthActions } from '../hooks/useAuth';

export type AuthContextType = AuthState & AuthActions;

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider
 * Wraps your app and provides authentication context
 * Currently disabled — uncomment in main.tsx when ready to re-enable
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuth();

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

// Default no-op auth state for when AuthProvider is not in the tree
const noopAuth: AuthContextType = {
  user: null,
  loading: false,
  error: null,
  signup: async () => { throw new Error('Auth disabled'); },
  login: async () => { throw new Error('Auth disabled'); },
  logout: async () => { throw new Error('Auth disabled'); },
  clearError: () => {},
};

/**
 * useAuthContext Hook
 * Use this in components to access auth state and actions.
 * Returns a safe no-op default if AuthProvider is not mounted
 * (instead of throwing), so the app works with auth disabled.
 */
export function useAuthContext(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    // Auth provider not mounted — return safe defaults instead of crashing
    return noopAuth;
  }
  return context;
}
