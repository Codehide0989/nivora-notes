import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { hkdf } from '@noble/hashes/hkdf';
import { chacha20poly1305 } from '@noble/ciphers/chacha';
import * as ExpoCrypto from 'expo-crypto';
import { KDF_ITERATIONS } from '@/config';

/**
 * All cryptography lives here.
 *  - Keys: master password --PBKDF2-SHA256--> master key --HKDF--> { encKey (never leaves the device), authKey (sent to the server) }
 *  - Data: ChaCha20-Poly1305 (RFC 8439), random 96-bit nonce per message, record id + kind bound as associated data.
 *  - Envelope: "v1." + base64url(nonce | ciphertext | tag)
 */

// ---------- encoding helpers (no Buffer / TextDecoder needed on Hermes) ----------
export function utf8(text: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    let c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      const d = text.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i += 1;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

export function fromUtf8(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let cp: number;
    if (b < 0x80) {
      cp = b;
      i += 1;
    } else if (b >= 0xc0 && b < 0xe0) {
      cp = ((b & 31) << 6) | (bytes[i + 1] & 63);
      i += 2;
    } else if (b >= 0xe0 && b < 0xf0) {
      cp = ((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63);
      i += 3;
    } else {
      cp = ((b & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63);
      i += 4;
    }
    if (cp >= 0x10000) {
      cp -= 0x10000;
      s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023));
    } else s += String.fromCharCode(cp);
  }
  return s;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const LOOKUP: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i += 1) LOOKUP[ALPHABET[i]] = i;

export function toB64u(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += ALPHABET[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += ALPHABET[n & 63];
  }
  return out;
}

export function fromB64u(text: string): Uint8Array {
  const clean = text.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = LOOKUP[clean[i]];
    const b = LOOKUP[clean[i + 1]];
    const c = i + 2 < clean.length ? LOOKUP[clean[i + 2]] : 0;
    const d = i + 3 < clean.length ? LOOKUP[clean[i + 3]] : 0;
    if (a === undefined || b === undefined || c === undefined || d === undefined) throw new Error('Invalid base64url');
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    out[o++] = (n >> 16) & 255;
    if (i + 2 < clean.length) out[o++] = (n >> 8) & 255;
    if (i + 3 < clean.length) out[o++] = n & 255;
  }
  return out.subarray(0, o);
}

export function toHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
  return s;
}

export const randomBytes = (n: number): Uint8Array => ExpoCrypto.getRandomBytes(n);

/** Uniform random integer in [0, max) without modulo bias. */
export function randomInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  for (;;) {
    const b = randomBytes(4);
    const v = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
    if (v < limit) return v % max;
  }
}

export const sha256Hex = (text: string): string => toHex(sha256(utf8(text)));

// ---------- key derivation ----------
export interface AccountKeys {
  /** 32-byte data-encryption key. Stays on the device (SecureStore). */
  encKey: Uint8Array;
  /** base64url of 32 bytes. This is the only secret derived from the password that the server ever sees. */
  authKey: string;
}

export async function deriveAccountKeys(email: string, password: string): Promise<AccountKeys> {
  const salt = utf8(`nivora.v1|${email.trim().toLowerCase()}`);
  const master = await pbkdf2Async(sha256, utf8(password.normalize('NFKC')), salt, { c: KDF_ITERATIONS, dkLen: 32, asyncTick: 8 });
  const encKey = hkdf(sha256, master, undefined, utf8('nivora/enc/v1'), 32);
  const auth = hkdf(sha256, master, undefined, utf8('nivora/auth/v1'), 32);
  master.fill(0);
  return { encKey, authKey: toB64u(auth) };
}

// ---------- authenticated encryption ----------
export function seal(key: Uint8Array, aad: string, value: unknown): string {
  const nonce = randomBytes(12);
  const ct = chacha20poly1305(key, nonce, utf8(aad)).encrypt(utf8(JSON.stringify(value)));
  const all = new Uint8Array(nonce.length + ct.length);
  all.set(nonce, 0);
  all.set(ct, nonce.length);
  return `v1.${toB64u(all)}`;
}

export function open<T = unknown>(key: Uint8Array, aad: string, envelope: string): T {
  if (!envelope.startsWith('v1.')) throw new Error('Unsupported data format');
  const all = fromB64u(envelope.slice(3));
  if (all.length < 12 + 16) throw new Error('Corrupt data');
  const pt = chacha20poly1305(key, all.subarray(0, 12), utf8(aad)).decrypt(all.subarray(12));
  return JSON.parse(fromUtf8(pt)) as T;
}

export const recordAad = (kind: string, id: string) => `nivora:${kind}:${id}`;

// ---------- passwords ----------
export interface GenOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
}

const SETS = {
  lower: 'abcdefghijkmnopqrstuvwxyz',
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  digits: '23456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?',
};

export function generatePassword(o: GenOptions): string {
  const pools = (Object.keys(SETS) as (keyof typeof SETS)[]).filter((k) => o[k]).map((k) => SETS[k]);
  if (pools.length === 0) pools.push(SETS.lower);
  const length = Math.min(64, Math.max(Math.max(6, pools.length), o.length));
  const all = pools.join('');
  const chars: string[] = pools.map((p) => p[randomInt(p.length)]); // at least one from each chosen set
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** 0 (very weak) .. 4 (strong). Rough estimate based on length and variety. */
export function passwordScore(pw: string): number {
  if (!pw) return 0;
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^A-Za-z0-9]/.test(pw)) pool += 32;
  let bits = pw.length * Math.log2(Math.max(pool, 2));
  if (/^(.)\1+$/.test(pw) || /^(password|12345678|qwertyui|iloveyou)/i.test(pw)) bits = Math.min(bits, 20);
  const uniq = new Set(pw).size;
  if (uniq < pw.length / 2) bits *= 0.7;
  if (bits < 28) return 0;
  if (bits < 40) return 1;
  if (bits < 56) return 2;
  if (bits < 76) return 3;
  return 4;
}
