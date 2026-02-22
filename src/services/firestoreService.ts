/**
 * Firestore Service - Write processed metrics data to Firestore
 * Ensures data persists across devices and sessions
 */

import { getDb } from '../firebase.config';
import type { Metrics, TimeSeriesData } from '../types';

const COLLECTION = 'gtt-reports';
const METRICS_DOC = 'metrics';
const TIMESERIES_DOC = 'timeseries';
const SUMMARY_DOC = 'summary';

/**
 * Write metrics data to Firestore
 */
export async function saveMetricsToFirestore(metrics: Metrics[]): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn('[Firestore] Database not initialized, skipping metrics save');
      return false;
    }

    const { collection, doc, setDoc } = await import('firebase/firestore');

    const collectionRef = collection(db, COLLECTION);
    const docRef = doc(collectionRef, METRICS_DOC);

    // Store metrics with timestamp
    await setDoc(docRef, {
      data: metrics,
      updatedAt: new Date().toISOString(),
      rowCount: metrics.length,
    }, { merge: true });

    console.log(`[Firestore] ✅ Saved ${metrics.length} metric rows`);
    return true;
  } catch (error) {
    console.error('[Firestore] Error saving metrics:', error);
    return false;
  }
}

/**
 * Write time series data to Firestore
 */
export async function saveTimeSeriesDataToFirestore(
  timeSeriesData: TimeSeriesData | null
): Promise<boolean> {
  try {
    if (!timeSeriesData) return false;

    const db = await getDb();
    if (!db) {
      console.warn('[Firestore] Database not initialized, skipping timeseries save');
      return false;
    }

    const { collection, doc, setDoc } = await import('firebase/firestore');

    const collectionRef = collection(db, COLLECTION);
    const docRef = doc(collectionRef, TIMESERIES_DOC);

    // Store time series with timestamp
    await setDoc(docRef, {
      data: timeSeriesData,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log(`[Firestore] ✅ Saved time series data`);
    return true;
  } catch (error) {
    console.error('[Firestore] Error saving time series data:', error);
    return false;
  }
}

/**
 * Write summary statistics to Firestore
 */
export async function saveSummaryToFirestore(summary: {
  totalMetrics: number;
  totalRows: number;
  dataRange: { from?: string; to?: string };
  agentCount: number;
  lastUpdate: string;
}): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn('[Firestore] Database not initialized, skipping summary save');
      return false;
    }

    const { collection, doc, setDoc } = await import('firebase/firestore');

    const collectionRef = collection(db, COLLECTION);
    const docRef = doc(collectionRef, SUMMARY_DOC);

    await setDoc(docRef, summary, { merge: true });

    console.log(`[Firestore] ✅ Saved summary`);
    return true;
  } catch (error) {
    console.error('[Firestore] Error saving summary:', error);
    return false;
  }
}

/**
 * Read metrics from Firestore
 */
export async function readMetricsFromFirestore(): Promise<Metrics[] | null> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn('[Firestore] Database not initialized, skipping metrics read');
      return null;
    }

    const { collection, doc, getDoc } = await import('firebase/firestore');

    const collectionRef = collection(db, COLLECTION);
    const docRef = doc(collectionRef, METRICS_DOC);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const { data } = docSnap.data();
      console.log(`[Firestore] ✅ Read ${data?.length || 0} metric rows from Firestore`);
      return data || [];
    }

    console.log('[Firestore] No metrics found in Firestore');
    return null;
  } catch (error) {
    console.error('[Firestore] Error reading metrics:', error);
    return null;
  }
}

/**
 * Read time series data from Firestore
 */
export async function readTimeSeriesDataFromFirestore(): Promise<TimeSeriesData | null> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn('[Firestore] Database not initialized, skipping timeseries read');
      return null;
    }

    const { collection, doc, getDoc } = await import('firebase/firestore');

    const collectionRef = collection(db, COLLECTION);
    const docRef = doc(collectionRef, TIMESERIES_DOC);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const { data } = docSnap.data();
      console.log('[Firestore] ✅ Read time series data from Firestore');
      return data || null;
    }

    console.log('[Firestore] No time series data found in Firestore');
    return null;
  } catch (error) {
    console.error('[Firestore] Error reading time series data:', error);
    return null;
  }
}

/**
 * Clear all data from Firestore collection
 */
export async function clearFirestoreData(): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;

    const { collection, doc, deleteDoc } = await import('firebase/firestore');

    const collectionRef = collection(db, COLLECTION);

    // Delete main documents
    const docsToDelete = [METRICS_DOC, TIMESERIES_DOC, SUMMARY_DOC];
    for (const docName of docsToDelete) {
      const docRef = doc(collectionRef, docName);
      await deleteDoc(docRef);
    }

    console.log('[Firestore] ✅ Cleared all data');
    return true;
  } catch (error) {
    console.error('[Firestore] Error clearing data:', error);
    return false;
  }
}

/**
 * LEGACY FUNCTIONS (for backwards compatibility with old components)
 * These are stubs for components that are no longer actively used
 */

export async function saveReport(_userId: string, _data: any): Promise<string> {
  console.warn('[Firestore] saveReport is deprecated');
  return '';
}

export async function getTeams(_userId: string): Promise<any[]> {
  console.warn('[Firestore] getTeams is deprecated');
  return [];
}

export async function saveTeams(_userId: string, _teams: any[]): Promise<void> {
  console.warn('[Firestore] saveTeams is deprecated');
}

export async function getSeniors(_userId: string): Promise<string[]> {
  console.warn('[Firestore] getSeniors is deprecated');
  return [];
}

export async function saveSeniors(_userId: string, _seniors: string[]): Promise<void> {
  console.warn('[Firestore] saveSeniors is deprecated');
}

export async function getNewHires(_userId: string): Promise<string[]> {
  console.warn('[Firestore] getNewHires is deprecated');
  return [];
}

export async function saveNewHires(_userId: string, _newHires: string[]): Promise<void> {
  console.warn('[Firestore] saveNewHires is deprecated');
}
