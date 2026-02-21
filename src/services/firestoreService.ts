/**
 * Firestore Service Layer
 * Provides CRUD operations for all Global Travel Hub data
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  DocumentData,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '../firebase.config';
import type { Team, Metrics, TimeSeriesData } from '../types';

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  UPLOADS: 'uploads',
  CONFIGURATIONS: 'configurations',
} as const;

// ============== UPLOADS ==============
export interface UploadRecord extends DocumentData {
  userId: string;
  uploadedAt: Timestamp;
  dateRange: { start: string; end: string };
  fileName: string;
  status: 'success' | 'failed';
  metrics: Metrics[];
  timeseries: TimeSeriesData;
  errorMessage?: string;
}

export const saveUpload = async (userId: string, data: Omit<UploadRecord, 'userId' | 'uploadedAt'>): Promise<string> => {
  try {
    const uploadRef = doc(collection(db, COLLECTIONS.UPLOADS));
    const uploadData: UploadRecord = {
      ...data,
      userId,
      uploadedAt: Timestamp.now(),
    };

    await setDoc(uploadRef, uploadData);
    console.log('✅ Upload saved:', uploadRef.id);
    return uploadRef.id;
  } catch (error) {
    console.error('❌ Failed to save upload:', error);
    throw error;
  }
};

export const getUploads = async (userId: string, limitCount = 50): Promise<UploadRecord[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.UPLOADS),
      where('userId', '==', userId),
      orderBy('uploadedAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    } as UploadRecord & { id: string }));
  } catch (error) {
    console.error('❌ Failed to get uploads:', error);
    throw error;
  }
};

export const getLatestUpload = async (userId: string): Promise<(UploadRecord & { id: string }) | null> => {
  try {
    const uploads = await getUploads(userId, 1);
    return uploads.length > 0 ? { ...uploads[0], id: uploads[0].id || '' } : null;
  } catch (error) {
    console.error('❌ Failed to get latest upload:', error);
    throw error;
  }
};

// ============== TEAMS ==============
export const saveTeams = async (userId: string, teams: Team[]): Promise<void> => {
  try {
    const configRef = doc(db, COLLECTIONS.CONFIGURATIONS, userId);
    await updateDoc(configRef, { teams });
    console.log('✅ Teams saved');
  } catch (error) {
    console.error('❌ Failed to save teams:', error);
    throw error;
  }
};

export const getTeams = async (userId: string): Promise<Team[]> => {
  try {
    const configRef = doc(db, COLLECTIONS.CONFIGURATIONS, userId);
    const configSnap = await getDoc(configRef);

    if (configSnap.exists()) {
      return configSnap.data().teams || [];
    }
    return [];
  } catch (error) {
    console.error('❌ Failed to get teams:', error);
    throw error;
  }
};

// ============== SENIORS ==============
export const saveSeniors = async (userId: string, seniors: string[]): Promise<void> => {
  try {
    const configRef = doc(db, COLLECTIONS.CONFIGURATIONS, userId);
    await updateDoc(configRef, { seniors });
    console.log('✅ Seniors saved');
  } catch (error) {
    console.error('❌ Failed to save seniors:', error);
    throw error;
  }
};

export const getSeniors = async (userId: string): Promise<string[]> => {
  try {
    const configRef = doc(db, COLLECTIONS.CONFIGURATIONS, userId);
    const configSnap = await getDoc(configRef);

    if (configSnap.exists()) {
      return configSnap.data().seniors || [];
    }
    return [];
  } catch (error) {
    console.error('❌ Failed to get seniors:', error);
    throw error;
  }
};

// ============== NEW HIRES ==============
export const saveNewHires = async (userId: string, newHires: string[]): Promise<void> => {
  try {
    const configRef = doc(db, COLLECTIONS.CONFIGURATIONS, userId);
    await updateDoc(configRef, { newHires });
    console.log('✅ New hires saved');
  } catch (error) {
    console.error('❌ Failed to save new hires:', error);
    throw error;
  }
};

export const getNewHires = async (userId: string): Promise<string[]> => {
  try {
    const configRef = doc(db, COLLECTIONS.CONFIGURATIONS, userId);
    const configSnap = await getDoc(configRef);

    if (configSnap.exists()) {
      return configSnap.data().newHires || [];
    }
    return [];
  } catch (error) {
    console.error('❌ Failed to get new hires:', error);
    throw error;
  }
};

// ============== USER PROFILE ==============
export const createUserProfile = async (userId: string): Promise<void> => {
  try {
    const configRef = doc(db, COLLECTIONS.CONFIGURATIONS, userId);
    const configSnap = await getDoc(configRef);

    if (!configSnap.exists()) {
      await setDoc(configRef, {
        teams: [],
        seniors: [],
        newHires: [],
        createdAt: Timestamp.now(),
      });
      console.log('✅ User profile created');
    }
  } catch (error) {
    console.error('❌ Failed to create user profile:', error);
    throw error;
  }
};
