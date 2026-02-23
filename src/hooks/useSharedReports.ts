/**
 * useSharedReports — DISABLED
 * Not currently used in the active app. Stub to satisfy TypeScript.
 * To re-enable: restore from git history and update to use getDb() from firebase.config.
 */

import { useState } from 'react';

export interface SharedReport {
  id?: string;
  name: string;
  type: string;
  description?: string;
  data: any[];
  tags?: string[];
  createdAt: any;
  updatedAt: any;
  metadata?: any;
}

export interface UseSharedReportsState {
  reports: SharedReport[];
  loading: boolean;
  error: string | null;
}

export function useSharedReports(): UseSharedReportsState & { refetch: () => Promise<void> } {
  const [state] = useState<UseSharedReportsState>({
    reports: [],
    loading: false,
    error: 'Shared reports disabled',
  });

  return {
    ...state,
    refetch: async () => { throw new Error('Shared reports disabled'); },
  };
}
