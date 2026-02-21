/**
 * Firebase Authentication Service
 * Handles user signup, login, logout, and session management
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../firebase.config';
import { createUserProfile } from './firestoreService';

export type AuthUser = User | null;

export const signUp = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Create user profile in Firestore
    await createUserProfile(userCredential.user.uid, {
      email,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    console.log('✅ User created:', userCredential.user.uid);
    return userCredential.user;
  } catch (error) {
    console.error('❌ Signup failed:', error);
    throw error;
  }
};

export const login = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ User logged in:', userCredential.user.uid);
    return userCredential.user;
  } catch (error) {
    console.error('❌ Login failed:', error);
    throw error;
  }
};

export const logout = async (): Promise<void> => {
  try {
    await signOut(auth);
    console.log('✅ User logged out');
  } catch (error) {
    console.error('❌ Logout failed:', error);
    throw error;
  }
};

export const getCurrentUser = (): AuthUser => {
  return auth.currentUser;
};

export const onAuthChange = (callback: (user: AuthUser) => void): (() => void) => {
  return onAuthStateChanged(auth, callback);
};
