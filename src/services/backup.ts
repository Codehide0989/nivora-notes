import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { currentSnapshot, DEFAULT_CATEGORIES, useData } from '@/store/data';
import { exportableSettings, useSettings } from '@/store/settings';
import { external } from '@/store/session';
import { base64ToBytes, bytesToBase64 } from '@/utils/base64';
import { stamp } from '@/utils/date';
import { mediaDir } from '@/services/media';
import { rescheduleAll } from '@/services/notifications';
import type { Note, Snapshot } from '@/types';

export const BACKUP_EXT = 'nivora';
const KEEP_AUTOMATIC = 7;

export interface BackupInfo {
  name: string;
  uri: string;
  size: number;
  at: number;
  media: boolean;
  safety: boolean;
}

export function backupsDir(): Directory {
  const d = new Directory(Paths.document, 'backups');
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

function infoFor(f: File): BackupInfo {
  const media = /-m(?:-|\.)/.test(f.name);
  const safety = /-pre(?:-|\.)/.test(f.name);
  return {
    name: f.name,
    uri: f.uri,
    size: f.size ?? 0,
    at: f.modificationTime ?? 0,
    media,
    safety,
  };
}

export function listBackups(): BackupInfo[] {
  try {
    return backupsDir()
      .list()
      .filter((e): e is File => e instanceof File && e.name.endsWith(`.${BACKUP_EXT}`))
      .map(infoFor)
      .sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export type Progress = (fraction: number, step: string) => void;

export async function createBackup(opts: {
  includeMedia: boolean;
  safety?: boolean;
  onProgress?: Progress;
}): Promise<BackupInfo> {
  const report = opts.onProgress ?? (() => {});
  report(0.05, 'Collecting notes');
  const snap: Snapshot = { ...currentSnapshot(), settings: exportableSettings() };

  if (opts.includeMedia) {
    const media: Record<string, string> = {};
    const atts = snap.notes.flatMap((n) => n.attachments);
    for (let i = 0; i < atts.length; i += 1) {
      const a = atts[i];
      report(0.1 + (0.7 * i) / Math.max(1, atts.length), `Packing media ${i + 1}/${atts.length}`);
      try {
        const f = new File(a.uri);
        if (f.exists) media[a.id] = bytesToBase64(await f.bytes());
      } catch {
        /* skip unreadable file */
      }
    }
    snap.media = media;
  }

  report(0.85, 'Writing backup file');
  const name = `nivora-${stamp()}${opts.includeMedia ? '-m' : ''}${opts.safety ? '-pre' : ''}.${BACKUP_EXT}`;
  const file = new File(backupsDir(), name);
  file.create({ overwrite: true });
  file.write(JSON.stringify(snap));

  if (!opts.safety) useSettings.getState().set({ lastBackupAt: Date.now() });
  pruneAutomatic();
  report(1, 'Done');
  return infoFor(file);
}

function pruneAutomatic(): void {
  const regular = listBackups().filter((b) => !b.safety);
  regular.slice(KEEP_AUTOMATIC).forEach((b) => deleteBackup(b.uri));
  const safety = listBackups().filter((b) => b.safety);
  safety.slice(3).forEach((b) => deleteBackup(b.uri));
}

export function deleteBackup(uri: string): void {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    /* ignore */
  }
}

export async function shareBackup(uri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await external(() =>
    Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Save your Nivora backup', UTI: 'public.json' }),
  );
}

export async function pickBackupFile(): Promise<string | null> {
  return external(async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.length) return null;
    return res.assets[0].uri;
  });
}

export function validateSnapshot(x: unknown): Snapshot {
  if (!x || typeof x !== 'object') throw new Error('This file is not a Nivora backup.');
  const s = x as Partial<Snapshot>;
  if (s.app !== 'nivora-notes') throw new Error('This file is not a Nivora backup.');
  if (s.version !== 1) throw new Error('This backup was made by a newer version of the app.');
  if (!Array.isArray(s.notes) || !Array.isArray(s.tasks) || !Array.isArray(s.reminders)) {
    throw new Error('This backup is damaged and cannot be read.');
  }
  return {
    version: 1,
    app: 'nivora-notes',
    exportedAt: typeof s.exportedAt === 'number' ? s.exportedAt : Date.now(),
    notes: s.notes,
    categories: Array.isArray(s.categories) ? s.categories : [],
    tasks: s.tasks,
    reminders: s.reminders,
    shareLog: Array.isArray(s.shareLog) ? s.shareLog : [],
    settings: s.settings,
    media: s.media,
  };
}

export async function readBackup(uri: string): Promise<Snapshot> {
  const text = await new File(uri).text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This backup is damaged and cannot be read.');
  }
  return validateSnapshot(parsed);
}

export function summarize(s: Snapshot): { notes: number; tasks: number; reminders: number; media: number } {
  return {
    notes: s.notes.filter((n) => n.deletedAt === null).length,
    tasks: s.tasks.length,
    reminders: s.reminders.length,
    media: s.media ? Object.keys(s.media).length : 0,
  };
}

function restoreMedia(snap: Snapshot): Note[] {
  const dir = mediaDir();
  return snap.notes.map((n) => ({
    ...n,
    attachments: n.attachments
      .map((a) => {
        const b64 = snap.media?.[a.id];
        const ext = /\.([a-z0-9]{2,5})$/i.exec(a.uri)?.[1] ?? (a.type === 'audio' ? 'm4a' : 'jpg');
        if (b64) {
          try {
            const f = new File(dir, `${a.id}.${ext}`);
            f.create({ overwrite: true });
            f.write(base64ToBytes(b64));
            return { ...a, uri: f.uri };
          } catch {
            return null;
          }
        }
        try {
          return new File(a.uri).exists ? a : null;
        } catch {
          return null;
        }
      })
      .filter((a): a is NonNullable<typeof a> => a !== null),
  }));
}

export async function restoreSnapshot(
  snap: Snapshot,
  mode: 'replace' | 'merge',
  onProgress?: Progress,
): Promise<{ notes: number }> {
  const report = onProgress ?? (() => {});
  report(0.05, 'Saving a safety copy');
  await createBackup({ includeMedia: true, safety: true });
  report(0.3, 'Restoring media');
  const notes = restoreMedia(snap);
  report(0.6, 'Restoring data');
  const data = useData.getState();
  if (mode === 'replace') {
    data.replaceAll({
      notes,
      categories: snap.categories.length ? snap.categories : DEFAULT_CATEGORIES,
      tasks: snap.tasks,
      reminders: snap.reminders.map((r) => ({ ...r, notificationId: null })),
      shareLog: snap.shareLog,
    });
    const st = snap.settings as Record<string, unknown> | undefined;
    if (st) {
      const patch: Record<string, unknown> = {};
      (['theme', 'accent', 'fontScale', 'noteView', 'sortBy', 'language', 'haptics'] as const).forEach((k) => {
        if (st[k] !== undefined) patch[k] = st[k];
      });
      useSettings.getState().set(patch);
    }
  } else {
    const mergeBy = <T extends { id: string }>(a: T[], b: T[], newer: (x: T, y: T) => boolean): T[] => {
      const map = new Map<string, T>(a.map((x) => [x.id, x]));
      b.forEach((y) => {
        const x = map.get(y.id);
        if (!x || newer(y, x)) map.set(y.id, y);
      });
      return Array.from(map.values());
    };
    data.replaceAll({
      notes: mergeBy(data.notes, notes, (y, x) => y.updatedAt > x.updatedAt),
      categories: mergeBy(data.categories, snap.categories, () => false),
      tasks: mergeBy(data.tasks, snap.tasks, (y, x) => y.updatedAt > x.updatedAt),
      reminders: mergeBy(data.reminders, snap.reminders, () => false).map((r) => ({ ...r, notificationId: null })),
      shareLog: mergeBy(data.shareLog, snap.shareLog, () => false),
    });
  }
  report(0.85, 'Rescheduling reminders');
  await rescheduleAll();
  report(1, 'Done');
  return { notes: notes.length };
}
