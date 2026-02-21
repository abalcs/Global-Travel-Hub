/**
 * Firestore Service
 * High-level functions for common Firestore operations
 */

import { db } from '../firebase.config';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';

export interface Report {
  id?: string;
  uid: string;
  name: string;
  type: string;
  description?: string;
  data: any[];
  createdAt: number | Timestamp;
  updatedAt: number | Timestamp;
  tags?: string[];
}

export interface Upload {
  id?: string;
  uid: string;
  fileName: string;
  fileSize: number;
  uploadedAt: number | Timestamp;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  error?: string;
}

/**
 * Save a report to Firestore
 */
export async function saveReport(uid: string, report: Omit<Report, 'uid'>): Promise<string> {
  try {
    const reportRef = doc(collection(db, `users/${uid}/reports`));
    const now = Timestamp.now();

    await setDoc(reportRef, {
      ...report,
      uid,
      createdAt: report.createdAt || now,
      updatedAt: now,
    });

    return reportRef.id;
  } catch (error) {
    throw new Error(`Failed to save report: ${error}`);
  }
}

/**
 * Get a report by ID
 */
export async function getReport(uid: string, reportId: string): Promise<Report | null> {
  try {
    const docRef = doc(db, `users/${uid}/reports/${reportId}`);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Report : null;
  } catch (error) {
    throw new Error(`Failed to get report: ${error}`);
  }
}

/**
 * Get all reports for a user
 */
export async function getReports(uid: string, options?: { limit?: number; tag?: string }): Promise<Report[]> {
  try {
    let q = query(
      collection(db, `users/${uid}/reports`),
      orderBy('updatedAt', 'desc')
    );

    if (options?.limit) {
      q = query(q, limit(options.limit));
    }

    if (options?.tag) {
      q = query(
        collection(db, `users/${uid}/reports`),
        where('tags', 'array-contains', options.tag),
        orderBy('updatedAt', 'desc')
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Report[];
  } catch (error) {
    throw new Error(`Failed to get reports: ${error}`);
  }
}

/**
 * Update a report
 */
export async function updateReport(uid: string, reportId: string, updates: Partial<Report>): Promise<void> {
  try {
    const docRef = doc(db, `users/${uid}/reports/${reportId}`);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    throw new Error(`Failed to update report: ${error}`);
  }
}

/**
 * Delete a report
 */
export async function deleteReport(uid: string, reportId: string): Promise<void> {
  try {
    const docRef = doc(db, `users/${uid}/reports/${reportId}`);
    await deleteDoc(docRef);
  } catch (error) {
    throw new Error(`Failed to delete report: ${error}`);
  }
}

/**
 * Save an upload record
 */
export async function saveUpload(uid: string, upload: Omit<Upload, 'uid'>): Promise<string> {
  try {
    const uploadRef = doc(collection(db, `users/${uid}/uploads`));
    await setDoc(uploadRef, {
      ...upload,
      uid,
    });
    return uploadRef.id;
  } catch (error) {
    throw new Error(`Failed to save upload: ${error}`);
  }
}

/**
 * Get all uploads for a user
 */
export async function getUploads(uid: string): Promise<Upload[]> {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, `users/${uid}/uploads`),
        orderBy('uploadedAt', 'desc')
      )
    );
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Upload[];
  } catch (error) {
    throw new Error(`Failed to get uploads: ${error}`);
  }
}

/**
 * Update an upload status
 */
export async function updateUploadStatus(
  uid: string,
  uploadId: string,
  status: Upload['status'],
  error?: string
): Promise<void> {
  try {
    const docRef = doc(db, `users/${uid}/uploads/${uploadId}`);
    const updates: any = { status };
    if (error) updates.error = error;
    await updateDoc(docRef, updates);
  } catch (error) {
    throw new Error(`Failed to update upload: ${error}`);
  }
}

/**
 * Delete an upload record
 */
export async function deleteUpload(uid: string, uploadId: string): Promise<void> {
  try {
    const docRef = doc(db, `users/${uid}/uploads/${uploadId}`);
    await deleteDoc(docRef);
  } catch (error) {
    throw new Error(`Failed to delete upload: ${error}`);
  }
}

/**
 * Batch delete reports
 */
export async function deleteReports(uid: string, reportIds: string[]): Promise<void> {
  try {
    const batch = [];
    for (const reportId of reportIds) {
      const docRef = doc(db, `users/${uid}/reports/${reportId}`);
      batch.push(deleteDoc(docRef));
    }
    await Promise.all(batch);
  } catch (error) {
    throw new Error(`Failed to delete reports: ${error}`);
  }
}

/**
 * Export reports to JSON
 */
export async function exportReportsAsJSON(uid: string): Promise<string> {
  try {
    const reports = await getReports(uid);
    return JSON.stringify(reports, null, 2);
  } catch (error) {
    throw new Error(`Failed to export reports: ${error}`);
  }
}
