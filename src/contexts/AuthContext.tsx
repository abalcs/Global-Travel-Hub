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
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuth();

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

/**
 * useAuthContext Hook
 * Use this in components to access auth state and actions
 */
export function useAuthContext(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}
