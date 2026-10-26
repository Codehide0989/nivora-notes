import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSession } from '@/store/session';

const K_HASH = 'nivora.pin.hash';
const K_SALT = 'nivora.pin.salt';
const K_LEN = 'nivora.pin.len';
const K_FAILS = 'nivora.pin.fails';
const K_UNTIL = 'nivora.pin.until';
const ROUNDS = 400;

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

async function derive(pin: string, salt: string): Promise<string> {
  let h = `${salt}:${pin}`;
  for (let i = 0; i < ROUNDS; i += 1) {
    h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${h}:${salt}`);
  }
  return h;
}

export async function hasPin(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(K_HASH)) !== null;
  } catch {
    return false;
  }
}

export async function pinLength(): Promise<number> {
  const v = await SecureStore.getItemAsync(K_LEN);
  return v === '6' ? 6 : 4;
}

export async function setPin(pin: string): Promise<void> {
  const salt = toHex(await Crypto.getRandomBytesAsync(16));
  const hash = await derive(pin, salt);
  await SecureStore.setItemAsync(K_SALT, salt);
  await SecureStore.setItemAsync(K_HASH, hash);
  await SecureStore.setItemAsync(K_LEN, String(pin.length));
  await SecureStore.setItemAsync(K_FAILS, '0');
  await SecureStore.deleteItemAsync(K_UNTIL);
  useSession.getState().setPinSet(true);
}

export async function removePin(): Promise<void> {
  await SecureStore.deleteItemAsync(K_HASH);
  await SecureStore.deleteItemAsync(K_SALT);
  await SecureStore.deleteItemAsync(K_LEN);
  await SecureStore.deleteItemAsync(K_FAILS);
  await SecureStore.deleteItemAsync(K_UNTIL);
  useSession.getState().setPinSet(false);
  useSession.getState().unlock();
}

export interface Lockout {
  until: number; // epoch ms, 0 when not locked out
  fails: number;
}

export async function getLockout(): Promise<Lockout> {
  const fails = parseInt((await SecureStore.getItemAsync(K_FAILS)) ?? '0', 10) || 0;
  const until = parseInt((await SecureStore.getItemAsync(K_UNTIL)) ?? '0', 10) || 0;
  return { fails, until: until > Date.now() ? until : 0 };
}

function penaltyFor(fails: number): number {
  if (fails >= 9) return 10 * 60_000;
  if (fails >= 7) return 2 * 60_000;
  if (fails >= 5) return 30_000;
  return 0;
}

export const ATTEMPTS_BEFORE_LOCKOUT = 5;

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'wrong'; attemptsLeft: number }
  | { ok: false; reason: 'locked'; until: number };

export async function verifyPin(pin: string): Promise<VerifyResult> {
  const lock = await getLockout();
  if (lock.until > 0) return { ok: false, reason: 'locked', until: lock.until };
  const salt = await SecureStore.getItemAsync(K_SALT);
  const stored = await SecureStore.getItemAsync(K_HASH);
  if (!salt || !stored) return { ok: true };
  const h = await derive(pin, salt);
  if (h === stored) {
    await SecureStore.setItemAsync(K_FAILS, '0');
    await SecureStore.deleteItemAsync(K_UNTIL);
    return { ok: true };
  }
  const fails = lock.fails + 1;
  await SecureStore.setItemAsync(K_FAILS, String(fails));
  const penalty = penaltyFor(fails);
  if (penalty > 0) {
    const until = Date.now() + penalty;
    await SecureStore.setItemAsync(K_UNTIL, String(until));
    return { ok: false, reason: 'locked', until };
  }
  return { ok: false, reason: 'wrong', attemptsLeft: Math.max(0, ATTEMPTS_BEFORE_LOCKOUT - fails) };
}

export interface BiometricInfo {
  available: boolean;
  enrolled: boolean;
  kind: 'fingerprint' | 'face' | 'iris' | 'none';
}

export async function biometricInfo(): Promise<BiometricInfo> {
  try {
    const hardware = await LocalAuthentication.hasHardwareAsync();
    if (!hardware) return { available: false, enrolled: false, kind: 'none' };
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const T = LocalAuthentication.AuthenticationType;
    let kind: BiometricInfo['kind'] = 'fingerprint';
    if (types.includes(T.FACIAL_RECOGNITION)) kind = 'face';
    else if (types.includes(T.IRIS)) kind = 'iris';
    else if (types.includes(T.FINGERPRINT)) kind = 'fingerprint';
    return { available: true, enrolled, kind };
  } catch {
    return { available: false, enrolled: false, kind: 'none' };
  }
}

export async function authenticateBiometric(reason: string): Promise<boolean> {
  const { beginExternal, endExternal } = useSession.getState();
  beginExternal();
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Use PIN',
      disableDeviceFallback: true,
    });
    return res.success;
  } catch {
    return false;
  } finally {
    setTimeout(endExternal, 600);
  }
}
