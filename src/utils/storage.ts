import type { Team } from '../types';

const TEAMS_STORAGE_KEY = 'kpi-report-teams';

export const loadTeams = (): Team[] => {
  try {
    const stored = localStorage.getItem(TEAMS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load teams from storage:', error);
  }
  return [];
};

export const saveTeams = (teams: Team[]): void => {
  try {
    localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(teams));
  } catch (error) {
    console.error('Failed to save teams to storage:', error);
  }
};
