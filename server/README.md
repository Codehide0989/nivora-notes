# Nivora sync server (Node + Neon Postgres)

A small, dependency-light API (only `pg`) that stores **encrypted** records for Nivora Notes.
The server never sees notes, tasks, passwords, your master password or your encryption key — only scrambled blobs.

## Why the app does not talk to Neon directly
A Postgres connection string contains the database password. Anything inside an APK/IPA can be extracted, so a
direct connection would expose **every user's data**. The app talks to this API instead; only this server holds `DATABASE_URL`.

## 1. Create the Neon database
1. Sign in at <https://console.neon.tech> and create a project (any region close to your server).
2. Open **Connect** and choose the **Pooled connection** string. It looks like
   `postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require`.
3. Keep it secret. Never paste it into the app or commit it.

## 2. Configure and run locally
```bash
cd server
cp .env.example .env          # then edit .env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # use the output as JWT_SECRET
npm install
npm run db:migrate            # creates the tables in Neon (safe to re-run)
npm test                      # 14 API tests (use an in-memory store, no database needed)
npm start                     # http://localhost:8787  ->  GET /health
```
No Neon account yet? `npm run dev:memory` runs everything in memory (data is lost on restart) with `JWT_SECRET` set.

## 3. Deploy (needs HTTPS)
Any host that runs Node 20+ works (Render, Railway, Fly.io, a VPS behind Nginx/Caddy).
Set the same variables as in `.env` (`DATABASE_URL`, `JWT_SECRET`, `TRUST_PROXY=true`), use `npm start` as the start command
and `npm install` as the build command. Put the resulting `https://...` address in the app (`.env` → `EXPO_PUBLIC_API_URL`,
or Settings → Cloud account → Server address). After you and your users have registered, set `ALLOW_REGISTRATION=false`.

## API (all JSON)
| Method & path | Purpose |
|---|---|
| `GET /health` | liveness |
| `POST /v1/auth/register` `{email, authKey, device?}` | create account, returns tokens |
| `POST /v1/auth/login` `{email, authKey, device?}` | sign in |
| `POST /v1/auth/refresh` `{refreshToken}` | rotate refresh token, new access token |
| `POST /v1/auth/logout` | revoke this session |
| `POST /v1/account/delete` `{authKey}` | delete account + all records |
| `GET /v1/sync/pull?since=<rev>` | records changed after `rev` (paged) |
| `POST /v1/sync/push` `{records:[{kind,id,payload,deleted,updatedAt}]}` | upload (last-write-wins) |
| `GET /v1/sync/status` | record counts |

`authKey` is 32 bytes derived on the phone from the master password (PBKDF2-SHA256 → HKDF). It is hashed again here with scrypt + random salt.
The separate encryption key never leaves the phone.

## What is protected, and what is not
- **Protected:** note / task / reminder / vault contents (ChaCha20-Poly1305, per-record random nonce, record id bound as associated data, so the server cannot swap or tamper with records undetected).
- **Visible to the server:** your e-mail, record kinds, random record ids, sizes and timestamps, and when you sync.
- **Hardening included:** scrypt-hashed credentials, HS256 access tokens (15 min) + rotating refresh tokens (60 days, stored hashed), per-IP and per-account rate limits, strict input validation and size limits, parameterised SQL only, no request bodies in logs, security headers.
- **Not included:** e-mail verification and password reset (impossible by design: the key is derived from the password), and a shared rate-limit store for multi-instance deployments (put your platform's limiter in front, or add Redis).
- The PostgreSQL store was written against the schema in `schema.sql` but has not been exercised against a live Neon database in the authoring environment; run `npm run db:migrate` and register one test account first.
