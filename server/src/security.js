import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export const b64u = (buf) => Buffer.from(buf).toString('base64url');
export const sha256hex = (s) => crypto.createHash('sha256').update(s).digest('hex');

/**
 * The client never sends the master password. It sends `authKey`, 32 bytes derived on the device
 * (PBKDF2 + HKDF). We still hash it with scrypt + a random salt, so a database leak does not even
 * reveal the authKey, and the encryption key never leaves the device at all.
 */
export async function hashSecret(secret) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(secret, salt, 32, SCRYPT);
  return { salt: b64u(salt), hash: b64u(hash) };
}

export async function verifySecret(secret, saltB64u, hashB64u) {
  const hash = await scrypt(secret, Buffer.from(saltB64u, 'base64url'), 32, SCRYPT);
  const expected = Buffer.from(hashB64u, 'base64url');
  return expected.length === hash.length && crypto.timingSafeEqual(hash, expected);
}

// Used so unknown e-mails cost the same time as wrong passwords.
export const DUMMY = { salt: b64u(crypto.randomBytes(16)), hash: b64u(crypto.randomBytes(32)) };

export function newRefreshToken() {
  return b64u(crypto.randomBytes(32));
}

function sign(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

export function signJwt(payload, secret, ttlSec) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ ...payload, iat: now, exp: now + ttlSec }));
  return `${head}.${body}.${sign(`${head}.${body}`, secret)}`;
}

export function verifyJwt(token, secret) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;
  const good = Buffer.from(sign(`${head}.${body}`, secret));
  const got = Buffer.from(sig);
  if (good.length !== got.length || !crypto.timingSafeEqual(good, got)) return null;
  try {
    const h = JSON.parse(Buffer.from(head, 'base64url').toString());
    if (h.alg !== 'HS256') return null;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (typeof p.exp !== 'number' || p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch {
    return null;
  }
}

/** Fixed-window in-memory limiter. For multiple instances put a shared limiter (or the platform's) in front. */
export function createLimiter() {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, 60_000);
  timer.unref();
  return {
    /** returns seconds to wait when blocked, otherwise 0 */
    take(key, max, windowMs) {
      const now = Date.now();
      let e = hits.get(key);
      if (!e || e.reset <= now) {
        e = { n: 0, reset: now + windowMs };
        hits.set(key, e);
      }
      e.n += 1;
      return e.n > max ? Math.ceil((e.reset - now) / 1000) : 0;
    },
    clear: () => hits.clear(),
  };
}
