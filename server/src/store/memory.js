import crypto from 'node:crypto';

/** In-memory store: for tests and quick local trials only. Same interface as the Postgres store. */
export function createMemoryStore({ maxRecordsPerUser = 50_000 } = {}) {
  const users = new Map();
  const byEmail = new Map();
  const sessions = new Map();
  const records = new Map(); // userId -> Map("kind:id" -> record)
  let rev = 0;

  const userRecords = (uid) => {
    if (!records.has(uid)) records.set(uid, new Map());
    return records.get(uid);
  };

  return {
    kind: 'memory',
    async ping() {
      return true;
    },
    async createUser({ email, authSalt, authHash }) {
      if (byEmail.has(email)) return null;
      const user = { id: crypto.randomUUID(), email, authSalt, authHash, createdAt: Date.now() };
      users.set(user.id, user);
      byEmail.set(email, user.id);
      return user;
    },
    async getUserByEmail(email) {
      const id = byEmail.get(email);
      return id ? users.get(id) : null;
    },
    async getUserById(id) {
      return users.get(id) ?? null;
    },
    async deleteUser(id) {
      const u = users.get(id);
      if (!u) return;
      byEmail.delete(u.email);
      users.delete(id);
      records.delete(id);
      for (const [sid, s] of sessions) if (s.userId === id) sessions.delete(sid);
    },
    async createSession({ userId, tokenHash, device, expiresAt }) {
      const s = { id: crypto.randomUUID(), userId, tokenHash, device, expiresAt, revoked: false };
      sessions.set(s.id, s);
      return s;
    },
    async getSession(id) {
      return sessions.get(id) ?? null;
    },
    async getSessionByTokenHash(hash) {
      for (const s of sessions.values()) if (s.tokenHash === hash) return s;
      return null;
    },
    async rotateSession(id, tokenHash, expiresAt) {
      const s = sessions.get(id);
      if (s) Object.assign(s, { tokenHash, expiresAt });
    },
    async revokeSession(id) {
      const s = sessions.get(id);
      if (s) s.revoked = true;
    },
    async pull(userId, since, limit) {
      const rows = [...userRecords(userId).values()]
        .filter((r) => r.rev > since)
        .sort((a, b) => a.rev - b.rev)
        .slice(0, limit + 1);
      const more = rows.length > limit;
      return { records: rows.slice(0, limit), more };
    },
    async push(userId, incoming) {
      const map = userRecords(userId);
      const accepted = [];
      const rejected = [];
      for (const r of incoming) {
        const key = `${r.kind}:${r.id}`;
        const cur = map.get(key);
        if (!cur && map.size >= maxRecordsPerUser) {
          rejected.push(key);
          continue;
        }
        if (cur && cur.updatedAt > r.updatedAt) {
          rejected.push(key);
          continue;
        }
        rev += 1;
        map.set(key, { kind: r.kind, id: r.id, payload: r.deleted ? '' : r.payload, deleted: r.deleted, updatedAt: r.updatedAt, rev });
        accepted.push(key);
      }
      return { accepted, rejected };
    },
    async counts(userId) {
      const all = [...userRecords(userId).values()];
      return { records: all.filter((r) => !r.deleted).length, tombstones: all.filter((r) => r.deleted).length };
    },
  };
}
