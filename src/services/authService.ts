/**
 * Auth Service — DISABLED
 * Auth is currently disabled. All functions are safe no-ops.
 * To re-enable: restore the original implementation from git history.
 */
import type { User } from 'firebase/auth';

export type AuthUser = User | null;

export const signUp = async (_email: string, _password: string): Promise<User> => {
  throw new Error('Auth disabled');
};

export const login = async (_email: string, _password: string): Promise<User> => {
  throw new Error('Auth disabled');
};

export const logout = async (): Promise<void> => {};

export const getCurrentUser = (): AuthUser => null;

export const onAuthChange = (callback: (user: AuthUser) => void): (() => void) => {
  setTimeout(() => callback(null), 0);
  return () => {};
};
