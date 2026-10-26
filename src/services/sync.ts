import NetInfo from '@react-native-community/netinfo';
import { Directory, File, Paths } from 'expo-file-system';
import { currentSnapshot, pendingChanges, useData } from '@/store/data';
import { useSettings } from '@/store/settings';
import { useCloud } from '@/store/cloud';
import { cloudAdapter } from '@/services/cloud';
import { SyncError } from '@/services/syncTypes';
import type { SyncAdapter, SyncStep } from '@/services/syncTypes';

export * from '@/services/syncTypes';

/**
 * Sync is local-first: every change is stored on the device immediately and flagged `dirty`
 * until a sync pushes it. The default adapter keeps a snapshot in an app-private "vault" folder.
 * Signing in to the encrypted cloud (services/cloud.ts, backed by the Neon server in /server) switches the target.
 * To use a different backend instead, implement SyncAdapter and call `setSyncAdapter(myAdapter)` once at startup.
 */
const vaultAdapter: SyncAdapter = {
  name: 'This device',
  requiresNetwork: false,
  push: async (snapshot) => {
    const dir = new Directory(Paths.document, 'vault');
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const file = new File(dir, 'snapshot.json');
    file.create({ overwrite: true });
    file.write(JSON.stringify(snapshot));
  },
};

let adapter: SyncAdapter = vaultAdapter;
export const setSyncAdapter = (a: SyncAdapter) => {
  adapter = a;
};
/** The active target: the encrypted cloud when signed in, otherwise the on-device snapshot. */
export const getSyncAdapter = (): SyncAdapter => (useCloud.getState().signedIn ? cloudAdapter : adapter);

export async function isOnline(): Promise<boolean> {
  try {
    const s = await NetInfo.fetch();
    return !!s.isConnected && s.isInternetReachable !== false;
  } catch {
    return true;
  }
}

let running = false;
export const isSyncing = () => running;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function runSync(onStep?: (s: SyncStep) => void): Promise<{ pushed: number }> {
  const target = getSyncAdapter();
  if (running) throw new SyncError('failed', 'A sync is already running.');
  const report = onStep ?? (() => {});
  const { offlineMode } = useSettings.getState();
  if (offlineMode) throw new SyncError('offline', 'Offline mode is on.');
  if (target.requiresNetwork && !(await isOnline())) throw new SyncError('offline', 'No internet connection.');
  running = true;
  try {
    if (target.sync) {
      const res = await target.sync(report);
      useData.getState().markSynced(Date.now());
      report({ fraction: 1, label: 'All set' });
      return { pushed: res.pushed + res.pulled };
    }
    const pushed = pendingChanges();
    report({ fraction: 0.1, label: 'Preparing changes' });
    const snapshot = currentSnapshot();
    await wait(250);
    report({ fraction: 0.4, label: `Syncing ${snapshot.notes.length} notes` });
    await wait(250);
    report({ fraction: 0.65, label: `Syncing ${snapshot.tasks.length} tasks` });
    await target.push(snapshot);
    report({ fraction: 0.9, label: 'Finishing up' });
    useData.getState().markSynced(Date.now());
    await wait(200);
    report({ fraction: 1, label: 'All set' });
    return { pushed };
  } catch (e) {
    if (e instanceof SyncError) throw e;
    throw new SyncError('failed', e instanceof Error ? e.message : 'Sync failed.');
  } finally {
    running = false;
  }
}
