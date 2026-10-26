import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AccentKey, ThemeMode } from '@/theme';

export type LockTimeout = 0 | 30 | 60 | 300;
export type SortBy = 'updated' | 'created' | 'title';
export type NoteView = 'list' | 'grid';

export interface SettingsState {
  hydrated: boolean;
  onboarded: boolean;
  profileName: string;
  profileEmail: string;
  signedIn: boolean;

  theme: ThemeMode;
  accent: AccentKey;
  fontScale: number;
  noteView: NoteView;
  sortBy: SortBy;
  haptics: boolean;
  language: string;

  notificationsEnabled: boolean;
  notifySound: boolean;
  notifyVibrate: boolean;
  dailySummary: boolean;
  dailySummaryHour: number;
  dailySummaryMinute: number;
  dailySummaryId: string | null;

  biometricsEnabled: boolean;
  lockTimeout: LockTimeout;
  hideContentInSwitcher: boolean;

  autoBackup: boolean;
  backupIncludeMedia: boolean;
  lastBackupAt: number | null;

  offlineMode: boolean;
  autoSync: boolean;
  trashRetentionDays: number;

  set: (patch: Partial<Omit<SettingsState, 'set' | 'reset'>>) => void;
  reset: () => void;
}

const defaults = {
  hydrated: false,
  onboarded: false,
  profileName: '',
  profileEmail: '',
  signedIn: false,
  theme: 'system' as ThemeMode,
  accent: 'yellow' as AccentKey,
  fontScale: 1,
  noteView: 'list' as NoteView,
  sortBy: 'updated' as SortBy,
  haptics: true,
  language: 'en',
  notificationsEnabled: true,
  notifySound: true,
  notifyVibrate: true,
  dailySummary: false,
  dailySummaryHour: 8,
  dailySummaryMinute: 0,
  dailySummaryId: null as string | null,
  biometricsEnabled: false,
  lockTimeout: 0 as LockTimeout,
  hideContentInSwitcher: true,
  autoBackup: false,
  backupIncludeMedia: true,
  lastBackupAt: null as number | null,
  offlineMode: false,
  autoSync: true,
  trashRetentionDays: 30,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      set: (patch) => set(patch as Partial<SettingsState>),
      reset: () => set({ ...defaults, hydrated: true }),
    }),
    {
      name: 'nivora.settings.v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => {
        const { hydrated, set: _set, reset: _reset, ...rest } = s;
        return rest;
      },
      onRehydrateStorage: () => () => {
        useSettings.setState({ hydrated: true });
      },
    },
  ),
);

/** Settings that are safe to include in a backup (nothing security-related). */
export function exportableSettings(): Record<string, unknown> {
  const s = useSettings.getState();
  return {
    theme: s.theme,
    accent: s.accent,
    fontScale: s.fontScale,
    noteView: s.noteView,
    sortBy: s.sortBy,
    haptics: s.haptics,
    language: s.language,
    trashRetentionDays: s.trashRetentionDays,
    profileName: s.profileName,
  };
}
