/**
 * useFirestore hooks — DISABLED
 * These hooks are not currently used in the active app.
 * They remain as stubs to satisfy TypeScript imports.
 * To re-enable: restore from git history and update to use getDb() from firebase.config.
 */

import { useState } from 'react';

export interface UseFirestoreState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface UseFirestoreActions<T> {
  set: (data: T) => Promise<void>;
  update: (data: Partial<T>) => Promise<void>;
  delete: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useFirestoreDoc<T>(
  _path: string,
): UseFirestoreState<T> & UseFirestoreActions<T> {
  const [state] = useState<UseFirestoreState<T>>({
    data: null,
    loading: false,
    error: 'Firestore hooks disabled',
  });

  return {
    ...state,
    set: async () => { throw new Error('Firestore hooks disabled'); },
    update: async () => { throw new Error('Firestore hooks disabled'); },
    delete: async () => { throw new Error('Firestore hooks disabled'); },
    refetch: async () => { throw new Error('Firestore hooks disabled'); },
  };
}

export function useFirestoreQuery<T>(
  _collectionPath: string,
  _conditions?: Array<[string, any, string]>,
): UseFirestoreState<T[]> & { refetch: () => Promise<void> } {
  const [state] = useState<UseFirestoreState<T[]>>({
    data: [],
    loading: false,
    error: 'Firestore hooks disabled',
  });

  return {
    ...state,
    refetch: async () => { throw new Error('Firestore hooks disabled'); },
  };
}
