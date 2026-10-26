import React, { useState } from 'react';
import { View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { pendingChanges, useData } from '@/store/data';
import { useSettings } from '@/store/settings';
import { toast } from '@/store/ui';
import { useT } from '@/i18n';
import { useNetwork } from '@/hooks/useNetwork';
import { Brutal, Button, Icon, Screen, SectionLabel, SettingGroup, SettingRow, Switch, T } from '@/components/ui';
import { Illustration } from '@/components/ui/EmptyState';

export default function OfflineMode() {
  const t = useT();
  const { c } = useTheme();
  const { online, deviceOnline } = useNetwork();
  const forced = useSettings((s) => s.offlineMode);
  const setSettings = useSettings((s) => s.set);
  useData((d) => d.notes);
  useData((d) => d.tasks);
  const [checking, setChecking] = useState(false);
  const pending = pendingChanges();

  const check = async () => {
    setChecking(true);
    try {
      const s = await NetInfo.refresh();
      if (s.isConnected && s.isInternetReachable !== false) {
        toast.success(t('You’re back online'));
        if (forced) setSettings({ offlineMode: false });
        router.replace('/syncing');
      } else toast.error(t('Still offline'));
    } finally {
      setChecking(false);
    }
  };

  return (
    <Screen header={{ title: t('Offline mode') }} footer={<Button label={online ? t('Sync now') : t('Check connection')} icon={online ? 'cloud-sync-outline' : 'wifi-sync'} loading={checking} onPress={() => (online ? router.replace('/syncing') : void check())} />}>
      <View style={{ alignItems: 'center' }}>
        <Illustration icon={online ? 'wifi' : 'wifi-off'} tone={online ? 'success' : 'default'} />
        <T variant="display" center style={{ marginTop: 6 }}>
          {forced ? t('Offline mode is on') : deviceOnline ? t('You’re online') : t('You’re offline')}
        </T>
        <T variant="body" muted center style={{ marginTop: 8, maxWidth: 320 }}>
          {pending > 0 ? t('{n} changes are saved on this device and will sync when you’re back online.', { n: pending }) : t('Everything is saved on this device. Nothing is waiting to sync.')}
        </T>
      </View>

      <SectionLabel>{t('Works without internet')}</SectionLabel>
      <Brutal depth={3} radius={18} contentStyle={{ padding: 14, gap: 12 }}>
        {[
          ['note-edit-outline', t('Write and edit notes')],
          ['microphone-outline', t('Record voice notes')],
          ['bell-outline', t('Reminders still alert you')],
          ['lock-outline', t('Locked notes stay locked')],
          ['backup-restore', t('Backup and restore')],
        ].map(([icon, label]) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name={icon} size={22} color={c.ink} />
            <T variant="bodyBold" style={{ flex: 1 }}>
              {label}
            </T>
            <Icon name="check-bold" size={20} color={c.success} />
          </View>
        ))}
      </Brutal>

      <SectionLabel>{t('Mode')}</SectionLabel>
      <SettingGroup>
        <SettingRow icon="wifi-off" iconBg={c.orange} title={t('Force offline mode')} subtitle={t('Never sync, even when connected')} right={<Switch value={forced} onChange={(v) => setSettings({ offlineMode: v })} />} last />
      </SettingGroup>
    </Screen>
  );
}
