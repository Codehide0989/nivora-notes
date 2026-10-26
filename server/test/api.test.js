import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';
const { createApp } = await import('../src/app.js');
const { createMemoryStore } = await import('../src/store/memory.js');
const { loadConfig } = await import('../src/config.js');

let app;
let base;
const config = loadConfig({ STORE: 'memory', JWT_SECRET: 'x'.repeat(48), ALLOW_REGISTRATION: 'true' });
const key = () => crypto.randomBytes(32).toString('base64url');

async function call(method, path, { body, token, headers } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, headers: res.headers };
}

before(async () => {
  app = createApp({ config, store: createMemoryStore() });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
});
after(() => app.server.close());
beforeEach(() => app.limiter.clear());

const register = async (email = `u${crypto.randomUUID()}@example.com`) => {
  const authKey = key();
  const r = await call('POST', '/v1/auth/register', { body: { email, authKey, device: 'test' } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return { email, authKey, ...r.json };
};

const rec = (id, updatedAt, extra = {}) => ({ kind: 'note', id, payload: 'AAAA.bbbb_CC-d', deleted: false, updatedAt, ...extra });

test('health + security headers', async () => {
  const r = await call('GET', '/health');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('register, duplicate e-mail, login, wrong password', async () => {
  const u = await register('Alice@Example.com');
  assert.equal(u.user.email, 'alice@example.com');
  assert.ok(u.accessToken && u.refreshToken);
  const dup = await call('POST', '/v1/auth/register', { body: { email: 'alice@example.com', authKey: key() } });
  assert.equal(dup.status, 409);
  const ok = await call('POST', '/v1/auth/login', { body: { email: 'ALICE@example.com', authKey: u.authKey } });
  assert.equal(ok.status, 200);
  const bad = await call('POST', '/v1/auth/login', { body: { email: 'alice@example.com', authKey: key() } });
  assert.equal(bad.status, 401);
  const none = await call('POST', '/v1/auth/login', { body: { email: 'nobody@example.com', authKey: key() } });
  assert.equal(none.status, 401);
  assert.equal(none.json.error.message, bad.json.error.message);
});

test('input validation', async () => {
  assert.equal((await call('POST', '/v1/auth/register', { body: { email: 'nope', authKey: key() } })).status, 400);
  assert.equal((await call('POST', '/v1/auth/register', { body: { email: 'a@b.co', authKey: 'short' } })).status, 400);
  const res = await fetch(base + '/v1/auth/register', { method: 'POST', body: 'x' });
  assert.equal(res.status, 415);
  const bad = await fetch(base + '/v1/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' });
  assert.equal(bad.status, 400);
});

test('sync endpoints require a valid token', async () => {
  assert.equal((await call('GET', '/v1/sync/pull')).status, 401);
  assert.equal((await call('GET', '/v1/sync/pull', { token: 'a.b.c' })).status, 401);
});

test('push, pull, cursor, tombstones and last-write-wins', async () => {
  const u = await register();
  const t = u.accessToken;
  const now = Date.now();
  const p1 = await call('POST', '/v1/sync/push', { token: t, body: { records: [rec('n1', now), rec('n2', now), { ...rec('t1', now), kind: 'task' }] } });
  assert.deepEqual(p1.json.accepted.sort(), ['note:n1', 'note:n2', 'task:t1']);

  const pull = await call('GET', '/v1/sync/pull?since=0', { token: t });
  assert.equal(pull.json.records.length, 3);
  assert.equal(pull.json.more, false);
  const cursor = pull.json.cursor;

  // older write is rejected, newer accepted
  const stale = await call('POST', '/v1/sync/push', { token: t, body: { records: [rec('n1', now - 5000)] } });
  assert.deepEqual(stale.json.rejected, ['note:n1']);
  const newer = await call('POST', '/v1/sync/push', { token: t, body: { records: [rec('n1', now + 10, { payload: 'NEW.payload' })] } });
  assert.deepEqual(newer.json.accepted, ['note:n1']);

  const delta = await call('GET', `/v1/sync/pull?since=${cursor}`, { token: t });
  assert.equal(delta.json.records.length, 1);
  assert.equal(delta.json.records[0].payload, 'NEW.payload');

  // tombstone
  await call('POST', '/v1/sync/push', { token: t, body: { records: [{ kind: 'note', id: 'n2', deleted: true, updatedAt: now + 20 }] } });
  const after = await call('GET', `/v1/sync/pull?since=${delta.json.cursor}`, { token: t });
  assert.equal(after.json.records[0].deleted, true);
  assert.equal(after.json.records[0].payload, '');
  const st = await call('GET', '/v1/sync/status', { token: t });
  assert.deepEqual(st.json, { records: 2, tombstones: 1 });
});

test('pagination', async () => {
  const u = await register();
  const now = Date.now();
  const many = Array.from({ length: 200 }, (_, i) => rec(`p${i}`, now));
  await call('POST', '/v1/sync/push', { token: u.accessToken, body: { records: many } });
  await call('POST', '/v1/sync/push', { token: u.accessToken, body: { records: Array.from({ length: 150 }, (_, i) => rec(`q${i}`, now)) } });
  let since = 0;
  let total = 0;
  let pages = 0;
  for (;;) {
    const r = await call('GET', `/v1/sync/pull?since=${since}`, { token: u.accessToken });
    total += r.json.records.length;
    since = r.json.cursor;
    pages += 1;
    if (!r.json.more) break;
  }
  assert.equal(total, 350);
  assert.equal(pages, 2);
});

test('push validation: kind, id, payload charset, timestamps, size', async () => {
  const u = await register();
  const t = u.accessToken;
  const bad = async (r) => assert.equal((await call('POST', '/v1/sync/push', { token: t, body: { records: [r] } })).status, 400, JSON.stringify(r));
  await bad({ ...rec('a', 1), kind: 'evil' });
  await bad(rec('bad id with spaces', 1));
  await bad(rec('a', 1, { payload: '<script>' }));
  await bad(rec('a', 1, { payload: '' }));
  await bad(rec('a', Date.now() + 10 * 24 * 3600 * 1000));
  await bad(rec('a', -1));
  await bad(rec('a', 1.5));
  const big = await call('POST', '/v1/sync/push', { token: t, body: { records: [rec('a', 1, { payload: 'A'.repeat(300_000) })] } });
  assert.equal(big.status, 400);
  const tooMany = await call('POST', '/v1/sync/push', { token: t, body: { records: Array.from({ length: 201 }, (_, i) => rec(`x${i}`, 1)) } });
  assert.equal(tooMany.status, 413);
});

test('users cannot see each other\'s records', async () => {
  const a = await register();
  const b = await register();
  await call('POST', '/v1/sync/push', { token: a.accessToken, body: { records: [rec('secret', Date.now())] } });
  const r = await call('GET', '/v1/sync/pull?since=0', { token: b.accessToken });
  assert.equal(r.json.records.length, 0);
});

test('refresh rotates the token; old refresh token stops working; logout revokes', async () => {
  const u = await register();
  const r1 = await call('POST', '/v1/auth/refresh', { body: { refreshToken: u.refreshToken } });
  assert.equal(r1.status, 200);
  assert.notEqual(r1.json.refreshToken, u.refreshToken);
  const reuse = await call('POST', '/v1/auth/refresh', { body: { refreshToken: u.refreshToken } });
  assert.equal(reuse.status, 401);
  const lo = await call('POST', '/v1/auth/logout', { token: r1.json.accessToken });
  assert.equal(lo.status, 200);
  assert.equal((await call('GET', '/v1/sync/pull', { token: r1.json.accessToken })).status, 401);
  assert.equal((await call('POST', '/v1/auth/refresh', { body: { refreshToken: r1.json.refreshToken } })).status, 401);
});

test('login is rate limited per e-mail', async () => {
  const u = await register();
  let last;
  for (let i = 0; i < 9; i += 1) last = await call('POST', '/v1/auth/login', { body: { email: u.email, authKey: key() } });
  assert.equal(last.status, 429);
  // even the right key is blocked while limited
  assert.equal((await call('POST', '/v1/auth/login', { body: { email: u.email, authKey: u.authKey } })).status, 429);
});

test('delete account needs the master key and wipes everything', async () => {
  const u = await register();
  await call('POST', '/v1/sync/push', { token: u.accessToken, body: { records: [rec('n', Date.now())] } });
  assert.equal((await call('POST', '/v1/account/delete', { token: u.accessToken, body: { authKey: key() } })).status, 401);
  assert.equal((await call('POST', '/v1/account/delete', { token: u.accessToken, body: { authKey: u.authKey } })).status, 200);
  assert.equal((await call('GET', '/v1/sync/pull', { token: u.accessToken })).status, 401);
  assert.equal((await call('POST', '/v1/auth/login', { body: { email: u.email, authKey: u.authKey } })).status, 401);
});

test('expired and tampered tokens are rejected', async () => {
  const { signJwt } = await import('../src/security.js');
  const u = await register();
  const claims = JSON.parse(Buffer.from(u.accessToken.split('.')[1], 'base64url').toString());
  const expired = signJwt({ sub: claims.sub, sid: claims.sid }, config.jwtSecret, -10);
  assert.equal((await call('GET', '/v1/sync/pull', { token: expired })).status, 401);
  const forged = signJwt({ sub: claims.sub, sid: claims.sid }, 'y'.repeat(48), 600);
  assert.equal((await call('GET', '/v1/sync/pull', { token: forged })).status, 401);
  const [h, , s] = u.accessToken.split('.');
  const body = Buffer.from(JSON.stringify({ ...claims, sub: crypto.randomUUID() })).toString('base64url');
  assert.equal((await call('GET', '/v1/sync/pull', { token: `${h}.${body}.${s}` })).status, 401);
});

test('registration can be closed', async () => {
  const closed = createApp({ config: { ...config, allowRegistration: false }, store: createMemoryStore() });
  await new Promise((r) => closed.server.listen(0, '127.0.0.1', r));
  const res = await fetch(`http://127.0.0.1:${closed.server.address().port}/v1/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.co', authKey: key() }),
  });
  assert.equal(res.status, 403);
  closed.server.close();
});

test('config refuses weak or missing secrets', () => {
  assert.throws(() => loadConfig({ STORE: 'memory', JWT_SECRET: 'short' }), /JWT_SECRET/);
  assert.throws(() => loadConfig({ JWT_SECRET: 'x'.repeat(40) }), /DATABASE_URL/);
});
