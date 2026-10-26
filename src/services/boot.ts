import { AppState } from 'react-native';
import { pendingChanges, useData } from '@/store/data';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';
import { useCloud } from '@/store/cloud';
import { hasPin } from '@/services/security';
import { removeUnreferenced } from '@/services/media';
import { configureNotifications } from '@/services/notifications';
import { createBackup } from '@/services/backup';
import { isSyncing, runSync } from '@/services/sync';

let booted = false;

export async function bootApp(): Promise<void> {
  if (booted) return;
  booted = true;
  const pin = await hasPin();
  useSession.getState().setPinSet(pin);
  if (pin) useSession.getState().lock();

  const days = useSettings.getState().trashRetentionDays;
  const gone = useData.getState().purgeExpired(days);
  gone.forEach((n) => removeUnreferenced(n.attachments.map((a) => a.uri)));

  try {
    await configureNotifications();
  } catch {
    /* notifications unavailable (e.g. web) */
  }
  useSession.getState().setReady(true);
  setTimeout(() => void autoSync(60_000), 1500);
}

/** Background-friendly sync that never throws and skips when a sync ran recently. */
export async function autoSync(minGapMs: number): Promise<void> {
  const s = useSettings.getState();
  const cloud = useCloud.getState();
  if (!s.autoSync || s.offlineMode || isSyncing()) return;
  if (cloud.signedIn) {
    if (cloud.lastSyncAt && Date.now() - cloud.lastSyncAt < minGapMs) return;
  } else if (pendingChanges() === 0) return;
  try {
    await runSync();
  } catch {
    /* best effort: the Sync screen shows errors when the user syncs manually */
  }
}

/** Called when the app moves to the background. */
export async function onBackground(): Promise<void> {
  const s = useSettings.getState();
  try {
    if (s.autoBackup) {
      const last = s.lastBackupAt ?? 0;
      if (Date.now() - last > 24 * 3600 * 1000) {
        await createBackup({ includeMedia: s.backupIncludeMedia });
      }
    }
    await autoSync(5_000);
  } catch {
    /* background work is best-effort */
  }
}

export function watchAppState(): () => void {
  let lastBg = 0;
  const sub = AppState.addEventListener('change', (state) => {
    const session = useSession.getState();
    if (state === 'background') {
      lastBg = Date.now();
      void onBackground();
      return;
    }
    if (state === 'active' && lastBg > 0) {
      const elapsed = (Date.now() - lastBg) / 1000;
      lastBg = 0;
      const timeout = useSettings.getState().lockTimeout;
      if (session.pinSet && session.suppressLock === 0 && elapsed >= timeout) session.lock();
      if (elapsed > 120) void autoSync(120_000); // pick up changes made on other devices
    }
  });
  return () => sub.remove();
}
