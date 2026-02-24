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

import type { RawParsedData } from './indexedDB';
import type { Team } from '../types';
import { getDb } from '../firebase.config';

const COLLECTION = 'gtt_raw_data';
const BATCH_SIZE = 1000; // rows per Firestore document (reduced from 2000 for wider rows)

/**
 * Save all parsed report data to Firestore in batched format.
 * Overwrites any existing data for each data type.
 */
export async function saveRawDataToFirestore(data: RawParsedData): Promise<boolean> {
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

    for (const dataType of dataTypes) {
      const rows = data[dataType] || [];
      // Saving dataType rows to Firestore

      // Write batches
      const batchCount = Math.max(1, Math.ceil(rows.length / BATCH_SIZE));
      for (let i = 0; i < batchCount; i++) {
        const batchRows = rows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        const docId = `${dataType}_batch_${i}`;
        await setDoc(doc(db, COLLECTION, docId), {
          data: batchRows,
          dataType,
          batchIndex: i,
          totalRows: rows.length,
          totalBatches: batchCount,
          uploadedAt,
        });
      }

      // Clean up any old batches beyond the current count
      // (e.g., if data shrank from 5 batches to 3, delete batches 3 and 4)
      for (let i = batchCount; i < 100; i++) {
        const docId = `${dataType}_batch_${i}`;
        try {
          const snap = await getDoc(doc(db, COLLECTION, docId));
          if (snap.exists()) {
            await deleteDoc(doc(db, COLLECTION, docId));
          } else {
            break; // No more old batches
          }
        } catch {
          break;
        }
      }

      // Also write/overwrite the legacy single-doc format for backwards compat
      // (only if the dataset is small enough to fit in one doc)
      if (rows.length <= BATCH_SIZE) {
        try {
          await setDoc(doc(db, COLLECTION, dataType), {
            data: rows,
            uploadedAt,
            totalRows: rows.length,
          });
        } catch {
          // Single-doc may exceed limits for large datasets — that's fine
        }
      }
    }

    // All data saved to Firestore
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
      // Loaded config from Firestore
      return {
        teams: data.teams || [],
        seniors: data.seniors || [],
        newHires: data.newHires || [],
        updatedAt: data.updatedAt || null,
      };
    }
    // No config doc found in Firestore
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
    // Config saved to Firestore
    return true;
  } catch (error) {
    console.error('[FirestoreSync] Failed to save config:', error);
    return false;
  }
}
