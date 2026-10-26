import { create } from 'zustand';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';
import { authenticateBiometric, biometricInfo } from '@/services/security';
import { tNow as t } from '@/i18n';

interface GateState {
  open: boolean;
  reason: string;
  resolve: ((ok: boolean) => void) | null;
}

export const useGate = create<GateState>(() => ({ open: false, reason: '', resolve: null }));

const unlocked = new Set<string>();
export const isNoteUnlocked = (id: string) => unlocked.has(id);
export const markNoteUnlocked = (id: string) => {
  unlocked.add(id);
};

// Locking the whole app also re-locks every note that was opened during the session.
useSession.subscribe((s, prev) => {
  if (s.locked && !prev.locked) unlocked.clear();
});

/**
 * Ask the user to prove it's them (biometrics first when enabled, otherwise the PIN pad).
 * Resolves true when no PIN has been configured, so callers never dead-end.
 */
export async function requestUnlock(reason?: string): Promise<boolean> {
  if (!useSession.getState().pinSet) return true;
  const why = reason ?? t('Unlock to continue');
  if (useSettings.getState().biometricsEnabled) {
    const info = await biometricInfo();
    if (info.available && info.enrolled && (await authenticateBiometric(why))) return true;
  }
  return new Promise<boolean>((resolve) => {
    useGate.setState({ open: true, reason: why, resolve });
  });
}

export function resolveGate(ok: boolean): void {
  const { resolve } = useGate.getState();
  useGate.setState({ open: false, resolve: null });
  resolve?.(ok);
}
