import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { useData } from '@/store/data';
import { useSettings } from '@/store/settings';
import { useT } from '@/i18n';
import { createBackup, formatBytes } from '@/services/backup';
import { Brutal, Button, Icon, ProgressBar, Screen, SettingGroup, SettingRow, Switch, T } from '@/components/ui';

export default function BackupCreate() {
  const t = useT();
  const { c } = useTheme();
  const s = useSettings();
  const notes = useData((d) => d.notes);
  const tasks = useData((d) => d.tasks);
  const reminders = useData((d) => d.reminders);
  const [media, setMedia] = useState(s.backupIncludeMedia);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ f: 0, label: '' });

  const attachments = notes.reduce((n, x) => n + x.attachments.length, 0);

  const run = async () => {
    setRunning(true);
    try {
      const info = await createBackup({ includeMedia: media, onProgress: (f, label) => setProgress({ f, label }) });
      const detail = encodeURIComponent(t('Saved {size} on this device.', { size: formatBytes(info.size) }));
      router.replace(`/status/backup-success?detail=${detail}&uri=${encodeURIComponent(info.uri)}`);
    } catch (e) {
      router.replace(`/status/backup-failed?detail=${encodeURIComponent(e instanceof Error ? e.message : '')}`);
    }
  };

  return (
    <Screen
      header={{ title: t('Create backup'), back: !running }}
      footer={running ? undefined : <Button label={t('Start backup')} icon="cloud-upload-outline" onPress={() => void run()} />}
    >
      {running ? (
        <View style={{ paddingTop: 60, alignItems: 'center', gap: 22 }}>
          <Icon name="cloud-upload" size={90} color={c.ink} />
          <T variant="h1" center>
            {t('Backing up…')}
          </T>
          <View style={{ alignSelf: 'stretch' }}>
            <ProgressBar value={progress.f} height={22} />
          </View>
          <T variant="body" muted center>
            {progress.label || t('Preparing…')}
          </T>
        </View>
      ) : (
        <>
          <Brutal bg={c.surface} depth={4} radius={20} contentStyle={{ padding: 16, gap: 10 }}>
            <T variant="label" muted>
              {t('This backup will contain')}
            </T>
            {[
              ['note-text-outline', t('{n} notes', { n: notes.filter((n) => n.deletedAt === null).length })],
              ['checkbox-marked-circle-outline', t('{n} tasks', { n: tasks.length })],
              ['bell-outline', t('{n} reminders', { n: reminders.length })],
              ['image-multiple-outline', t('{n} attachments', { n: media ? attachments : 0 })],
            ].map(([icon, label]) => (
              <View key={label} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Icon name={icon} size={22} color={c.ink} />
                <T variant="bodyBold">{label}</T>
              </View>
            ))}
          </Brutal>
          <View style={{ height: 18 }} />
          <SettingGroup>
            <SettingRow icon="image-multiple-outline" title={t('Include photos & voice notes')} subtitle={t('Makes the file larger')} right={<Switch value={media} onChange={setMedia} />} last />
          </SettingGroup>
          <T variant="small" muted style={{ marginTop: 16 }}>
            {t('The backup is saved on this device. When it’s done you can save a copy to Drive, iCloud or email it to yourself.')}
          </T>
        </>
      )}
    </Screen>
  );
}
