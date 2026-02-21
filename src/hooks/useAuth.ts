import { useEffect, useState } from 'react';
import { auth } from '../firebase.config';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';

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

/**
 * useAuth Hook
 * Manages Firebase authentication state and provides auth actions
 */
export function useAuth(): AuthState & AuthActions {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  // Enable persistent authentication
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(console.error);
  }, []);

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setState((prev) => ({
        ...prev,
        user,
        loading: false,
      }));
    });

    return unsubscribe;
  }, []);

  const signup = async (email: string, password: string) => {
    try {
      setState((prev) => ({ ...prev, error: null, loading: true }));
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signup failed';
      setState((prev) => ({ ...prev, error: message, loading: false }));
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setState((prev) => ({ ...prev, error: null, loading: true }));
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      setState((prev) => ({ ...prev, error: message, loading: false }));
      throw error;
    }
  };

  const logout = async () => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      await signOut(auth);
      setState((prev) => ({ ...prev, user: null }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Logout failed';
      setState((prev) => ({ ...prev, error: message }));
      throw error;
    }
  };

  const clearError = () => {
    setState((prev) => ({ ...prev, error: null }));
  };

  return {
    ...state,
    signup,
    login,
    logout,
    clearError,
  };
}
