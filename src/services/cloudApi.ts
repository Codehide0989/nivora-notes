import { API_URL } from '@/config';
import { useCloud } from '@/store/cloud';
import { fromB64u, fromUtf8 } from '@/services/crypto';
import { clearCloudKeys, loadAccess, loadRefresh, saveTokens } from '@/services/cloudKeys';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const PRIVATE_HOST = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[^/]+\.local)$/i;

/** HTTPS is mandatory except for development hosts on your own network. Returns an error message or null. */
export function validateServerUrl(raw: string): string | null {
  const v = raw.trim();
  const m = /^(https?):\/\/([^/:?#]+)(:\d+)?(\/.*)?$/i.exec(v);
  if (!m) return 'Enter a full address such as https://sync.example.com';
  if (m[1].toLowerCase() === 'http' && !PRIVATE_HOST.test(m[2])) return 'The server address must use https://';
  return null;
}

export function serverBase(): string {
  const url = (useCloud.getState().serverUrl || API_URL).trim().replace(/\/+$/, '');
  return url;
}
export const isServerConfigured = () => serverBase().length > 0 && validateServerUrl(serverBase()) === null;

/** Quick reachability check against GET /health (6 s timeout). Never throws. */
export async function checkServer(url: string): Promise<{ ok: boolean; message: string }> {
  const bad = validateServerUrl(url);
  if (bad) return { ok: false, message: bad };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url.replace(/\/+$/, '') + '/health', { signal: ctrl.signal });
    if (!res.ok) return { ok: false, message: `Server answered with an error (${res.status}).` };
    return { ok: true, message: 'Server reached.' };
  } catch {
    return { ok: false, message: 'Could not reach the server. Check the address, Wi-Fi and firewall.' };
  } finally {
    clearTimeout(timer);
  }
}

async function raw<T>(method: 'GET' | 'POST', path: string, body?: unknown, token?: string | null): Promise<T> {
  const base = serverBase();
  if (!base) throw new ApiError(0, 'not_configured', 'Cloud sync is not set up. Add your server address first.');
  const bad = validateServerUrl(base);
  if (bad) throw new ApiError(0, 'bad_url', bad);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(base + path, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON error page from a proxy */
    }
    if (!res.ok) {
      const e = (json as { error?: { code?: string; message?: string } } | null)?.error;
      throw new ApiError(res.status, e?.code ?? 'http_error', e?.message ?? `Server error (${res.status}).`);
    }
    return json as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    const aborted = e instanceof Error && e.name === 'AbortError';
    throw new ApiError(0, 'network', aborted ? 'The server took too long to respond.' : 'Could not reach the server. Check your connection.');
  } finally {
    clearTimeout(timer);
  }
}

export interface AuthResult {
  user: { id: string; email: string };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export const apiRegister = (email: string, authKey: string, device: string) => raw<AuthResult>('POST', '/v1/auth/register', { email, authKey, device });
export const apiLogin = (email: string, authKey: string, device: string) => raw<AuthResult>('POST', '/v1/auth/login', { email, authKey, device });

function tokenExpiry(jwt: string): number {
  try {
    const p = JSON.parse(fromUtf8(fromB64u(jwt.split('.')[1]))) as { exp?: number };
    return (p.exp ?? 0) * 1000;
  } catch {
    return 0;
  }
}

let refreshing: Promise<string> | null = null;

async function refreshAccess(): Promise<string> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const refresh = await loadRefresh();
    if (!refresh) throw new ApiError(401, 'unauthorized', 'Sign in again.');
    try {
      const r = await raw<AuthResult>('POST', '/v1/auth/refresh', { refreshToken: refresh });
      await saveTokens(r.accessToken, r.refreshToken);
      return r.accessToken;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // The session is gone for good: forget the keys so the app asks the user to sign in again.
        await clearCloudKeys();
        useCloud.getState().set({ signedIn: false });
      }
      throw e;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function accessToken(): Promise<string> {
  const t = await loadAccess();
  if (!t) return refreshAccess();
  if (tokenExpiry(t) - Date.now() < 60_000) return refreshAccess();
  return t;
}

/** Authenticated request with one automatic refresh-and-retry. */
export async function authed<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let token = await accessToken();
  try {
    return await raw<T>(method, path, body, token);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      token = await refreshAccess();
      return raw<T>(method, path, body, token);
    }
    throw e;
  }
}

export interface PulledRecord {
  kind: 'note' | 'task' | 'category' | 'reminder' | 'vault';
  id: string;
  payload: string;
  deleted: boolean;
  updatedAt: number;
  rev: number;
}
export const apiPull = (since: number) => authed<{ records: PulledRecord[]; cursor: number; more: boolean }>('GET', `/v1/sync/pull?since=${since}`);
export const apiPush = (records: { kind: string; id: string; payload: string; deleted: boolean; updatedAt: number }[]) =>
  authed<{ accepted: string[]; rejected: string[] }>('POST', '/v1/sync/push', { records });
export const apiLogout = () => authed<{ ok: boolean }>('POST', '/v1/auth/logout');
export const apiDeleteAccount = (authKey: string) => authed<{ ok: boolean }>('POST', '/v1/account/delete', { authKey });
