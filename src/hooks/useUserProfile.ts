import { useState, useCallback, useEffect } from 'react';
import { updateProfile } from 'firebase/auth';
import { useAuthContext } from '../contexts/AuthContext';

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

/**
 * useUserProfile Hook
 * Manages user profile in Firestore
 */
export function useUserProfile(): UseUserProfileState & UseUserProfileActions {
  const { user } = useAuthContext();
  const [state, setState] = useState<UseUserProfileState>({
    profile: null,
    loading: true,
    error: null,
  });

  // Initialize or fetch profile from Firestore
  useEffect(() => {
    if (!user) {
      setState({ profile: null, loading: false, error: null });
      return;
    }

    const initializeProfile = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        const path = `users/${user.uid}`;
        
        // Import and use setDoc to create profile if it doesn't exist
        const { doc, getDoc, setDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase.config');
        
        const docRef = doc(db, path);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          // Create new profile
          const newProfile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || '',
            photoURL: user.photoURL || undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            preferences: {
              theme: 'light',
              notifications: true,
              language: 'en',
            },
          };

          await setDoc(docRef, newProfile);
          setState((prev) => ({ ...prev, profile: newProfile, loading: false }));
        } else {
          setState((prev) => ({ ...prev, profile: docSnap.data() as UserProfile, loading: false }));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to initialize profile';
        setState((prev) => ({ ...prev, error: message, loading: false }));
      }
    };

    initializeProfile();
  }, [user]);

  const updateUserProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      if (!user) return;

      try {
        setState((prev) => ({ ...prev, error: null }));

        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase.config');

        const docRef = doc(db, `users/${user.uid}`);
        
        await updateDoc(docRef, {
          ...updates,
          updatedAt: Date.now(),
        });

        setState((prev) => ({
          ...prev,
          profile: prev.profile ? { ...prev.profile, ...updates, updatedAt: Date.now() } : null,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update profile';
        setState((prev) => ({ ...prev, error: message }));
        throw error;
      }
    },
    [user]
  );

  const updateDisplayNameFn = useCallback(
    async (name: string) => {
      if (!user) return;

      try {
        setState((prev) => ({ ...prev, error: null }));

        // Update Firebase Auth profile
        await updateProfile(user, { displayName: name });

        // Update Firestore profile
        await updateUserProfile({ displayName: name } as any);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update display name';
        setState((prev) => ({ ...prev, error: message }));
        throw error;
      }
    },
    [user, updateUserProfile]
  );

  const updatePhotoURLFn = useCallback(
    async (url: string) => {
      if (!user) return;

      try {
        setState((prev) => ({ ...prev, error: null }));

        // Update Firebase Auth profile
        await updateProfile(user, { photoURL: url });

        // Update Firestore profile
        await updateUserProfile({ photoURL: url } as any);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update photo';
        setState((prev) => ({ ...prev, error: message }));
        throw error;
      }
    },
    [user, updateUserProfile]
  );

  const refetch = useCallback(async () => {
    if (!user) return;

    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase.config');

      const docRef = doc(db, `users/${user.uid}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setState((prev) => ({ ...prev, profile: docSnap.data() as UserProfile, loading: false }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refetch profile';
      setState((prev) => ({ ...prev, error: message, loading: false }));
    }
  }, [user]);

  return {
    ...state,
    updateProfile: updateUserProfile,
    updateDisplayName: updateDisplayNameFn,
    updatePhotoURL: updatePhotoURLFn,
    refetch,
  };
}
