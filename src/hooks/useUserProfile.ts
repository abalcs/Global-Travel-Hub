/**
 * useUserProfile — DISABLED
 * Auth and user profiles are disabled. Stub to satisfy TypeScript.
 * To re-enable: restore from git history.
 */

import { useState } from 'react';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: number;
  updatedAt: number;
  preferences?: {
    theme?: 'light' | 'dark';
    notifications?: boolean;
    language?: string;
  };
}

export interface UseUserProfileState {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

export interface UseUserProfileActions {
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  updatePhotoURL: (url: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useUserProfile(): UseUserProfileState & UseUserProfileActions {
  const [state] = useState<UseUserProfileState>({
    profile: null,
    loading: false,
    error: null,
  });

  return {
    ...state,
    updateProfile: async () => { throw new Error('Auth disabled'); },
    updateDisplayName: async () => { throw new Error('Auth disabled'); },
    updatePhotoURL: async () => { throw new Error('Auth disabled'); },
    refetch: async () => { throw new Error('Auth disabled'); },
  };
}
