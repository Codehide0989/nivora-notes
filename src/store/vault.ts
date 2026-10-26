import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { fromB64u, open, randomBytes, seal, toB64u } from '@/services/crypto';
import { useSession } from '@/store/session';
import { uid } from '@/utils/id';
import type { VaultItem } from '@/types';

/**
 * Credentials vault.
 *  - At rest: the whole list is one ChaCha20-Poly1305 blob in AsyncStorage. Its key is random, created on this
 *    device and held in SecureStore (Android Keystore / iOS Keychain). Passwords are never stored as plain text.
 *  - In memory: decrypted only while needed; cleared when the app locks.
 *  - In the cloud: each entry is encrypted again with the account key before upload (see services/cloud.ts).
 */
const STORE_KEY = 'nivora.vault.v1';
const KEY_NAME = 'nivora.vault.key';
const AAD = 'nivora:vault-local:v1';
const KEY_OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

interface VaultState {
  loaded: boolean;
  /** true when stored data exists but cannot be decrypted (e.g. the keystore was reset). */
  unreadable: boolean;
  items: VaultItem[];
}

export const useVault = create<VaultState>(() => ({ loaded: false, unreadable: false, items: [] }));

let keyCache: Uint8Array | null = null;
async function localKey(create: boolean): Promise<Uint8Array | null> {
  if (keyCache) return keyCache;
  const v = await SecureStore.getItemAsync(KEY_NAME, KEY_OPTS);
  if (v) {
    keyCache = fromB64u(v);
    return keyCache;
  }
  if (!create) return null;
  const fresh = randomBytes(32);
  await SecureStore.setItemAsync(KEY_NAME, toB64u(fresh), KEY_OPTS);
  keyCache = fresh;
  return fresh;
}

let loading: Promise<void> | null = null;
export function ensureVaultLoaded(): Promise<void> {
  if (useVault.getState().loaded) return Promise.resolve();
  if (loading) return loading;
  loading = (async () => {
    try {
      const blob = await AsyncStorage.getItem(STORE_KEY);
      if (!blob) {
        useVault.setState({ loaded: true, unreadable: false, items: [] });
        return;
      }
      const key = await localKey(false);
      if (!key) {
        useVault.setState({ loaded: true, unreadable: true, items: [] });
        return;
      }
      try {
        const items = open<VaultItem[]>(key, AAD, blob);
        useVault.setState({ loaded: true, unreadable: false, items: Array.isArray(items) ? items : [] });
      } catch {
        useVault.setState({ loaded: true, unreadable: true, items: [] });
      }
    } finally {
      loading = null;
    }
  })();
  return loading;
}

// Writes are serialised so two quick edits can never overwrite each other with stale data.
let chain: Promise<void> = Promise.resolve();
function persist(): Promise<void> {
  chain = chain
    .then(async () => {
      const key = await localKey(true);
      if (!key) return;
      const { items } = useVault.getState();
      await AsyncStorage.setItem(STORE_KEY, seal(key, AAD, items));
    })
    .catch(() => undefined);
  return chain;
}

export type VaultDraft = Partial<Omit<VaultItem, 'id' | 'createdAt' | 'updatedAt' | 'passwordChangedAt'>>;

export async function addVaultItem(draft: VaultDraft): Promise<VaultItem> {
  await ensureVaultLoaded();
  const t = Date.now();
  const item: VaultItem = {
    id: uid(),
    title: '',
    url: '',
    username: '',
    password: '',
    notes: '',
    category: 'other',
    favourite: false,
    ...draft,
    createdAt: t,
    updatedAt: t,
    passwordChangedAt: t,
  };
  useVault.setState((s) => ({ items: [item, ...s.items] }));
  await persist();
  return item;
}

export async function updateVaultItem(id: string, patch: VaultDraft): Promise<void> {
  await ensureVaultLoaded();
  const t = Date.now();
  useVault.setState((s) => ({
    items: s.items.map((i) =>
      i.id === id ? { ...i, ...patch, updatedAt: t, passwordChangedAt: patch.password !== undefined && patch.password !== i.password ? t : i.passwordChangedAt } : i,
    ),
  }));
  await persist();
}

export async function removeVaultItem(id: string): Promise<void> {
  await ensureVaultLoaded();
  useVault.setState((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  await persist();
}

/** Merge entries that arrived from the cloud. */
export async function applyRemoteVault(upserts: VaultItem[], removedIds: string[]): Promise<void> {
  await ensureVaultLoaded();
  const gone = new Set(removedIds);
  const incoming = new Map(upserts.map((i) => [i.id, i]));
  useVault.setState((s) => {
    const kept = s.items.filter((i) => !gone.has(i.id)).map((i) => incoming.get(i.id) ?? i);
    const known = new Set(s.items.map((i) => i.id));
    return { items: [...upserts.filter((i) => !known.has(i.id)), ...kept] };
  });
  await persist();
}

// While a sync is running the decrypted list must stay in memory; otherwise it is dropped when the app locks.
let holds = 0;
export const holdVault = () => {
  holds += 1;
};
export function releaseVault(): void {
  holds = Math.max(0, holds - 1);
  if (holds === 0 && useSession.getState().locked) clearVaultMemory();
}

export function clearVaultMemory(): void {
  if (holds > 0) return;
  useVault.setState({ loaded: false, items: [], unreadable: false });
}

useSession.subscribe((s, prev) => {
  if (s.locked && !prev.locked) clearVaultMemory();
});

/** Remove every trace of the vault from this device. */
export async function wipeVault(): Promise<void> {
  holds = 0;
  keyCache?.fill(0);
  keyCache = null;
  useVault.setState({ loaded: false, items: [], unreadable: false });
  await AsyncStorage.removeItem(STORE_KEY).catch(() => undefined);
  await SecureStore.deleteItemAsync(KEY_NAME, KEY_OPTS).catch(() => undefined);
}
