import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/theme';
import { useData } from '@/store/data';
import { useSettings } from '@/store/settings';
import { toast } from '@/store/ui';
import { useT } from '@/i18n';
import { BackupInfo, deleteBackup, formatBytes, listBackups, shareBackup } from '@/services/backup';
import { formatDateTime, relativeTime } from '@/utils/date';
import { Brutal, Button, Dialog, Icon, IconButton, Screen, SectionLabel, SettingGroup, SettingRow, Switch, T } from '@/components/ui';

export default function BackupHome() {
  const t = useT();
  const { c } = useTheme();
  const s = useSettings();
  const notes = useData((d) => d.notes);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [removing, setRemoving] = useState<BackupInfo | null>(null);

  useFocusEffect(
    useCallback(() => {
      setBackups(listBackups());
    }, []),
  );

  const count = notes.filter((n) => n.deletedAt === null).length;

  return (
    <Screen header={{ title: t('Backup & restore') }}>
      <Brutal bg={c.primary} depth={5} radius={22} contentStyle={{ padding: 18, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Icon name="backup-restore" size={46} color="#111" />
          <View style={{ flex: 1 }}>
            <T variant="h2" color="#111">
              {s.lastBackupAt ? t('Last backup {when}', { when: relativeTime(s.lastBackupAt) }) : t('No backup yet')}
            </T>
            <T variant="small" color="#111" style={{ opacity: 0.75 }}>
              {s.lastBackupAt ? formatDateTime(s.lastBackupAt) : t('{n} notes are only on this device', { n: count })}
            </T>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button small kind="dark" style={{ flex: 1 }} label={t('Back up now')} icon="cloud-upload-outline" onPress={() => router.push('/prefs/backup-create')} />
          <Button small kind="light" style={{ flex: 1 }} label={t('Restore')} icon="cloud-download-outline" onPress={() => router.push('/prefs/backup-restore')} />
        </View>
      </Brutal>

      <SectionLabel>{t('Automatic backup')}</SectionLabel>
      <SettingGroup>
        <SettingRow icon="calendar-sync-outline" title={t('Daily backup')} subtitle={t('Saved on this device when you leave the app')} right={<Switch value={s.autoBackup} onChange={(v) => s.set({ autoBackup: v })} />} />
        <SettingRow icon="image-multiple-outline" iconBg={c.orange} title={t('Include photos & voice notes')} right={<Switch value={s.backupIncludeMedia} onChange={(v) => s.set({ backupIncludeMedia: v })} />} last />
      </SettingGroup>

      <SectionLabel>{t('Saved backups')}</SectionLabel>
      {backups.length === 0 ? (
        <T variant="small" muted>
          {t('Backups you create will be listed here. Use Save a copy to keep one in Drive, iCloud or email.')}
        </T>
      ) : (
        <View style={{ gap: 12 }}>
          {backups.map((b) => (
            <Brutal key={b.uri} depth={3} radius={16} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
              <Icon name={b.safety ? 'shield-refresh-outline' : 'archive-outline'} size={28} color={c.ink} />
              <View style={{ flex: 1 }}>
                <T variant="bodyBold" numberOfLines={1}>
                  {b.safety ? t('Safety copy') : t('Backup')} · {formatBytes(b.size)}
                </T>
                <T variant="small" muted numberOfLines={1}>
                  {formatDateTime(b.at)}
                  {b.media ? ` · ${t('with media')}` : ''}
                </T>
              </View>
              <IconButton icon="share-variant-outline" label={t('Save a copy')} size={38} depth={2} onPress={() => void shareBackup(b.uri).catch((e: Error) => toast.error(e.message))} />
              <IconButton icon="delete-outline" label={t('Delete')} size={38} depth={2} onPress={() => setRemoving(b)} />
            </Brutal>
          ))}
        </View>
      )}

      <Dialog
        visible={!!removing}
        icon="delete-outline"
        danger
        title={t('Delete this backup?')}
        message={t('The backup file will be removed from this device.')}
        confirmLabel={t('Delete')}
        onConfirm={() => {
          if (removing) deleteBackup(removing.uri);
          setRemoving(null);
          setBackups(listBackups());
        }}
        onCancel={() => setRemoving(null)}
      />
    </Screen>
  );
}
