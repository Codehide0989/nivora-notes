/**
 * App-wide constants you will want to customise before publishing.
 * Replace the e-mail and URLs below with your own.
 */
export const APP_NAME = 'Nivora Notes';
export const SUPPORT_EMAIL = 'support@nivora.app';
export const PRIVACY_URL = 'https://nivora.app/privacy';
export const TERMS_URL = 'https://nivora.app/terms';
export const WEBSITE_URL = 'https://nivora.app';

/**
 * Cloud sync server (the small API in /server, backed by Neon Postgres).
 * Set it in a .env file: EXPO_PUBLIC_API_URL=https://your-server.example.com
 * The app NEVER talks to the database directly and never contains database credentials.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');

/**
 * PBKDF2-SHA256 rounds used to turn the master password into keys, on the device.
 * Higher = harder to brute-force, but slower on phones (pure JS). This value must be identical on every
 * device that signs in to the same account, so do not change it after people have created accounts.
 */
export const KDF_ITERATIONS = 100_000;

/** Seconds the vault stays unlocked after a successful PIN / biometric check. */
export const VAULT_UNLOCK_SECONDS = 120;
/** Seconds before a copied password is wiped from the clipboard. */
export const CLIPBOARD_CLEAR_SECONDS = 30;
