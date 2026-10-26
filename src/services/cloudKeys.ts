import * as SecureStore from 'expo-secure-store';
import { fromB64u, toB64u } from '@/services/crypto';

/**
 * Secrets for the cloud account. They are kept in the platform keystore (Android Keystore / iOS Keychain),
 * only readable on this device after first unlock, and never written to AsyncStorage or backups.
 */
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
const K_ACCESS = 'nivora.cloud.access';
const K_REFRESH = 'nivora.cloud.refresh';
const K_ENC = 'nivora.cloud.enckey';

let encCache: Uint8Array | null = null;

export async function saveTokens(access: string, refresh: string): Promise<void> {
  await SecureStore.setItemAsync(K_ACCESS, access, OPTS);
  await SecureStore.setItemAsync(K_REFRESH, refresh, OPTS);
}
export const loadAccess = () => SecureStore.getItemAsync(K_ACCESS, OPTS);
export const loadRefresh = () => SecureStore.getItemAsync(K_REFRESH, OPTS);

export async function saveEncKey(key: Uint8Array): Promise<void> {
  encCache = key;
  await SecureStore.setItemAsync(K_ENC, toB64u(key), OPTS);
}

export async function loadEncKey(): Promise<Uint8Array | null> {
  if (encCache) return encCache;
  const v = await SecureStore.getItemAsync(K_ENC, OPTS);
  encCache = v ? fromB64u(v) : null;
  return encCache;
}

export async function clearCloudKeys(): Promise<void> {
  encCache?.fill(0);
  encCache = null;
  for (const k of [K_ACCESS, K_REFRESH, K_ENC]) {
    try {
      await SecureStore.deleteItemAsync(k, OPTS);
    } catch {
      /* already gone */
    }
  }
}
