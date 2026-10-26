import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { useData, pendingChanges } from '@/store/data';
import { useSettings } from '@/store/settings';
import { useCloud } from '@/store/cloud';
import { cloudPendingCount } from '@/services/cloud';
import { useT } from '@/i18n';
import { getSyncAdapter } from '@/services/sync';
import { useNetwork } from '@/hooks/useNetwork';
import { formatDateTime, relativeTime } from '@/utils/date';
import { Brutal, Button, Icon, Screen, SectionLabel, SettingGroup, SettingRow, Switch, T } from '@/components/ui';

export default function SyncSettings() {
  const t = useT();
  const { c } = useTheme();
  const s = useSettings();
  const lastSyncAt = useData((d) => d.lastSyncAt);
  useData((d) => d.reminders);
  useData((d) => d.categories);
  useData((d) => d.notes);
  useData((d) => d.tasks);
  const { online, deviceOnline } = useNetwork();
  const cloud = useCloud();
  const pending = cloud.signedIn ? cloudPendingCount() : pendingChanges();
  const adapter = getSyncAdapter();

  const syncNow = () => {
    if (s.offlineMode || (adapter.requiresNetwork && !deviceOnline)) router.push('/prefs/offline');
    else router.push('/syncing');
  };

  return (
    <Screen header={{ title: t('Sync & offline') }} footer={<Button label={t('Sync now')} icon="cloud-sync-outline" onPress={syncNow} />}>
      <Brutal bg={online ? c.primary : c.orange} depth={5} radius={22} contentStyle={{ padding: 18, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Icon name={online ? 'cloud-check-outline' : 'wifi-off'} size={46} color="#111" />
          <View style={{ flex: 1 }}>
            <T variant="h2" color="#111">
              {s.offlineMode ? t('Offline mode is on') : deviceOnline ? t('You’re online') : t('You’re offline')}
            </T>
            <T variant="small" color="#111" style={{ opacity: 0.8 }}>
              {lastSyncAt ? t('Last synced {when}', { when: relativeTime(lastSyncAt) }) : t('Never synced')}
            </T>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, backgroundColor: '#111', borderRadius: 12, padding: 10 }}>
            <T variant="h2" fixed color="#FFD400">
              {pending}
            </T>
            <T variant="label" fixed color="#FFF8E1" style={{ fontSize: 10 }}>
              {t('Waiting to sync')}
            </T>
          </View>
          <View style={{ flex: 1, backgroundColor: '#111', borderRadius: 12, padding: 10 }}>
            <T variant="label" fixed color="#FFD400" numberOfLines={1}>
              {adapter.name}
            </T>
            <T variant="label" fixed color="#FFF8E1" style={{ fontSize: 10, marginTop: 4 }}>
              {t('Sync target')}
            </T>
          </View>
        </View>
      </Brutal>

      <SectionLabel>{t('Cloud')}</SectionLabel>
      <SettingGroup>
        <SettingRow
          icon="cloud-lock-outline"
          title={t('Cloud account')}
          subtitle={cloud.signedIn ? t('End-to-end encrypted') : t('Sync your notes and passwords between devices')}
          value={cloud.signedIn ? cloud.email : t('Off')}
          onPress={() => router.push('/prefs/account')}
          last
        />
      </SettingGroup>

      <SectionLabel>{t('Options')}</SectionLabel>
      <SettingGroup>
        <SettingRow icon="sync" title={t('Auto sync')} subtitle={t('Sync changes when you leave the app')} right={<Switch value={s.autoSync} onChange={(v) => s.set({ autoSync: v })} />} />
        <SettingRow icon="wifi-off" iconBg={c.orange} title={t('Offline mode')} subtitle={t('Pause syncing and work only on this device')} right={<Switch value={s.offlineMode} onChange={(v) => s.set({ offlineMode: v })} />} />
        <SettingRow icon="information-outline" title={t('How offline works')} onPress={() => router.push('/prefs/offline')} last />
      </SettingGroup>

      <T variant="small" muted style={{ marginTop: 18 }}>
        {adapter.requiresNetwork
          ? t('Changes sync to your connected service whenever you’re online.')
          : t('Nivora is local-first: every change is saved instantly on this device and a verified snapshot is kept in the app vault. Developers can plug in their own server with a SyncAdapter.')}
      </T>
      {lastSyncAt ? (
        <T variant="small" muted style={{ marginTop: 8 }}>
          {formatDateTime(lastSyncAt)}
        </T>
      ) : null}
    </Screen>
  );
}
