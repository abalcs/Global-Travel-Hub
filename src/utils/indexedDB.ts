import type { CSVRow } from './csvParser';

export interface RawParsedData {
  trips: CSVRow[];
  quotes: CSVRow[];
  passthroughs: CSVRow[];
  hotPass: CSVRow[];
  bookings: CSVRow[];
  nonConverted: CSVRow[];
  quotesStarted?: CSVRow[];
}

const DB_NAME = 'kpi-report-db';
const DB_VERSION = 1;
const STORE_NAME = 'raw-data';

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });

  return dbPromise;
};

export const saveRawDataToDB = async (data: RawParsedData): Promise<boolean> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data, 'rawParsedData');

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        console.error('Failed to save to IndexedDB:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('IndexedDB save error:', error);
    return false;
  }
};

export const loadRawDataFromDB = async (): Promise<RawParsedData | null> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('rawParsedData');

      request.onsuccess = () => {
        const data = request.result as RawParsedData | undefined;
        resolve(data || null);
      };

      request.onerror = () => {
        console.error('Failed to load from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('IndexedDB load error:', error);
    return null;
  }
};

export const clearRawDataFromDB = async (): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete('rawParsedData');

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to clear IndexedDB:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('IndexedDB clear error:', error);
  }
};
