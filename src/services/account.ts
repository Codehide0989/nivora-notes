import { Directory, Paths } from 'expo-file-system';
import { useData } from '@/store/data';
import { useSettings } from '@/store/settings';
import { removePin } from '@/services/security';
import { cancelAllReminders } from '@/services/notifications';
import { useCloud } from '@/store/cloud';
import { wipeVault } from '@/store/vault';
import { cloudSignOut } from '@/services/cloud';

function wipeDir(name: string): void {
  try {
    const d = new Directory(Paths.document, name);
    if (d.exists) d.delete();
  } catch {
    /* ignore */
  }
}

/** Remove every note, task, reminder, attachment, backup, vault entry, cloud key and the PIN from this device. */
export async function wipeEverything(): Promise<void> {
  await cancelAllReminders();
  try {
    await removePin();
  } catch {
    /* no pin */
  }
  wipeDir('media');
  wipeDir('backups');
  wipeDir('vault');
  await cloudSignOut(); // revoke the session (best effort) and delete keys + tokens from the keystore
  useCloud.getState().set({ serverUrl: '' });
  await wipeVault();
  useData.getState().resetAll();
  useSettings.getState().reset();
}

/** Sign out: forget the profile and return to onboarding, optionally clearing notes from the device. */
export async function signOut(clearData: boolean): Promise<void> {
  if (clearData) {
    await wipeEverything();
    return;
  }
  await cloudSignOut(); // notes and vault entries stay on the phone; the cloud keys do not
  useSettings.getState().set({ onboarded: false, signedIn: false, profileName: '', profileEmail: '' });
}
