import { useEffect, useState } from 'react';
import { db } from '../firebase.config';
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';

export interface SharedReport {
  id?: string;
  name: string;
  type: string;
  description?: string;
  data: any[];
  tags?: string[];
  createdAt: any;
  updatedAt: any;
  metadata?: any;
}

export interface UseSharedReportsState {
  reports: SharedReport[];
  loading: boolean;
  error: string | null;
}

/**
 * useSharedReports Hook
 * Fetches shared reports from the shared/reports collection
 * All authenticated users see the same reports
 */
export function useSharedReports(): UseSharedReportsState & { refetch: () => Promise<void> } {
  const [state, setState] = useState<UseSharedReportsState>({
    reports: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    try {
      const q = query(
        collection(db, 'gtt_reports'),
        orderBy('updatedAt', 'desc')
      );

      // Subscribe to real-time updates
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const reports = snapshot.docs
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
            } as SharedReport))
            .filter(report => report.name && report.type); // Filter out metadata docs like _summary

          setState((prev) => ({
            ...prev,
            reports,
            loading: false,
          }));
        },
        (error) => {
          const message = error instanceof Error ? error.message : 'Failed to load shared reports';
          setState((prev) => ({ ...prev, error: message, loading: false }));
        }
      );

      return unsubscribe;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error setting up shared reports listener';
      setState((prev) => ({ ...prev, error: message, loading: false }));
    }
  }, []);

  const refetch = async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const q = query(
        collection(db, 'shared/reports'),
        orderBy('updatedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const reports = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as SharedReport))
        .filter(report => report.name && report.type);

      setState((prev) => ({ ...prev, reports, loading: false }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refetch reports';
      setState((prev) => ({ ...prev, error: message, loading: false }));
    }
  };

  return {
    ...state,
    refetch,
  };
}
