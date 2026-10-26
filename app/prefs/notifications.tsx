import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, View } from 'react-native';
import { useTheme } from '@/theme';
import { useSettings } from '@/store/settings';
import { toast } from '@/store/ui';
import { useT } from '@/i18n';
import { cancelAllReminders, cancelDailySummary, ensurePermission, permissionStatus, rescheduleAll, scheduleDailySummary, sendTestNotification } from '@/services/notifications';
import { Brutal, Button, Icon, Screen, SectionLabel, SettingGroup, SettingRow, Switch, T } from '@/components/ui';
import { DateTimeSheet } from '@/components/app/DateTimeSheet';

export default function NotificationSettings() {
  const t = useT();
  const { c } = useTheme();
  const s = useSettings();
  const [perm, setPerm] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [timeOpen, setTimeOpen] = useState(false);

  const refresh = useCallback(() => {
    permissionStatus().then(setPerm).catch(() => undefined);
  }, []);
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const toggleAll = async (on: boolean) => {
    if (on) {
      const ok = await ensurePermission();
      refresh();
      if (!ok) return toast.error(t('Allow notifications in your device settings first.'));
      s.set({ notificationsEnabled: true });
      await rescheduleAll();
      if (useSettings.getState().dailySummary) await scheduleDailySummary(s.dailySummaryHour, s.dailySummaryMinute);
    } else {
      s.set({ notificationsEnabled: false });
      await cancelAllReminders();
      s.set({ dailySummaryId: null });
    }
  };

  const toggleSummary = async (on: boolean) => {
    if (on) {
      const id = await scheduleDailySummary(s.dailySummaryHour, s.dailySummaryMinute);
      if (!id) return toast.error(t('Allow notifications in your device settings first.'));
      s.set({ dailySummary: true });
    } else {
      await cancelDailySummary();
      s.set({ dailySummary: false });
    }
  };

  const summaryTime = new Date();
  summaryTime.setHours(s.dailySummaryHour, s.dailySummaryMinute, 0, 0);

  const test = async () => {
    if (!(await ensurePermission())) return toast.error(t('Allow notifications in your device settings first.'));
    const ok = await sendTestNotification('Nivora Notes', t('This is how your reminders will look.'));
    if (!ok) return toast.error(t('Allow notifications in your device settings first.'));
    toast.show(t('Test notification in 3 seconds…'));
  };

  return (
    <Screen header={{ title: t('Notifications') }}>
      {perm !== 'granted' ? (
        <Brutal bg={c.orange} depth={4} radius={18} contentStyle={{ padding: 14, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name="bell-off-outline" size={24} color="#111" />
            <T variant="bodyBold" color="#111" style={{ flex: 1 }}>
              {perm === 'denied' ? t('Notifications are blocked for Nivora Notes.') : t('Notifications aren’t enabled yet.')}
            </T>
          </View>
          <Button
            small
            kind="dark"
            label={perm === 'denied' ? t('Open device settings') : t('Allow notifications')}
            onPress={async () => {
              if (perm === 'denied') await Linking.openSettings();
              else {
                await ensurePermission();
                refresh();
              }
            }}
          />
        </Brutal>
      ) : null}

      <SectionLabel>{t('Alerts')}</SectionLabel>
      <SettingGroup>
        <SettingRow icon="bell-ring-outline" title={t('Reminder alerts')} subtitle={t('Notify me when a reminder is due')} right={<Switch value={s.notificationsEnabled && perm === 'granted'} onChange={(v) => void toggleAll(v)} />} />
        <SettingRow icon="weather-sunset-up" iconBg={c.orange} title={t('Daily summary')} subtitle={t('A morning nudge to plan your day')} right={<Switch value={s.dailySummary && s.notificationsEnabled} disabled={!s.notificationsEnabled} onChange={(v) => void toggleSummary(v)} />} />
        <SettingRow
          icon="clock-outline"
          title={t('Summary time')}
          value={summaryTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          onPress={s.dailySummary ? () => setTimeOpen(true) : undefined}
          last
        />
      </SettingGroup>

      <SectionLabel>{t('Sound & vibration')}</SectionLabel>
      <SettingGroup>
        <SettingRow icon="volume-high" title={t('Sound')} right={<Switch value={s.notifySound} onChange={(v) => { s.set({ notifySound: v }); void rescheduleAll(); }} />} />
        <SettingRow icon="vibrate" iconBg={c.orange} title={t('Vibration')} right={<Switch value={s.notifyVibrate} onChange={(v) => { s.set({ notifyVibrate: v }); void rescheduleAll(); }} />} last />
      </SettingGroup>

      <View style={{ marginTop: 24 }}>
        <Button label={t('Send a test notification')} kind="light" icon="bell-badge-outline" onPress={() => void test()} />
      </View>

      <DateTimeSheet
        visible={timeOpen}
        value={summaryTime.getTime()}
        title={t('Daily summary time')}
        onClose={() => setTimeOpen(false)}
        onConfirm={async (ts) => {
          const d = new Date(ts);
          s.set({ dailySummaryHour: d.getHours(), dailySummaryMinute: d.getMinutes() });
          await scheduleDailySummary(d.getHours(), d.getMinutes());
        }}
      />
    </Screen>
  );
}
