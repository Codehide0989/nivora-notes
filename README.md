# Nivora Notes

A bold, private, offline-first notes app built with **Expo (React Native) + expo-router + TypeScript**.
Yellow / black / orange neo-brutalist design with light, dark and auto themes.

> **Honest status:** this project was written in an environment with no access to the npm registry, so it has
> **never been installed, bundled or run on a device**. Follow "Quick start" below; if Expo reports a version
> mismatch, `npx expo install --fix` aligns every package to your Expo SDK. Expect to fix small issues on first run.

## Quick start

Requirements: **Node 20.19.4+** (or 22.13+ / 24.3+), npm, and the **Expo Go** app (or an Android emulator / iOS simulator).
The project targets **Expo SDK 58** (React Native 0.88), which is what the current Expo Go from the Play Store / App Store runs.

```bash
npm install
npx expo install --fix      # aligns every package with SDK 58 (run once, and after any dependency change)
npx expo-doctor             # checks the project for known problems
npx expo start -c           # scan the QR code with Expo Go
```

**"Project is incompatible with this version of Expo Go"** means the SDK of the project and of the Expo Go app differ.
Fix it by making them match, in either direction:
- Project older than Expo Go: `npx expo install expo@^58.0.0 --fix` (this project is already on 58, so just run the commands above), or
- Expo Go older than the project: install the Expo Go build that matches the project's SDK from <https://expo.dev/go>.

Other commands:

```bash
npx expo start --android    # open on Android emulator/device
npx expo start --ios        # open on iOS simulator (macOS)
npx expo start -c           # start with a cleared Metro cache
npm run typecheck           # TypeScript check
```

To move to a newer SDK later: `npx expo install expo@latest --fix`, then `npx expo-doctor`, and read that SDK's changelog.

### Development build (recommended for notifications, audio, biometrics)

Some features are limited in Expo Go: on **Android, reminder notifications are switched off in Expo Go** (the notifications module cannot load there since SDK 53; the app still opens and everything else works). Use a development build (`npx expo run:android`) or the released app for reminders. Biometrics and background behaviour are also more reliable in a development build.
For full behaviour use a development build:

```bash
npx expo run:android        # needs Android Studio / SDK
npx expo run:ios            # needs Xcode (macOS)
```

### Release builds (EAS)

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview      # installable APK
eas build -p android --profile production   # Play Store AAB
eas build -p ios --profile production
```

Change the app name, `scheme`, bundle id (`app.nivora.notes`) and icons in `app.json` / `assets/` before publishing.

## Cloud sync + Vault in 5 minutes

The app never connects to Neon directly (a database password inside an APK can be extracted). It talks to the small API in [`/server`](server/README.md), which holds the Neon connection string.

```bash
# 1) Neon: console.neon.tech -> create project -> Connect -> "Pooled connection" -> copy the string

# 2) server
cd server
cp .env.example .env            # paste DATABASE_URL, set JWT_SECRET (command is inside .env.example)
npm install
npm run db:migrate              # creates the tables in Neon
npm test                        # 14 tests
npm start                       # http://localhost:8787/health

# 3) deploy the server somewhere with HTTPS (Render / Railway / Fly / VPS) and copy its https address

# 4) app
cd ..
cp .env.example .env            # EXPO_PUBLIC_API_URL=https://your-server.example.com
npx expo start -c
```
In the app: **Settings → Cloud account → Create account** (or paste the server address there instead of using `.env`).
Open the same account on a second phone with **Sign in** and everything appears there.

How it stays secure:
- Your **master password never leaves the phone**. It is stretched on the device (PBKDF2-SHA256, 100k rounds) into two keys: an *auth key* (sent to the server, hashed again with scrypt) and an *encryption key* (kept only in Android Keystore / iOS Keychain).
- Every record is encrypted with ChaCha20-Poly1305 (random nonce, record id as associated data) **before** upload. Neon stores only ciphertext.
- Vault entries are also encrypted at rest on the phone with a random device key held in the Keychain/Keystore, unlock needs your app PIN or fingerprint each time, and the screen cannot be captured while it is open.
- The master password **cannot be reset** (that is what makes it zero-knowledge). Forgetting it means the cloud copy is unreadable. Keep a normal backup (Settings → Backup & restore) for notes. Vault passwords are not included in backup files, they only live on the phone and in your encrypted cloud copy.
- Photos and voice recordings stay on the device that created them (only text content syncs).
- Conflicts are resolved last-write-wins per item; deletions sync as tombstones.
- More detail and the API: [`server/README.md`](server/README.md).

## Features

- Notes: create/edit with auto-save, pin, colour, categories, tags, duplicate, word count, templates (meeting, journal, travel, planner…)
- Rich text (markdown toolbar: bold, italic, highlight, headings, lists, checklists, undo/redo) with live preview
- Images (gallery/camera) and voice notes (record, play, attach)
- Search with ranking, highlighting, category/media filters and recent searches
- Categories (custom icon + colour), category detail screens
- To-do lists: tasks, subtasks, priority, due dates, completed list, clear completed
- Reminders: one-off, daily, weekly, monthly; snooze/done notification actions; daily summary
- Share & export: text, PDF, Markdown, plain text, HTML, print, copy
- Trash with restore, delete-forever confirmation and auto-purge
- Security: PIN (salted, hashed, SecureStore, lockout), biometrics, per-note lock, auto-lock, privacy cover
- Backup & restore: `.nivora` files (optionally with media), merge or replace, safety copies, auto backup
- **Vault (new):** save website, ID/username and password for any account. PIN / fingerprint required every time it opens, auto-lock, password generator + strength meter, weak/reused password check, clipboard auto-clear, screenshots blocked
- **Encrypted cloud sync (new):** sign in once and notes, tasks, categories, reminders and Vault passwords sync between your devices through a small server backed by **Neon Postgres**. Everything is end-to-end encrypted on the phone, so the server and database only ever hold scrambled data
- Offline-first: local storage, offline banner/status screens, sync screens, pluggable `SyncAdapter`
- Appearance: theme, accent colour, text size; languages: English, Hindi, Spanish
- Status screens: success, error, network error, backup failed, account deleted, etc.

## Project structure

```
app/            expo-router screens (file-based routes)
  (tabs)/       Notes, Tasks, Reminders, Vault, Settings
  vault/        add / edit a login
server/         Node + Neon Postgres sync API (own README, schema.sql, tests)
  prefs/        appearance, notifications, security, pin, fingerprint, backup, sync, language, help, about
  status/       generic success / failure screens ([kind].tsx)
src/
  components/   ui kit (Brutal surfaces, buttons, fields, sheets) + app components
  services/     notifications, backup, export, gate (locks), account, templates, haptics
  store/        zustand stores (data, settings, session, ui, cloud, vault)
  services/     ... crypto.ts (all cryptography), cloud.ts / cloudApi.ts / cloudCore.ts / cloudKeys.ts (encrypted sync), clipboard.ts, vaultAccess.ts
  i18n/         en (keys), hi.ts, es.ts
  theme/        colours, fonts, accents
  utils/        markdown, notes helpers, dates
  config.ts     support email, URLs, limits
```

## Customising

- **Support email / policy URLs / trash retention:** `src/config.ts`
- **Add a language:** create `src/i18n/xx.ts` exporting `Record<string,string>` (English text is the key), register it in `src/i18n/index.ts`. Missing keys fall back to English.
- **Cloud sync:** signing in to the Cloud account switches sync to the encrypted Neon-backed server. To use a different backend, implement the `SyncAdapter` interface (see `src/services/sync.ts`, call `setSyncAdapter()`).
- **Key-stretching cost:** `KDF_ITERATIONS` in `src/config.ts` (default 100,000; a few seconds on a phone). Must be identical on every device, so decide before real users sign up.

## Known limitations

- Cloud sync needs you to run the server (`/server`) and a Neon database; nothing is hosted for you. "Delete account" in Settings erases this device and, when signed in, also the cloud account.
- No e-mail verification / password reset for the cloud account (zero-knowledge design). Password change is not implemented yet.
- Not verified here: the Postgres queries against a live Neon database, and the app against the real `@noble/*` libraries on a device (the server API, the sync/merge logic and the encryption envelope were tested in Node, the latter with Node-crypto stand-ins for the noble libraries; see `server/test` and `npm run test:sync`).
- Voice notes are recorded audio only (no transcription).
- A forgotten PIN cannot be recovered (by design); restore from a backup after reinstalling.
- Not yet tested on devices; dependency versions are resolved by `npx expo install --fix`.

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm install` peer-dependency errors | `.npmrc` already sets `legacy-peer-deps`; delete `node_modules` and retry |
| Red screen about native module / version | `npx expo install --fix`, then `npx expo start -c` |
| Notifications don't fire in Expo Go | use a development build (`npx expo run:android`) |
| Cloud: "Could not reach the server" | check the https address; on a phone, `localhost` is the phone itself. Use your deployed URL or a tunnel (ngrok / Cloudflare Tunnel). Neon free tier may need ~2s to wake up |
| `Unable to resolve @noble/...` | `npm install`, then `npx expo start -c`. Both packages are pinned (`@noble/hashes` 1.8.0, `@noble/ciphers` 1.3.0); keep the 1.x versions |
| Fonts missing | `npx expo install @expo-google-fonts/archivo-black @expo-google-fonts/space-grotesk expo-font` |
| Metro cache issues | `npx expo start -c` |
