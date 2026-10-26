import http from 'node:http';
import { createLimiter, hashSecret, verifySecret, DUMMY, newRefreshToken, sha256hex, signJwt, verifyJwt } from './security.js';

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const KINDS = new Set(['note', 'task', 'category', 'reminder', 'vault']);
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const AUTHKEY_RE = /^[A-Za-z0-9_-]{43}$/; // 32 bytes, base64url, no padding
const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
const PAYLOAD_RE = /^[A-Za-z0-9_.-]*$/;

export function createApp({ config, store }) {
  const limiter = createLimiter();

  const clientIp = (req) => {
    if (config.trustProxy) {
      const xf = req.headers['x-forwarded-for'];
      if (typeof xf === 'string' && xf) return xf.split(',')[0].trim();
    }
    return req.socket.remoteAddress || 'unknown';
  };

  const throttle = (key, max, windowMs) => {
    const wait = limiter.take(key, max, windowMs);
    if (wait > 0) throw new HttpError(429, 'rate_limited', `Too many attempts. Try again in ${wait}s.`);
  };

  async function readJson(req) {
    const ct = String(req.headers['content-type'] || '');
    if (!ct.includes('application/json')) throw new HttpError(415, 'bad_content_type', 'Send application/json.');
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > config.maxBodyBytes) throw new HttpError(413, 'too_large', 'Request body is too large.');
      chunks.push(c);
    }
    try {
      const v = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('not object');
      return v;
    } catch {
      throw new HttpError(400, 'bad_json', 'Invalid JSON body.');
    }
  }

  async function issueTokens(user, device, existingSession) {
    const refreshToken = newRefreshToken();
    const expiresAt = Date.now() + config.refreshTtlSec * 1000;
    let sid;
    if (existingSession) {
      sid = existingSession.id;
      await store.rotateSession(sid, sha256hex(refreshToken), expiresAt);
    } else {
      const s = await store.createSession({ userId: user.id, tokenHash: sha256hex(refreshToken), device, expiresAt });
      sid = s.id;
    }
    const accessToken = signJwt({ sub: user.id, sid }, config.jwtSecret, config.accessTtlSec);
    return { user: { id: user.id, email: user.email }, accessToken, refreshToken, expiresIn: config.accessTtlSec };
  }

  async function authenticate(req) {
    const h = String(req.headers.authorization || '');
    const m = /^Bearer (.+)$/.exec(h);
    const claims = m ? verifyJwt(m[1], config.jwtSecret) : null;
    if (!claims || typeof claims.sub !== 'string' || typeof claims.sid !== 'string') throw new HttpError(401, 'unauthorized', 'Sign in again.');
    const s = await store.getSession(claims.sid);
    if (!s || s.revoked || s.userId !== claims.sub || s.expiresAt < Date.now()) throw new HttpError(401, 'unauthorized', 'Session expired. Sign in again.');
    return { userId: claims.sub, sessionId: claims.sid };
  }

  const validEmail = (v) => {
    const e = typeof v === 'string' ? v.trim().toLowerCase() : '';
    if (e.length > 254 || !EMAIL_RE.test(e)) throw new HttpError(400, 'bad_email', 'Enter a valid e-mail address.');
    return e;
  };
  const validAuthKey = (v) => {
    if (typeof v !== 'string' || !AUTHKEY_RE.test(v)) throw new HttpError(400, 'bad_auth_key', 'Invalid credentials format.');
    return v;
  };
  const deviceName = (v) => (typeof v === 'string' ? v.slice(0, 60) : null);

  function parseRecords(body) {
    if (!Array.isArray(body.records)) throw new HttpError(400, 'bad_records', 'records must be an array.');
    if (body.records.length > config.maxPushRecords) throw new HttpError(413, 'too_many', `Max ${config.maxPushRecords} records per push.`);
    const maxFuture = Date.now() + 24 * 3600 * 1000;
    return body.records.map((r) => {
      if (!r || typeof r !== 'object') throw new HttpError(400, 'bad_record', 'Invalid record.');
      if (!KINDS.has(r.kind)) throw new HttpError(400, 'bad_record', 'Unknown record kind.');
      if (typeof r.id !== 'string' || !ID_RE.test(r.id)) throw new HttpError(400, 'bad_record', 'Invalid record id.');
      const deleted = r.deleted === true;
      const payload = deleted ? '' : r.payload;
      if (typeof payload !== 'string' || payload.length > config.maxPayloadChars || !PAYLOAD_RE.test(payload) || (!deleted && payload.length === 0)) {
        throw new HttpError(400, 'bad_record', 'Invalid payload.');
      }
      if (!Number.isSafeInteger(r.updatedAt) || r.updatedAt < 0 || r.updatedAt > maxFuture) throw new HttpError(400, 'bad_record', 'Invalid timestamp.');
      return { kind: r.kind, id: r.id, payload, deleted, updatedAt: r.updatedAt };
    });
  }

  const routes = {
    'GET /health': async () => ({ status: 200, body: { ok: true, store: store.kind } }),

    'POST /v1/auth/register': async (req) => {
      if (!config.allowRegistration) throw new HttpError(403, 'registration_closed', 'Registration is closed on this server.');
      throttle(`reg:${clientIp(req)}`, 10, 3600_000);
      const body = await readJson(req);
      const email = validEmail(body.email);
      const authKey = validAuthKey(body.authKey);
      const { salt, hash } = await hashSecret(authKey);
      const user = await store.createUser({ email, authSalt: salt, authHash: hash });
      if (!user) throw new HttpError(409, 'email_taken', 'This e-mail is already registered. Sign in instead.');
      return { status: 201, body: await issueTokens(user, deviceName(body.device)) };
    },

    'POST /v1/auth/login': async (req) => {
      const body = await readJson(req);
      const email = validEmail(body.email);
      const authKey = validAuthKey(body.authKey);
      throttle(`login-ip:${clientIp(req)}`, 30, 15 * 60_000);
      throttle(`login:${email}`, 8, 15 * 60_000);
      const user = await store.getUserByEmail(email);
      const ok = await verifySecret(authKey, user ? user.authSalt : DUMMY.salt, user ? user.authHash : DUMMY.hash);
      if (!user || !ok) throw new HttpError(401, 'invalid_credentials', 'Incorrect e-mail or master password.');
      return { status: 200, body: await issueTokens(user, deviceName(body.device)) };
    },

    'POST /v1/auth/refresh': async (req) => {
      throttle(`refresh:${clientIp(req)}`, 120, 15 * 60_000);
      const body = await readJson(req);
      if (typeof body.refreshToken !== 'string' || body.refreshToken.length > 100) throw new HttpError(400, 'bad_token', 'Invalid token.');
      const s = await store.getSessionByTokenHash(sha256hex(body.refreshToken));
      if (!s || s.revoked || s.expiresAt < Date.now()) throw new HttpError(401, 'unauthorized', 'Session expired. Sign in again.');
      const user = await store.getUserById(s.userId);
      if (!user) throw new HttpError(401, 'unauthorized', 'Session expired. Sign in again.');
      return { status: 200, body: await issueTokens(user, null, s) };
    },

    'POST /v1/auth/logout': async (req) => {
      const auth = await authenticate(req);
      await store.revokeSession(auth.sessionId);
      return { status: 200, body: { ok: true } };
    },

    'POST /v1/account/delete': async (req) => {
      const auth = await authenticate(req);
      throttle(`del:${auth.userId}`, 5, 15 * 60_000);
      const body = await readJson(req);
      const authKey = validAuthKey(body.authKey);
      const user = await store.getUserById(auth.userId);
      if (!user || !(await verifySecret(authKey, user.authSalt, user.authHash))) throw new HttpError(401, 'invalid_credentials', 'Incorrect master password.');
      await store.deleteUser(user.id);
      return { status: 200, body: { ok: true } };
    },

    'GET /v1/sync/pull': async (req, url) => {
      const auth = await authenticate(req);
      throttle(`pull:${auth.userId}`, 600, 15 * 60_000);
      const since = Number(url.searchParams.get('since') ?? 0);
      if (!Number.isSafeInteger(since) || since < 0) throw new HttpError(400, 'bad_cursor', 'Invalid cursor.');
      const { records, more } = await store.pull(auth.userId, since, config.pullPageSize);
      const cursor = records.length ? records[records.length - 1].rev : since;
      return { status: 200, body: { records, cursor, more } };
    },

    'POST /v1/sync/push': async (req) => {
      const auth = await authenticate(req);
      throttle(`push:${auth.userId}`, 600, 15 * 60_000);
      const body = await readJson(req);
      const records = parseRecords(body);
      if (records.length === 0) return { status: 200, body: { accepted: [], rejected: [] } };
      const { accepted, rejected } = await store.push(auth.userId, records);
      return { status: 200, body: { accepted, rejected } };
    },

    'GET /v1/sync/status': async (req) => {
      const auth = await authenticate(req);
      return { status: 200, body: await store.counts(auth.userId) };
    },
  };

  function applyHeaders(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    const origin = req.headers.origin;
    if (origin && config.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
  }

  async function handler(req, res) {
    const started = Date.now();
    applyHeaders(req, res);
    let status = 500;
    try {
      if (req.method === 'OPTIONS') {
        status = 204;
        res.writeHead(204).end();
        return;
      }
      const url = new URL(req.url || '/', 'http://localhost');
      const route = routes[`${req.method} ${url.pathname}`];
      if (!route) throw new HttpError(404, 'not_found', 'Not found.');
      const out = await route(req, url);
      status = out.status;
      const json = JSON.stringify(out.body);
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(json) });
      res.end(json);
    } catch (e) {
      const he = e instanceof HttpError ? e : null;
      if (!he) console.error('[error]', e);
      status = he ? he.status : 500;
      const json = JSON.stringify({ error: { code: he ? he.code : 'server_error', message: he ? he.message : 'Something went wrong on the server.' } });
      if (!res.headersSent) res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(json) });
      res.end(json);
    } finally {
      if (process.env.NODE_ENV !== 'test') console.log(`${req.method} ${String(req.url).split('?')[0]} ${status} ${Date.now() - started}ms`);
    }
  }

  const server = http.createServer(handler);
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  return { server, handler, limiter };
}
