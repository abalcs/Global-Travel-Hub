/**
 * Firebase Configuration — Lazy Initialization
 *
 * Firebase is initialized lazily via getDb()/getFirebaseStorage() to avoid
 * Temporal Dead Zone (TDZ) errors caused by module initialization order
 * in production bundles (Vite/Rollup).
 *
 * IMPORTANT: Do NOT use top-level Firebase imports or initialization.
 * All Firebase access must go through the getter functions.
 */

// Auth export is null — all auth features disabled
export const auth = null;

let _initPromise: Promise<void> | null = null;
let _db: any = null;
let _storage: any = null;
let _app: any = null;

async function ensureInitialized() {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      const { initializeApp } = await import('firebase/app');
      const { getFirestore } = await import('firebase/firestore');
      const { getStorage } = await import('firebase/storage');

      const firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
        appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
        measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
      };

      _app = initializeApp(firebaseConfig);
      _db = getFirestore(_app);
      _storage = getStorage(_app);
      console.log('[Firebase] Initialized successfully');
    } catch (error) {
      console.error('[Firebase] Initialization failed:', error);
    }
  })();

  return _initPromise;
}

/**
 * Get the Firestore database instance. Initializes Firebase if needed.
 */
export async function getDb() {
  await ensureInitialized();
  return _db;
}

/**
 * Get the Firebase Storage instance. Initializes Firebase if needed.
 */
export async function getFirebaseStorage() {
  await ensureInitialized();
  return _storage;
}

/**
 * Get the Firebase App instance. Initializes Firebase if needed.
 */
export async function getApp() {
  await ensureInitialized();
  return _app;
}
