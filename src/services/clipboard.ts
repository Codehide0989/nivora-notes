import * as Clipboard from 'expo-clipboard';
import { CLIPBOARD_CLEAR_SECONDS } from '@/config';
import { useSession } from '@/store/session';
import { toast } from '@/store/ui';
import { tNow as t } from '@/i18n';
import { haptic } from '@/services/haptics';

let pending: { text: string; timer: ReturnType<typeof setTimeout> } | null = null;

async function wipeIfUnchanged(): Promise<void> {
  if (!pending) return;
  const { text, timer } = pending;
  clearTimeout(timer);
  pending = null;
  try {
    if ((await Clipboard.getStringAsync()) === text) await Clipboard.setStringAsync('');
  } catch {
    /* clipboard not readable (background): nothing more we can do */
  }
}

/** Copy something sensitive and wipe it from the clipboard after a short delay, or when the app locks. */
export async function copySecret(text: string, label: string): Promise<void> {
  if (!text) return;
  await wipeIfUnchanged();
  await Clipboard.setStringAsync(text);
  haptic('success');
  toast.success(t('{what} copied · clears in {s}s', { what: label, s: CLIPBOARD_CLEAR_SECONDS }));
  pending = { text, timer: setTimeout(() => void wipeIfUnchanged(), CLIPBOARD_CLEAR_SECONDS * 1000) };
}

export async function copyPlain(text: string, label: string): Promise<void> {
  if (!text) return;
  await Clipboard.setStringAsync(text);
  haptic('light');
  toast.success(t('{what} copied', { what: label }));
}

useSession.subscribe((s, prev) => {
  if (s.locked && !prev.locked) void wipeIfUnchanged();
});
