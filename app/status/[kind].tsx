import React, { useEffect } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useData } from '@/store/data';
import { useT } from '@/i18n';
import { haptic } from '@/services/haptics';
import { shareBackup } from '@/services/backup';
import { toast } from '@/store/ui';
import { EmptyState, Screen } from '@/components/ui';

type Tone = 'default' | 'danger' | 'success';
interface Cfg {
  icon: string;
  tone: Tone;
  title: string;
  message: string;
  primary?: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
  autoMs?: number;
}

const home = () => router.replace('/(tabs)');

export default function Status() {
  const { kind, noteId, id, format, detail, count, uri } = useLocalSearchParams<{
    kind: string;
    noteId?: string;
    id?: string;
    format?: string;
    detail?: string;
    count?: string;
    uri?: string;
  }>();
  const t = useT();
  const nid = noteId ?? id;
  const exists = useData((s) => (nid ? s.notes.some((n) => n.id === nid && n.deletedAt === null) : false));

  const cfgs: Record<string, Cfg> = {
    'note-saved': {
      icon: 'check-bold',
      tone: 'success',
      title: t('Note saved successfully!'),
      message: t('Your note is safely stored on this device.'),
      primary: { label: t('Back to notes'), onPress: home },
      secondary: nid && exists ? { label: t('View note'), onPress: () => router.replace(`/note/${nid}`) } : undefined,
      autoMs: 2200,
    },
    'note-deleted': {
      icon: 'delete-outline',
      tone: 'default',
      title: t('Note moved to Trash'),
      message: t('You can restore it from Trash any time before it’s removed for good.'),
      primary: { label: t('Undo'), onPress: () => { if (nid) useData.getState().restoreNote(nid); toast.success(t('Note restored')); home(); } },
      secondary: { label: t('Back to notes'), onPress: home },
    },
    'note-restored': {
      icon: 'restore',
      tone: 'success',
      title: t('Note restored successfully!'),
      message: t('It’s back in your notes.'),
      primary: { label: t('Back to Trash'), onPress: () => router.back() },
      secondary: { label: t('Open notes'), onPress: home },
      autoMs: 2500,
    },
    'note-purged': {
      icon: 'delete-forever-outline',
      tone: 'default',
      title: t('Note deleted forever'),
      message: t('It has been permanently removed from this device.'),
      primary: { label: t('Back to Trash'), onPress: () => router.back() },
      autoMs: 2000,
    },
    shared: {
      icon: 'share-variant',
      tone: 'success',
      title: t('Note shared!'),
      message: t('Your note was sent. Nothing was uploaded to our servers.'),
      primary: { label: t('Done'), onPress: () => (nid ? router.replace(`/note/${nid}`) : home()) },
      secondary: { label: t('Back to notes'), onPress: home },
    },
    exported: {
      icon: 'file-export-outline',
      tone: 'success',
      title: t('Export complete!'),
      message: t('Your {fmt} file is ready.', { fmt: (format ?? 'file').toUpperCase() }),
      primary: { label: t('Done'), onPress: () => (nid ? router.replace(`/note/${nid}`) : home()) },
      secondary: nid ? { label: t('Export again'), onPress: () => router.replace(`/export/${nid}`) } : undefined,
    },
    'backup-success': {
      icon: 'cloud-check-outline',
      tone: 'success',
      title: t('Backup successful!'),
      message: detail ?? t('Your notes are backed up on this device.'),
      primary: uri
        ? { label: t('Save a copy elsewhere'), onPress: () => void shareBackup(String(uri)).catch(() => toast.error(t('Sharing is not available on this device.'))) }
        : { label: t('Done'), onPress: () => router.replace('/prefs/backup') },
      secondary: uri ? { label: t('Done'), onPress: () => router.replace('/prefs/backup') } : undefined,
    },
    'backup-failed': {
      icon: 'cloud-alert',
      tone: 'danger',
      title: t('Backup failed'),
      message: detail ?? t('Something went wrong while creating your backup. Check your free storage and try again.'),
      primary: { label: t('Try again'), onPress: () => router.replace('/prefs/backup-create') },
      secondary: { label: t('Back'), onPress: () => router.replace('/prefs/backup') },
    },
    'restore-success': {
      icon: 'backup-restore',
      tone: 'success',
      title: t('Backup restored successfully!'),
      message: t('{n} notes are back, along with your tasks and reminders.', { n: count ?? 0 }),
      primary: { label: t('Open my notes'), onPress: home },
    },
    'restore-failed': {
      icon: 'file-alert-outline',
      tone: 'danger',
      title: t('Restore failed'),
      message: detail ?? t('This file couldn’t be restored. Nothing was changed.'),
      primary: { label: t('Choose another file'), onPress: () => router.replace('/prefs/backup-restore') },
      secondary: { label: t('Back'), onPress: () => router.replace('/prefs/backup') },
    },
    'sync-complete': {
      icon: 'cloud-check',
      tone: 'success',
      title: t('Sync complete!'),
      message: count && Number(count) > 0 ? t('{n} changes were synced.', { n: count }) : t('Everything is already up to date.'),
      primary: { label: t('Done'), onPress: () => router.replace('/prefs/sync') },
      autoMs: 2400,
    },
    'sync-failed': {
      icon: 'wifi-off',
      tone: 'danger',
      title: t('Network error'),
      message: detail ?? t('We couldn’t reach the network. Your changes are safe on this device and will sync when you’re back online.'),
      primary: { label: t('Try again'), onPress: () => router.replace('/syncing') },
      secondary: { label: t('Stay offline'), onPress: () => router.replace('/prefs/sync') },
    },
    'account-deleted': {
      icon: 'account-off-outline',
      tone: 'default',
      title: t('Account deleted'),
      message: t('All data was erased from this device. Thanks for trying Nivora Notes.'),
      primary: { label: t('Start fresh'), onPress: () => router.replace('/onboarding') },
    },
  };

  const cfg = cfgs[kind] ?? cfgs['note-saved'];

  useEffect(() => {
    haptic(cfg.tone === 'danger' ? 'error' : 'success');
    if (!cfg.autoMs) return;
    const h = setTimeout(() => cfg.primary?.onPress(), cfg.autoMs);
    return () => clearTimeout(h);
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Screen scroll={false} contentStyle={{ justifyContent: 'center' }}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState
          icon={cfg.icon}
          tone={cfg.tone}
          title={cfg.title}
          message={cfg.message}
          actionLabel={cfg.primary?.label}
          onAction={cfg.primary?.onPress}
          secondaryLabel={cfg.secondary?.label}
          onSecondary={cfg.secondary?.onPress}
        />
      </View>
    </Screen>
  );
}
