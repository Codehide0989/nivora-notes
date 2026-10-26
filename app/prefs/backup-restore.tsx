import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/theme';
import { useT } from '@/i18n';
import { BackupInfo, formatBytes, listBackups, pickBackupFile, readBackup, restoreSnapshot, summarize } from '@/services/backup';
import { formatDateTime } from '@/utils/date';
import { Brutal, Button, Dialog, Icon, ProgressBar, Screen, SectionLabel, Segmented, T } from '@/components/ui';
import type { Snapshot } from '@/types';

type Mode = 'merge' | 'replace';

export default function BackupRestore() {
  const t = useT();
  const { c } = useTheme();
  const [local, setLocal] = useState<BackupInfo[]>([]);
  const [snap, setSnap] = useState<{ snapshot: Snapshot; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('merge');
  const [confirm, setConfirm] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ f: 0, label: '' });

  useFocusEffect(
    useCallback(() => {
      setLocal(listBackups());
    }, []),
  );

  const load = async (uri: string, label: string) => {
    setError(null);
    try {
      setSnap({ snapshot: await readBackup(uri), label });
    } catch (e) {
      setSnap(null);
      setError(e instanceof Error ? e.message : t('This backup could not be read.'));
    }
  };

  const choose = async () => {
    const uri = await pickBackupFile();
    if (uri) await load(uri, t('Chosen file'));
  };

  const run = async () => {
    if (!snap) return;
    setConfirm(false);
    setRunning(true);
    try {
      const res = await restoreSnapshot(snap.snapshot, mode, (f, label) => setProgress({ f, label }));
      router.replace(`/status/restore-success?count=${res.notes}`);
    } catch (e) {
      router.replace(`/status/restore-failed?detail=${encodeURIComponent(e instanceof Error ? e.message : '')}`);
    }
  };

  const sum = snap ? summarize(snap.snapshot) : null;

  return (
    <Screen
      header={{ title: t('Restore backup'), back: !running }}
      footer={
        snap && !running ? (
          <Button label={mode === 'replace' ? t('Replace everything') : t('Restore & merge')} icon="backup-restore" kind={mode === 'replace' ? 'danger' : 'primary'} onPress={() => (mode === 'replace' ? setConfirm(true) : void run())} />
        ) : undefined
      }
    >
      {running ? (
        <View style={{ paddingTop: 60, alignItems: 'center', gap: 22 }}>
          <Icon name="cloud-download" size={90} color={c.ink} />
          <T variant="h1" center>
            {t('Restoring…')}
          </T>
          <View style={{ alignSelf: 'stretch' }}>
            <ProgressBar value={progress.f} height={22} />
          </View>
          <T variant="body" muted center>
            {progress.label}
          </T>
        </View>
      ) : (
        <>
          <Button label={t('Choose a backup file')} icon="folder-open-outline" kind="light" onPress={() => void choose()} />

          {error ? (
            <Brutal bg={c.danger} depth={3} radius={14} style={{ marginTop: 16 }} contentStyle={{ flexDirection: 'row', gap: 10, padding: 12, alignItems: 'center' }}>
              <Icon name="alert-circle-outline" size={22} color="#fff" />
              <T variant="small" color="#fff" style={{ flex: 1 }}>
                {error}
              </T>
            </Brutal>
          ) : null}

          {local.length > 0 && !snap ? (
            <>
              <SectionLabel>{t('Backups on this device')}</SectionLabel>
              <View style={{ gap: 12 }}>
                {local.map((b) => (
                  <Brutal key={b.uri} depth={3} radius={16} onPress={() => void load(b.uri, formatDateTime(b.at))} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
                    <Icon name="archive-outline" size={28} color={c.ink} />
                    <View style={{ flex: 1 }}>
                      <T variant="bodyBold">{formatDateTime(b.at)}</T>
                      <T variant="small" muted>
                        {formatBytes(b.size)}
                        {b.media ? ` · ${t('with media')}` : ''}
                        {b.safety ? ` · ${t('safety copy')}` : ''}
                      </T>
                    </View>
                    <Icon name="chevron-right" size={22} color={c.muted} />
                  </Brutal>
                ))}
              </View>
            </>
          ) : null}

          {snap && sum ? (
            <>
              <SectionLabel>{t('Ready to restore')}</SectionLabel>
              <Brutal bg={c.primary} depth={4} radius={20} contentStyle={{ padding: 16, gap: 8 }}>
                <T variant="h3" color="#111">
                  {t('Backup from {when}', { when: formatDateTime(snap.snapshot.exportedAt) })}
                </T>
                <T variant="body" color="#111">
                  {t('{a} notes · {b} tasks · {c} reminders', { a: sum.notes, b: sum.tasks, c: sum.reminders })}
                </T>
                <T variant="small" color="#111" style={{ opacity: 0.75 }}>
                  {sum.media > 0 ? t('Includes {n} photos and voice notes', { n: sum.media }) : t('No media included')}
                </T>
              </Brutal>
              <SectionLabel>{t('How should we restore it?')}</SectionLabel>
              <Segmented<Mode>
                value={mode}
                onChange={setMode}
                options={[
                  { key: 'merge', label: t('Merge'), icon: 'call-merge' },
                  { key: 'replace', label: t('Replace'), icon: 'swap-horizontal' },
                ]}
              />
              <T variant="small" muted style={{ marginTop: 12 }}>
                {mode === 'merge' ? t('Adds the backup’s notes and keeps the newest version of anything that exists in both.') : t('Removes what’s on this device and uses the backup instead. A safety copy is saved first.')}
              </T>
              <View style={{ marginTop: 16 }}>
                <Button small kind="light" label={t('Choose a different backup')} onPress={() => { setSnap(null); setError(null); }} />
              </View>
            </>
          ) : null}
        </>
      )}

      <Dialog
        visible={confirm}
        icon="swap-horizontal"
        danger
        title={t('Replace everything?')}
        message={t('Everything currently on this device will be replaced by the backup. We’ll save a safety copy first.')}
        confirmLabel={t('Replace')}
        onConfirm={() => void run()}
        onCancel={() => setConfirm(false)}
      />
    </Screen>
  );
}
