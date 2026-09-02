/**
 * Firestore Sync Utility
 * Saves parsed report data to Firestore so it can be loaded by ANY browser session.
 *
 * Data is stored in the `gtt_raw_data` collection using a batched format:
 *   {dataType}_batch_0, {dataType}_batch_1, ...
 * Each batch doc holds up to BATCH_SIZE rows in a `data` array field,
 * plus metadata (uploadedAt, totalRows, batchIndex).
 *
 * Also handles app configuration (teams, seniors, new hires) persistence
 * in a single `gtt_app_config` document so settings survive across browsers.
 *
 * Firestore doc size limit is ~1 MB. With typical Salesforce report rows
 * (~20-30 columns, short values), 2000 rows per batch is safely under that.
 */

import type { RawParsedData, CrmParsedData } from './indexedDB';
import type { CrmRow } from './excelParser';
import type { Team } from '../types';
import { getDb } from '../firebase.config';

const COLLECTION = 'gtt_raw_data';
const BATCH_SIZE = 2000; // rows per Firestore document

/**
 * Save all parsed report data to Firestore in batched format.
 * Overwrites any existing data for each data type.
 * Uses parallel writes for speed. Reports progress via optional callback.
 */
export async function saveRawDataToFirestore(
  data: RawParsedData,
  onProgress?: (progress: number, stage: string) => void
): Promise<boolean> {
  let db: any;
  try {
    db = await getDb();
  } catch (e) {
    console.warn('[FirestoreSync] Firebase init failed:', e);
    return false;
  }

  if (!db) {
    console.warn('[FirestoreSync] Firestore not available — skipping save');
    return false;
  }

  try {
    const { doc, setDoc, deleteDoc, getDoc } = await import('firebase/firestore');

    const dataTypes: (keyof RawParsedData)[] = [
      'trips', 'quotes', 'passthroughs', 'hotPass',
      'bookings', 'nonConverted', 'quotesStarted'
    ];

    const uploadedAt = new Date().toISOString();

    onProgress?.(0, 'Reading existing data...');

    // Step 1: Read batch_0 for all data types in parallel to get old batch counts
    const oldBatchCounts = await Promise.all(
      dataTypes.map(async (dataType) => {
        try {
          const snap = await getDoc(doc(db, COLLECTION, `${dataType}_batch_0`));
          if (snap.exists()) {
            const meta = snap.data();
            return { dataType, oldCount: meta.totalBatches || 1 };
          }
        } catch { /* no existing data */ }
        return { dataType, oldCount: 0 };
      })
    );

    const oldCountMap = new Map(oldBatchCounts.map(({ dataType, oldCount }) => [dataType, oldCount]));

    // Step 2: Build all write and delete operations upfront
    const allOps: Promise<void>[] = [];
    let totalBatches = 0;
    let completedBatches = 0;

    for (const dataType of dataTypes) {
      const rows = data[dataType] || [];
      totalBatches += Math.max(1, Math.ceil(rows.length / BATCH_SIZE));
    }

    onProgress?.(5, 'Syncing all data...');

    for (const dataType of dataTypes) {
      const rows = data[dataType] || [];
      const newBatchCount = Math.max(1, Math.ceil(rows.length / BATCH_SIZE));
      const oldCount = oldCountMap.get(dataType) || 0;

      // Queue setDoc for each new batch (overwrites existing docs)
      for (let i = 0; i < newBatchCount; i++) {
        const batchRows = rows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        const docId = `${dataType}_batch_${i}`;
        allOps.push(
          setDoc(doc(db, COLLECTION, docId), {
            data: batchRows,
            dataType,
            batchIndex: i,
            totalRows: rows.length,
            totalBatches: newBatchCount,
            uploadedAt,
          }).then(() => {
            completedBatches++;
            onProgress?.(
              5 + Math.round((completedBatches / totalBatches) * 90),
              'Syncing all data...'
            );
          })
        );
      }

      // Queue deleteDoc for excess old batches (where old count > new count)
      for (let i = newBatchCount; i < oldCount; i++) {
        allOps.push(
          deleteDoc(doc(db, COLLECTION, `${dataType}_batch_${i}`)).catch(() => {})
        );
      }

      // Queue deleteDoc for legacy single-doc format (no existence check needed)
      allOps.push(
        deleteDoc(doc(db, COLLECTION, dataType)).catch(() => {})
      );
    }

    // Step 3: Execute all writes and deletes in parallel
    await Promise.all(allOps);

    onProgress?.(100, 'Sync complete');
    console.log('[FirestoreSync] All data saved to Firestore');
    return true;
  } catch (error) {
    console.error('[FirestoreSync] Save failed:', error);
    return false;
  }
}

// ─── App Configuration Persistence ───────────────────────────────────────────

const CONFIG_COLLECTION = 'gtt_app_config';
const CONFIG_DOC_ID = 'settings';

export interface AppConfig {
  teams: Team[];
  seniors: string[];
  newHires: string[];
  tams: string[];
  cascades?: string[];
  crmDateRange?: string;
  updatedAt?: string;
}

/**
 * Load app configuration (teams, seniors, new hires) from Firestore.
 * Returns null if no config exists or Firestore is unavailable.
 */
export async function loadConfigFromFirestore(): Promise<AppConfig | null> {
  let db: any;
  try {
    db = await getDb();
  } catch (e) {
    console.warn('[FirestoreSync] Firebase init failed:', e);
    return null;
  }

  if (!db) return null;

  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID));
    if (snap.exists()) {
      const data = snap.data();
      return {
        teams: data.teams || [],
        seniors: data.seniors || [],
        newHires: data.newHires || [],
        tams: data.tams || [],
        cascades: data.cascades || [],
        crmDateRange: data.crmDateRange || '',
        updatedAt: data.updatedAt || null,
      };
    }
    return null;
  } catch (error) {
    console.error('[FirestoreSync] Failed to load config:', error);
    return null;
  }
}

/**
 * Save app configuration to Firestore.
 * Merges with existing config so you can save partial updates.
 */
export async function saveConfigToFirestore(config: Partial<AppConfig>): Promise<boolean> {
  let db: any;
  try {
    db = await getDb();
  } catch (e) {
    console.warn('[FirestoreSync] Firebase init failed:', e);
    return false;
  }

  if (!db) return false;

  try {
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(
      doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID),
      { ...config, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error('[FirestoreSync] Failed to save config:', error);
    return false;
  }
}

// ─── CRM Data Persistence ───────────────────────────────────────────────────

const CRM_COLLECTION = 'gtt_crm_data';

/**
 * Save CRM parsed data (enquiries, passthroughs, quotes, bookings) to Firestore.
 * Uses the same batched format as saveRawDataToFirestore.
 * Also persists the date range string into app config.
 */
export async function saveCrmDataToFirestore(
  data: CrmParsedData,
  dateRange: string,
  onProgress?: (progress: number, stage: string) => void
): Promise<boolean> {
  console.log('[FirestoreSync] saveCrmDataToFirestore called', {
    enquiries: data.enquiries?.length ?? 0,
    passthroughs: data.passthroughs?.length ?? 0,
    quotes: data.quotes?.length ?? 0,
    bookings: data.bookings?.length ?? 0,
    dateRange,
  });

  let db: any;
  try {
    db = await getDb();
  } catch (e) {
    console.warn('[FirestoreSync] Firebase init failed:', e);
    return false;
  }

  console.log('[FirestoreSync] CRM save — db obtained:', !!db);
  if (!db) {
    console.warn('[FirestoreSync] Firestore not available — skipping CRM save');
    return false;
  }

  try {
    const { doc, setDoc, deleteDoc, getDoc } = await import('firebase/firestore');

    const dataTypes: (keyof CrmParsedData)[] = ['enquiries', 'passthroughs', 'quotes', 'bookings'];
    const uploadedAt = new Date().toISOString();

    onProgress?.(0, 'Reading existing CRM data...');

    // Step 1: Read batch_0 for all data types to get old batch counts
    const oldBatchCounts = await Promise.all(
      dataTypes.map(async (dataType) => {
        try {
          const snap = await getDoc(doc(db, CRM_COLLECTION, `${dataType}_batch_0`));
          if (snap.exists()) {
            const meta = snap.data();
            return { dataType, oldCount: meta.totalBatches || 1 };
          }
        } catch { /* no existing data */ }
        return { dataType, oldCount: 0 };
      })
    );

    const oldCountMap = new Map(oldBatchCounts.map(({ dataType, oldCount }) => [dataType, oldCount]));

    // Step 2: Build all write and delete operations
    const allOps: Promise<void>[] = [];
    let totalBatches = 0;
    let completedBatches = 0;

    for (const dataType of dataTypes) {
      const rows = data[dataType] || [];
      totalBatches += Math.max(1, Math.ceil(rows.length / BATCH_SIZE));
    }

    onProgress?.(5, 'Syncing CRM data...');

    for (const dataType of dataTypes) {
      const rows = data[dataType] || [];
      const newBatchCount = Math.max(1, Math.ceil(rows.length / BATCH_SIZE));
      const oldCount = oldCountMap.get(dataType) || 0;

      for (let i = 0; i < newBatchCount; i++) {
        const batchRows = rows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        const docId = `${dataType}_batch_${i}`;
        allOps.push(
          setDoc(doc(db, CRM_COLLECTION, docId), {
            data: batchRows,
            dataType,
            batchIndex: i,
            totalRows: rows.length,
            totalBatches: newBatchCount,
            uploadedAt,
          }).then(() => {
            completedBatches++;
            onProgress?.(
              5 + Math.round((completedBatches / totalBatches) * 90),
              'Syncing CRM data...'
            );
          })
        );
      }

      // Delete excess old batches
      for (let i = newBatchCount; i < oldCount; i++) {
        allOps.push(
          deleteDoc(doc(db, CRM_COLLECTION, `${dataType}_batch_${i}`)).catch(() => {})
        );
      }

      // Delete legacy single-doc format
      allOps.push(
        deleteDoc(doc(db, CRM_COLLECTION, dataType)).catch(() => {})
      );
    }

    // Step 3: Execute all writes in parallel + save dateRange to config
    await Promise.all([
      ...allOps,
      saveConfigToFirestore({ crmDateRange: dateRange }),
    ]);

    onProgress?.(100, 'Sync complete');
    console.log('[FirestoreSync] CRM data saved to Firestore');
    return true;
  } catch (error) {
    console.error('[FirestoreSync] CRM save failed:', error);
    return false;
  }
}

/**
 * Load CRM parsed data from Firestore.
 * Returns { data, dateRange } or null if no CRM data exists.
 */
export async function loadCrmDataFromFirestore(): Promise<{ data: CrmParsedData; dateRange: string } | null> {
  console.log('[FirestoreSync] loadCrmDataFromFirestore called');

  let db: any;
  try {
    db = await getDb();
  } catch (e) {
    console.warn('[FirestoreSync] Firebase init failed:', e);
    return null;
  }

  console.log('[FirestoreSync] CRM load — db obtained:', !!db);
  if (!db) return null;

  try {
    const { doc, getDoc } = await import('firebase/firestore');

    const dataTypes: (keyof CrmParsedData)[] = ['enquiries', 'passthroughs', 'quotes', 'bookings'];

    const loadDataset = async (dataType: string): Promise<CrmRow[]> => {
      let batchedData: CrmRow[] = [];
      try {
        const firstBatch = await getDoc(doc(db, CRM_COLLECTION, `${dataType}_batch_0`));
        if (firstBatch.exists()) {
          const firstData = firstBatch.data();
          batchedData = batchedData.concat(firstData?.data || []);
          const expectedBatches = firstData?.totalBatches || 100;
          for (let batchNum = 1; batchNum < expectedBatches; batchNum++) {
            try {
              const batchSnap = await getDoc(doc(db, CRM_COLLECTION, `${dataType}_batch_${batchNum}`));
              if (batchSnap.exists()) {
                batchedData = batchedData.concat(batchSnap.data()?.data || []);
              } else { break; }
            } catch { break; }
          }
          return batchedData;
        }
      } catch { /* batch format not available */ }

      // Fallback: single-doc format
      try {
        const snap = await getDoc(doc(db, CRM_COLLECTION, dataType));
        if (snap.exists()) { return snap.data()?.data || []; }
      } catch { /* ignore */ }

      return [];
    };

    const results = await Promise.all(dataTypes.map(dt => loadDataset(dt)));
    const crmData: CrmParsedData = {
      enquiries: results[0],
      passthroughs: results[1],
      quotes: results[2],
      bookings: results[3],
    };

    // Check if we actually have any data
    const hasData = Object.values(crmData).some(arr => arr.length > 0);
    console.log('[FirestoreSync] CRM load results:', {
      enquiries: crmData.enquiries.length,
      passthroughs: crmData.passthroughs.length,
      quotes: crmData.quotes.length,
      bookings: crmData.bookings.length,
      hasData,
    });
    if (!hasData) return null;

    // Load dateRange from config
    const config = await loadConfigFromFirestore();
    const dateRange = config?.crmDateRange || '';

    console.log('[FirestoreSync] CRM data loaded from Firestore');
    return { data: crmData, dateRange };
  } catch (error) {
    console.error('[FirestoreSync] CRM load failed:', error);
    return null;
  }
}
