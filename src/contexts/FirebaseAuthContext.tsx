/**
 * Firebase Authentication Context
 * Provides user auth state and methods throughout the app
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AuthUser } from '../services/authService';
import { onAuthChange, logout as firebaseLogout } from '../services/authService';

interface FirebaseAuthContextType {
  user: AuthUser;
  loading: boolean;
  logout: () => Promise<void>;
}

const FirebaseAuthContext = createContext<FirebaseAuthContextType | undefined>(undefined);

export const FirebaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    try {
      await firebaseLogout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  };

  const value: FirebaseAuthContextType = {
    user,
    loading,
    logout,
  };

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
};

// Default no-op state for when FirebaseAuthProvider is not in the tree
const noopFirebaseAuth: FirebaseAuthContextType = {
  user: null,
  loading: false,
  logout: async () => { throw new Error('Auth disabled'); },
};

export const useFirebaseAuth = (): FirebaseAuthContextType => {
  const context = useContext(FirebaseAuthContext);
  if (!context) {
    // Provider not mounted — return safe defaults instead of crashing
    return noopFirebaseAuth;
  }
  return context;
};
