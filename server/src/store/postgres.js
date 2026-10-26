import pg from 'pg';

/** PostgreSQL (Neon) store. Uses parameterised queries only. */
export function createPostgresStore({ databaseUrl, maxRecordsPerUser = 50_000 }) {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 10_000, // Neon suspends idle compute; do not keep stale sockets around
    connectionTimeoutMillis: 15_000,
  });
  pool.on('error', (err) => console.error('[pg] idle client error:', err.message));

  const q = (text, params) => pool.query(text, params);

  const user = (r) =>
    r && {
      id: r.id,
      email: r.email,
      authSalt: r.auth_salt,
      authHash: r.auth_hash,
    };
  const session = (r) =>
    r && {
      id: r.id,
      userId: r.user_id,
      tokenHash: r.token_hash,
      expiresAt: new Date(r.expires_at).getTime(),
      revoked: r.revoked,
    };

  return {
    kind: 'postgres',
    pool,
    async ping() {
      await q('select 1');
      return true;
    },
    async createUser({ email, authSalt, authHash }) {
      const r = await q(
        'insert into users (email, auth_salt, auth_hash) values ($1,$2,$3) on conflict (email) do nothing returning *',
        [email, authSalt, authHash],
      );
      return user(r.rows[0]) ?? null;
    },
    async getUserByEmail(email) {
      return user((await q('select * from users where email = $1', [email])).rows[0]) ?? null;
    },
    async getUserById(id) {
      return user((await q('select * from users where id = $1', [id])).rows[0]) ?? null;
    },
    async deleteUser(id) {
      await q('delete from users where id = $1', [id]); // sessions + records cascade
    },
    async createSession({ userId, tokenHash, device, expiresAt }) {
      const r = await q(
        'insert into sessions (user_id, token_hash, device, expires_at) values ($1,$2,$3,to_timestamp($4 / 1000.0)) returning *',
        [userId, tokenHash, device ?? null, expiresAt],
      );
      return session(r.rows[0]);
    },
    async getSession(id) {
      return session((await q('select * from sessions where id = $1', [id])).rows[0]) ?? null;
    },
    async getSessionByTokenHash(hash) {
      return session((await q('select * from sessions where token_hash = $1', [hash])).rows[0]) ?? null;
    },
    async rotateSession(id, tokenHash, expiresAt) {
      await q('update sessions set token_hash = $2, expires_at = to_timestamp($3 / 1000.0) where id = $1', [id, tokenHash, expiresAt]);
    },
    async revokeSession(id) {
      await q('update sessions set revoked = true where id = $1', [id]);
    },
    async pull(userId, since, limit) {
      const r = await q(
        `select kind, id, payload, deleted, client_updated_at, rev
           from records where user_id = $1 and rev > $2 order by rev asc limit $3`,
        [userId, since, limit + 1],
      );
      const rows = r.rows.map((x) => ({
        kind: x.kind,
        id: x.id,
        payload: x.payload,
        deleted: x.deleted,
        updatedAt: Number(x.client_updated_at),
        rev: Number(x.rev),
      }));
      return { records: rows.slice(0, limit), more: rows.length > limit };
    },
    async push(userId, incoming) {
      const client = await pool.connect();
      const accepted = [];
      const rejected = [];
      try {
        await client.query('begin');
        // Serialise pushes per user so `rev` values become visible in order (cursors never skip rows).
        await client.query('select pg_advisory_xact_lock(hashtext($1))', [userId]);
        const total = Number((await client.query('select count(*)::int as n from records where user_id = $1', [userId])).rows[0].n);
        let room = Math.max(0, maxRecordsPerUser - total);
        for (const r of incoming) {
          const key = `${r.kind}:${r.id}`;
          const exists = (await client.query('select 1 from records where user_id=$1 and kind=$2 and id=$3', [userId, r.kind, r.id])).rowCount > 0;
          if (!exists) {
            if (room <= 0) {
              rejected.push(key);
              continue;
            }
            room -= 1;
          }
          const res = await client.query(
            `insert into records (user_id, kind, id, payload, deleted, client_updated_at, rev)
             values ($1,$2,$3,$4,$5,$6, nextval('records_rev_seq'))
             on conflict (user_id, kind, id) do update
               set payload = excluded.payload,
                   deleted = excluded.deleted,
                   client_updated_at = excluded.client_updated_at,
                   rev = excluded.rev,
                   updated_at = now()
               where records.client_updated_at <= excluded.client_updated_at`,
            [userId, r.kind, r.id, r.deleted ? '' : r.payload, r.deleted, r.updatedAt],
          );
          if (res.rowCount > 0) accepted.push(key);
          else rejected.push(key);
        }
        await client.query('commit');
      } catch (e) {
        await client.query('rollback').catch(() => undefined);
        throw e;
      } finally {
        client.release();
      }
      return { accepted, rejected };
    },
    async counts(userId) {
      const r = await q(
        `select count(*) filter (where not deleted)::int as records, count(*) filter (where deleted)::int as tombstones
           from records where user_id = $1`,
        [userId],
      );
      return r.rows[0];
    },
    async close() {
      await pool.end();
    },
  };
}
