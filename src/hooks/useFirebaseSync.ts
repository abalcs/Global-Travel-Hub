/**
 * Firestore Sync Hook
 * Provides real-time sync between local state and Firestore
 * Falls back to localStorage for offline support
 */

import { useCallback, useEffect, useState } from 'react';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import * as firestore from '../services/firestoreService';
import type { Team, Metrics, TimeSeriesData } from '../types';

interface SyncOptions {
  fallbackToLocal?: boolean; // Use localStorage as fallback
  syncInterval?: number; // Auto-sync interval in ms
}

/**
 * Hook for syncing teams data
 */
export const useFirebaseTeams = (options: SyncOptions = {}) => {
  const { user } = useFirebaseAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { fallbackToLocal = true } = options;

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadTeams = async () => {
      try {
        const firebaseTeams = await firestore.getTeams(user.uid);
        setTeams(firebaseTeams);
        setError(null);
      } catch (err) {
        console.error('Failed to load teams:', err);
        if (fallbackToLocal) {
          const localTeams = localStorage.getItem('kpi-report-teams');
          if (localTeams) {
            setTeams(JSON.parse(localTeams));
          }
        }
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    loadTeams();
  }, [user, fallbackToLocal]);

  const saveTeams = useCallback(
    async (newTeams: Team[]) => {
      if (!user) return;

      setTeams(newTeams);

      try {
        await firestore.saveTeams(user.uid, newTeams);
        // Also save to localStorage as backup
        if (fallbackToLocal) {
          localStorage.setItem('kpi-report-teams', JSON.stringify(newTeams));
        }
      } catch (err) {
        console.error('Failed to save teams:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        throw err;
      }
    },
    [user, fallbackToLocal]
  );

  return { teams, loading, error, saveTeams };
};

/**
 * Hook for syncing seniors data
 */
export const useFirebaseSeniors = (options: SyncOptions = {}) => {
  const { user } = useFirebaseAuth();
  const [seniors, setSeniors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { fallbackToLocal = true } = options;

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadSeniors = async () => {
      try {
        const firebaseSeniors = await firestore.getSeniors(user.uid);
        setSeniors(firebaseSeniors);
        setError(null);
      } catch (err) {
        console.error('Failed to load seniors:', err);
        if (fallbackToLocal) {
          const localSeniors = localStorage.getItem('kpi-report-seniors');
          if (localSeniors) {
            setSeniors(JSON.parse(localSeniors));
          }
        }
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    loadSeniors();
  }, [user, fallbackToLocal]);

  const saveSeniors = useCallback(
    async (newSeniors: string[]) => {
      if (!user) return;

      setSeniors(newSeniors);

      try {
        await firestore.saveSeniors(user.uid, newSeniors);
        if (fallbackToLocal) {
          localStorage.setItem('kpi-report-seniors', JSON.stringify(newSeniors));
        }
      } catch (err) {
        console.error('Failed to save seniors:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        throw err;
      }
    },
    [user, fallbackToLocal]
  );

  return { seniors, loading, error, saveSeniors };
};

/**
 * Hook for syncing new hires data
 */
export const useFirebaseNewHires = (options: SyncOptions = {}) => {
  const { user } = useFirebaseAuth();
  const [newHires, setNewHires] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { fallbackToLocal = true } = options;

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadNewHires = async () => {
      try {
        const firebaseNewHires = await firestore.getNewHires(user.uid);
        setNewHires(firebaseNewHires);
        setError(null);
      } catch (err) {
        console.error('Failed to load new hires:', err);
        if (fallbackToLocal) {
          const localNewHires = localStorage.getItem('kpi-report-new-hires');
          if (localNewHires) {
            setNewHires(JSON.parse(localNewHires));
          }
        }
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    loadNewHires();
  }, [user, fallbackToLocal]);

  const saveNewHires = useCallback(
    async (newNewHires: string[]) => {
      if (!user) return;

      setNewHires(newNewHires);

      try {
        await firestore.saveNewHires(user.uid, newNewHires);
        if (fallbackToLocal) {
          localStorage.setItem('kpi-report-new-hires', JSON.stringify(newNewHires));
        }
      } catch (err) {
        console.error('Failed to save new hires:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        throw err;
      }
    },
    [user, fallbackToLocal]
  );

  return { newHires, loading, error, saveNewHires };
};
