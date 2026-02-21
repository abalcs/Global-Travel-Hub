import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import type { FirebaseStorage } from 'firebase/storage';

/**
 * Firebase Configuration
 * Replace with your Firebase project credentials from console.firebase.google.com
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

console.log('🔧 Firebase Config:', {
  apiKey: firebaseConfig.apiKey ? '✅ Set' : '❌ Missing',
  projectId: firebaseConfig.projectId || '❌ Missing',
  authDomain: firebaseConfig.authDomain ? '✅ Set' : '❌ Missing',
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);
console.log('🚀 Firebase app initialized:', app.name);

// Initialize Auth
export const auth: Auth = getAuth(app);
console.log('🔐 Auth initialized');

// Initialize Firestore
export const db: Firestore = getFirestore(app);
console.log('📦 Firestore initialized');

// Initialize Storage (for uploaded Excel files)
export const storage: FirebaseStorage = getStorage(app);
console.log('💾 Storage initialized');

export default app;
