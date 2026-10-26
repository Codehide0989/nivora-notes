import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { VAULT_UNLOCK_SECONDS } from '@/config';
import { useSession } from '@/store/session';
import { requestUnlock } from '@/services/gate';
import { tNow as t } from '@/i18n';

/**
 * The Vault needs its own PIN / biometric check every time it is opened (not just when the app is opened).
 * Once passed it stays open for a short window, and closes immediately when the app locks.
 */
const useAccess = create<{ until: number }>(() => ({ until: 0 }));

export async function unlockVault(): Promise<boolean> {
  if (!useSession.getState().pinSet) return false;
  const ok = await requestUnlock(t('Unlock your vault'));
  if (ok) useAccess.setState({ until: Date.now() + VAULT_UNLOCK_SECONDS * 1000 });
  return ok;
}

export const lockVaultNow = () => useAccess.setState({ until: 0 });
/** Call on user activity to keep the window open while they are working in the vault. */
export const touchVault = () => {
  if (useAccess.getState().until > Date.now()) useAccess.setState({ until: Date.now() + VAULT_UNLOCK_SECONDS * 1000 });
};

useSession.subscribe((s, prev) => {
  if (s.locked && !prev.locked) lockVaultNow();
});

export function useVaultAccess(): { unlocked: boolean; pinSet: boolean } {
  const until = useAccess((s) => s.until);
  const pinSet = useSession((s) => s.pinSet);
  const [, tick] = useState(0);
  useEffect(() => {
    const ms = until - Date.now();
    if (ms <= 0) return undefined;
    const id = setTimeout(() => tick((n) => n + 1), ms + 50);
    return () => clearTimeout(id);
  }, [until]);
  return { unlocked: pinSet && until > Date.now(), pinSet };
}
