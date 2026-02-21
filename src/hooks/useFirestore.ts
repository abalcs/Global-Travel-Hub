import { useState, useCallback, useEffect } from 'react';
import { db } from '../firebase.config';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  Query,
  DocumentData,
  Unsubscribe,
} from 'firebase/firestore';

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

/**
 * useFirestoreDoc Hook
 * Read/write/update/delete a single Firestore document
 */
export function useFirestoreDoc<T extends DocumentData>(
  path: string,
): UseFirestoreState<T> & UseFirestoreActions<T> {
  const [state, setState] = useState<UseFirestoreState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const docRef = doc(db, path);

  const fetchDoc = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setState((prev) => ({ ...prev, data: docSnap.data() as T, loading: false }));
      } else {
        setState((prev) => ({ ...prev, data: null, loading: false }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch document';
      setState((prev) => ({ ...prev, error: message, loading: false }));
    }
  }, [docRef]);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setState((prev) => ({ ...prev, data: docSnap.data() as T, loading: false }));
        } else {
          setState((prev) => ({ ...prev, data: null, loading: false }));
        }
      },
      (error) => {
        const message = error instanceof Error ? error.message : 'Real-time sync error';
        setState((prev) => ({ ...prev, error: message, loading: false }));
      }
    );

    return unsubscribe;
  }, [docRef]);

  const set = async (data: T) => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      await setDoc(docRef, data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set document';
      setState((prev) => ({ ...prev, error: message }));
      throw error;
    }
  };

  const update = async (data: Partial<T>) => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      await updateDoc(docRef, data as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update document';
      setState((prev) => ({ ...prev, error: message }));
      throw error;
    }
  };

  const deleteDoc_ = async () => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      await deleteDoc(docRef);
      setState((prev) => ({ ...prev, data: null }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete document';
      setState((prev) => ({ ...prev, error: message }));
      throw error;
    }
  };

  return {
    ...state,
    set,
    update,
    delete: deleteDoc_,
    refetch: fetchDoc,
  };
}

/**
 * useFirestoreQuery Hook
 * Query multiple documents from Firestore
 */
export function useFirestoreQuery<T extends DocumentData>(
  collectionPath: string,
  conditions?: Array<[string, any, string]>, // [field, value, operator]
): UseFirestoreState<T[]> & { refetch: () => Promise<void> } {
  const [state, setState] = useState<UseFirestoreState<T[]>>({
    data: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let q: Query;

    if (conditions && conditions.length > 0) {
      const [field, value, operator] = conditions[0];
      q = query(collection(db, collectionPath), where(field, operator as any, value));
    } else {
      q = query(collection(db, collectionPath));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as T));
        setState((prev) => ({ ...prev, data: docs, loading: false }));
      },
      (error) => {
        const message = error instanceof Error ? error.message : 'Query error';
        setState((prev) => ({ ...prev, error: message, loading: false }));
      }
    );

    return unsubscribe;
  }, [collectionPath, conditions]);

  const refetch = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      let q: Query;
      if (conditions && conditions.length > 0) {
        const [field, value, operator] = conditions[0];
        q = query(collection(db, collectionPath), where(field, operator as any, value));
      } else {
        q = query(collection(db, collectionPath));
      }

      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as T));
      setState((prev) => ({ ...prev, data: docs, loading: false, error: null }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Refetch error';
      setState((prev) => ({ ...prev, error: message, loading: false }));
    }
  }, [collectionPath, conditions]);

  return {
    ...state,
    refetch,
  };
}
