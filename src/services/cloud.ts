import { Platform } from 'react-native';
import { useData } from '@/store/data';
import { useCloud } from '@/store/cloud';
import { applyRemoteVault, ensureVaultLoaded, holdVault, releaseVault, useVault } from '@/store/vault';
import { removeUnreferenced } from '@/services/media';
import { cancelNotification, rescheduleAll } from '@/services/notifications';
import { chunk, keyOf, planPull, planPush, stripForSync } from '@/services/cloudCore';
import type { Item, Kind, RemoteRecord } from '@/services/cloudCore';
import { ApiError, apiDeleteAccount, apiLogin, apiLogout, apiPull, apiPush, apiRegister, isServerConfigured } from '@/services/cloudApi';
import { clearCloudKeys, loadEncKey, saveEncKey, saveTokens } from '@/services/cloudKeys';
import { deriveAccountKeys, open, recordAad, seal, sha256Hex } from '@/services/crypto';
import { SyncError } from '@/services/syncTypes';
import type { SyncAdapter, SyncStep } from '@/services/syncTypes';
import type { Category, Note, Reminder, Task, VaultItem } from '@/types';

const deviceLabel = () => `${Platform.OS} ${String(Platform.Version)}`.slice(0, 60);

// ---------------------------------------------------------------- account

export type AuthMode = 'register' | 'login';

/** Sign in or create an account. The master password never leaves this device; only a derived key is sent. */
export async function cloudSignIn(mode: AuthMode, email: string, password: string): Promise<void> {
  if (!isServerConfigured()) throw new ApiError(0, 'not_configured', 'Cloud sync is not set up. Add your server address first.');
  const mail = email.trim().toLowerCase();
  const keys = await deriveAccountKeys(mail, password);
  const res = mode === 'register' ? await apiRegister(mail, keys.authKey, deviceLabel()) : await apiLogin(mail, keys.authKey, deviceLabel());
  await saveEncKey(keys.encKey);
  await saveTokens(res.accessToken, res.refreshToken);
  useCloud.getState().set({ signedIn: true, email: res.user.email, userId: res.user.id, cursor: 0, hashes: {}, lastSyncAt: null });
}

/** Forget the account on this device. Notes and vault entries stay on the phone. */
export async function cloudSignOut(): Promise<void> {
  try {
    if (useCloud.getState().signedIn) await apiLogout();
  } catch {
    /* offline or session already gone: still sign out locally */
  }
  await clearCloudKeys();
  useCloud.getState().resetAccount();
}

/** Permanently delete the account and every encrypted record on the server. Needs the master password. */
export async function cloudDeleteAccount(password: string): Promise<void> {
  const { email } = useCloud.getState();
  const keys = await deriveAccountKeys(email, password);
  await apiDeleteAccount(keys.authKey);
  await clearCloudKeys();
  useCloud.getState().resetAccount();
}

/** Check a master password against the one used on this device (without a server round trip). */
export async function verifyMasterPassword(password: string): Promise<boolean> {
  const stored = await loadEncKey();
  if (!stored) return false;
  const keys = await deriveAccountKeys(useCloud.getState().email, password);
  return keys.encKey.length === stored.length && keys.encKey.every((b, i) => b === stored[i]);
}

// ---------------------------------------------------------------- local items

function localItems(vault: VaultItem[] | null): Map<string, Item> {
  const d = useData.getState();
  const map = new Map<string, Item>();
  const add = (kind: Kind, id: string, updatedAt: number, data: object) => {
    map.set(keyOf(kind, id), { kind, id, updatedAt, data: stripForSync(kind, data as Record<string, unknown>) });
  };
  d.notes.forEach((n) => add('note', n.id, n.updatedAt, n));
  d.tasks.forEach((t) => add('task', t.id, t.updatedAt, t));
  // Built-in categories that were never edited are identical on every device, so they are not synced.
  d.categories.forEach((c) => {
    if (c.builtin && c.updatedAt === undefined) return;
    add('category', c.id, c.updatedAt ?? 0, c);
  });
  d.reminders.forEach((r) => add('reminder', r.id, r.updatedAt ?? r.createdAt, r));
  vault?.forEach((v) => add('vault', v.id, v.updatedAt, v));
  return map;
}

let pendingMemo: { deps: unknown[]; value: number } | null = null;

/** How many changes are waiting to be uploaded (used by the Sync screen). Memoised: hashing is not free. */
export function cloudPendingCount(): number {
  const d = useData.getState();
  const { hashes } = useCloud.getState();
  const v = useVault.getState();
  const deps = [d.notes, d.tasks, d.categories, d.reminders, hashes, v.loaded, v.items];
  if (pendingMemo && pendingMemo.deps.every((x, i) => x === deps[i])) return pendingMemo.value;
  const known = v.loaded ? hashes : Object.fromEntries(Object.entries(hashes).filter(([k]) => !k.startsWith('vault:')));
  const plan = planPush(localItems(v.loaded ? v.items : null), known, sha256Hex, Date.now());
  const value = plan.changed.length + plan.tombstones.length;
  pendingMemo = { deps, value };
  return value;
}

// ---------------------------------------------------------------- applying remote data

async function applyPlan(upserts: Item[], removals: { kind: Kind; id: string }[]): Promise<void> {
  const by = (kind: Kind) => ({
    up: upserts.filter((i) => i.kind === kind),
    rm: new Set(removals.filter((r) => r.kind === kind).map((r) => r.id)),
  });
  const n = by('note');
  const t = by('task');
  const c = by('category');
  const r = by('reminder');
  const v = by('vault');

  const state = useData.getState();
  const goneNotes = state.notes.filter((x) => n.rm.has(x.id));
  const goneReminders = state.reminders.filter((x) => r.rm.has(x.id));

  useData.setState((s) => {
    const incomingNotes = new Map(n.up.map((i) => [i.id, i.data as unknown as Note]));
    const notes = s.notes
      .filter((x) => !n.rm.has(x.id))
      .map((x) => (incomingNotes.has(x.id) ? { ...(incomingNotes.get(x.id) as Note), attachments: x.attachments, dirty: false } : x));
    const known = new Set(s.notes.map((x) => x.id));
    n.up.filter((i) => !known.has(i.id)).forEach((i) => notes.unshift({ ...(i.data as unknown as Note), attachments: [], dirty: false }));

    const incomingTasks = new Map(t.up.map((i) => [i.id, i.data as unknown as Task]));
    const tasks = s.tasks.filter((x) => !t.rm.has(x.id)).map((x) => (incomingTasks.has(x.id) ? { ...(incomingTasks.get(x.id) as Task), dirty: false } : x));
    const knownT = new Set(s.tasks.map((x) => x.id));
    t.up.filter((i) => !knownT.has(i.id)).forEach((i) => tasks.unshift({ ...(i.data as unknown as Task), dirty: false }));

    const incomingCats = new Map(c.up.map((i) => [i.id, i.data as unknown as Category]));
    const categories = s.categories.filter((x) => !c.rm.has(x.id)).map((x) => incomingCats.get(x.id) ?? x);
    const knownC = new Set(s.categories.map((x) => x.id));
    c.up.filter((i) => !knownC.has(i.id)).forEach((i) => categories.push(i.data as unknown as Category));

    const incomingRem = new Map(r.up.map((i) => [i.id, i.data as unknown as Reminder]));
    const reminders = s.reminders
      .filter((x) => !r.rm.has(x.id))
      .map((x) => (incomingRem.has(x.id) ? { ...(incomingRem.get(x.id) as Reminder), notificationId: x.notificationId } : x));
    const knownR = new Set(s.reminders.map((x) => x.id));
    r.up.filter((i) => !knownR.has(i.id)).forEach((i) => reminders.unshift({ ...(i.data as unknown as Reminder), notificationId: null }));

    return { notes, tasks, categories, reminders };
  });

  goneNotes.forEach((x) => removeUnreferenced(x.attachments.map((a) => a.uri)));
  for (const x of goneReminders) await cancelNotification(x.notificationId);
  if (r.up.length || r.rm.size) {
    try {
      await rescheduleAll();
    } catch {
      /* notifications unavailable */
    }
  }
  if (v.up.length || v.rm.size) await applyRemoteVault(v.up.map((i) => i.data as unknown as VaultItem), [...v.rm]);
}

// ---------------------------------------------------------------- the sync itself

const looksValid = (kind: Kind, id: string, data: unknown): data is Record<string, unknown> =>
  !!data && typeof data === 'object' && !Array.isArray(data) && (data as { id?: unknown }).id === id && ['note', 'task', 'category', 'reminder', 'vault'].includes(kind);

async function pullAll(enc: Uint8Array, report: (s: SyncStep) => void): Promise<{ records: RemoteRecord[]; cursor: number; skipped: number }> {
  let cursor = useCloud.getState().cursor;
  const records: RemoteRecord[] = [];
  let skipped = 0;
  for (let page = 0; page < 500; page += 1) {
    const res = await apiPull(cursor);
    for (const r of res.records) {
      if (r.deleted) {
        records.push({ kind: r.kind, id: r.id, deleted: true, updatedAt: r.updatedAt, data: null });
        continue;
      }
      try {
        const data = open<unknown>(enc, recordAad(r.kind, r.id), r.payload);
        if (!looksValid(r.kind, r.id, data)) throw new Error('shape');
        records.push({ kind: r.kind, id: r.id, deleted: false, updatedAt: r.updatedAt, data });
      } catch {
        skipped += 1; // wrong key, tampered or from a newer app version: never applied
      }
    }
    cursor = res.cursor;
    report({ fraction: Math.min(0.45, 0.2 + page * 0.05), label: `Receiving changes (${records.length})` });
    if (!res.more) break;
  }
  return { records, cursor, skipped };
}

async function pushAll(enc: Uint8Array, report: (s: SyncStep) => void): Promise<{ pushed: number; rejected: number }> {
  const vaultItems = useVault.getState().items;
  const local = localItems(vaultItems);
  const { hashes } = useCloud.getState();
  const plan = planPush(local, hashes, sha256Hex, Date.now());
  const rows = [
    ...plan.changed.map(({ item, hash }) => ({
      key: keyOf(item.kind, item.id),
      hash,
      body: { kind: item.kind, id: item.id, payload: seal(enc, recordAad(item.kind, item.id), item.data), deleted: false, updatedAt: item.updatedAt },
    })),
    ...plan.tombstones.map((t) => ({
      key: keyOf(t.kind, t.id),
      hash: null as string | null,
      body: { kind: t.kind, id: t.id, payload: '', deleted: true, updatedAt: t.updatedAt },
    })),
  ];
  let pushed = 0;
  let rejected = 0;
  const batches = chunk(rows, 100);
  for (let i = 0; i < batches.length; i += 1) {
    report({ fraction: 0.55 + (0.4 * i) / Math.max(1, batches.length), label: `Uploading encrypted changes (${pushed}/${rows.length})` });
    const batch = batches[i];
    const res = await apiPush(batch.map((b) => b.body));
    const ok = new Set(res.accepted);
    const next = { ...useCloud.getState().hashes };
    for (const b of batch) {
      if (!ok.has(b.key)) continue;
      if (b.hash === null) delete next[b.key];
      else next[b.key] = b.hash;
    }
    useCloud.getState().set({ hashes: next }); // saved after every batch, so an interrupted sync resumes cleanly
    pushed += res.accepted.length;
    rejected += res.rejected.length;
  }
  return { pushed, rejected };
}

export async function cloudSync(report: (s: SyncStep) => void): Promise<{ pushed: number; pulled: number }> {
  if (!isServerConfigured()) throw new SyncError('failed', 'Cloud sync is not set up. Add your server address in Settings → Sync & offline → Cloud account.');
  const enc = await loadEncKey();
  if (!enc || !useCloud.getState().signedIn) throw new SyncError('auth', 'Please sign in to your cloud account again.');

  holdVault();
  try {
    report({ fraction: 0.05, label: 'Connecting securely' });
    await ensureVaultLoaded();
    let pulled = 0;
    let pushed = 0;
    let skipped = 0;
    for (let round = 0; round < 3; round += 1) {
      const got = await pullAll(enc, report);
      skipped += got.skipped;
      const local = localItems(useVault.getState().items);
      const plan = planPull(local, useCloud.getState().hashes, got.records, sha256Hex);
      if (plan.upserts.length || plan.removals.length) {
        report({ fraction: 0.5, label: `Applying ${plan.upserts.length + plan.removals.length} changes` });
        await applyPlan(plan.upserts, plan.removals);
      }
      pulled += plan.upserts.length + plan.removals.length;
      const nextHashes = { ...useCloud.getState().hashes };
      for (const [k, v] of Object.entries(plan.hashes)) {
        if (v === null) delete nextHashes[k];
        else nextHashes[k] = v;
      }
      useCloud.getState().set({ cursor: got.cursor, hashes: nextHashes });

      const res = await pushAll(enc, report);
      pushed += res.pushed;
      if (res.rejected === 0) break; // someone else wrote newer data in between: pull once more and retry
    }
    useCloud.getState().set({ lastSyncAt: Date.now() });
    if (skipped > 0) throw new SyncError('failed', `Synced, but ${skipped} item(s) could not be decrypted with this key and were skipped.`);
    return { pushed, pulled };
  } catch (e) {
    if (e instanceof SyncError) throw e;
    if (e instanceof ApiError) {
      if (e.status === 401) throw new SyncError('auth', 'Your session expired. Sign in to your cloud account again.');
      if (e.code === 'network') throw new SyncError('offline', e.message);
      throw new SyncError('failed', e.message);
    }
    throw new SyncError('failed', e instanceof Error ? e.message : 'Sync failed.');
  } finally {
    releaseVault();
  }
}

export const cloudAdapter: SyncAdapter = {
  name: 'Encrypted cloud',
  requiresNetwork: true,
  push: async () => undefined,
  sync: cloudSync,
};
