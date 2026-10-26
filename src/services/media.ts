import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { uid } from '@/utils/id';
import { external } from '@/store/session';
import { useData } from '@/store/data';
import type { Attachment } from '@/types';

export function mediaDir(): Directory {
  const d = new Directory(Paths.document, 'media');
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

export function importFile(srcUri: string, ext: string): { id: string; uri: string } {
  const id = uid();
  const dest = new File(mediaDir(), `${id}.${ext}`);
  new File(srcUri).copy(dest);
  return { id, uri: dest.uri };
}

export function removeUris(uris: string[]): void {
  uris.forEach((u) => {
    try {
      const f = new File(u);
      if (f.exists) f.delete();
    } catch {
      /* already gone */
    }
  });
}

function extOf(uri: string, fallback: string): string {
  const m = /\.([a-zA-Z0-9]{2,5})(?:\?|$)/.exec(uri);
  return m ? m[1].toLowerCase() : fallback;
}

export type PickResult = { ok: true; items: Attachment[] } | { ok: false; reason: 'denied' | 'cancelled' | 'error' };

function toAttachments(assets: ImagePicker.ImagePickerAsset[]): Attachment[] {
  return assets.map((a) => {
    const saved = importFile(a.uri, extOf(a.fileName ?? a.uri, 'jpg'));
    return { id: saved.id, type: 'image', uri: saved.uri, name: a.fileName ?? undefined };
  });
}

export async function pickImages(): Promise<PickResult> {
  return external(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return { ok: false, reason: 'denied' } as const;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 8,
        quality: 0.8,
      });
      if (res.canceled) return { ok: false, reason: 'cancelled' } as const;
      return { ok: true, items: toAttachments(res.assets) } as const;
    } catch {
      return { ok: false, reason: 'error' } as const;
    }
  });
}

export async function takePhoto(): Promise<PickResult> {
  return external(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return { ok: false, reason: 'denied' } as const;
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (res.canceled) return { ok: false, reason: 'cancelled' } as const;
      return { ok: true, items: toAttachments(res.assets) } as const;
    } catch {
      return { ok: false, reason: 'error' } as const;
    }
  });
}

/** Delete files only when no remaining note still references them (duplicated notes share files). */
export function removeUnreferenced(uris: string[]): void {
  const inUse = new Set(useData.getState().notes.flatMap((n) => n.attachments.map((a) => a.uri)));
  removeUris(uris.filter((u) => !inUse.has(u)));
}
