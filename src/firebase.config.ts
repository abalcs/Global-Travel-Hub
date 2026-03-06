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

      // Firebase client config — these are public keys embedded in every client
      // bundle and restricted by Firebase security rules, not secrets.
      const firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyD5xmAlxGyaDddN-Jt-obkc-a-dFt-Myg8',
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'global-travel-hub-9feaf.firebaseapp.com',
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'global-travel-hub-9feaf',
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'global-travel-hub-9feaf.firebasestorage.app',
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '947623280909',
        appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:947623280909:web:81d7c52947fa8996f83044',
        measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
      };

      _app = initializeApp(firebaseConfig);
      _db = getFirestore(_app);
      _storage = getStorage(_app);
      // Firebase initialized
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
