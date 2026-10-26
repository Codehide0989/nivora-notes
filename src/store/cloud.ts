import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Non-secret cloud state. Tokens and the encryption key live in SecureStore (services/cloudKeys.ts),
 * never here.
 */
export interface CloudState {
  hydrated: boolean;
  serverUrl: string; // optional override of EXPO_PUBLIC_API_URL
  signedIn: boolean;
  email: string;
  userId: string;
  /** Server revision up to which this device has pulled. */
  cursor: number;
  /** hash of every record the last time it matched the server, keyed "kind:id". */
  hashes: Record<string, string>;
  lastSyncAt: number | null;
  set: (patch: Partial<Omit<CloudState, 'set' | 'resetAccount'>>) => void;
  resetAccount: () => void;
}

const account = { signedIn: false, email: '', userId: '', cursor: 0, hashes: {} as Record<string, string>, lastSyncAt: null as number | null };

export const useCloud = create<CloudState>()(
  persist(
    (set) => ({
      hydrated: false,
      serverUrl: '',
      ...account,
      set: (patch) => set(patch as Partial<CloudState>),
      resetAccount: () => set({ ...account }),
    }),
    {
      name: 'nivora.cloud.v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        serverUrl: s.serverUrl,
        signedIn: s.signedIn,
        email: s.email,
        userId: s.userId,
        cursor: s.cursor,
        hashes: s.hashes,
        lastSyncAt: s.lastSyncAt,
      }),
      onRehydrateStorage: () => () => {
        useCloud.setState({ hydrated: true });
      },
    },
  ),
);
