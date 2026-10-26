import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { useData } from '@/store/data';
import { useSettings } from '@/store/settings';
import { useT } from '@/i18n';
import { formatDay } from '@/utils/date';
import { Brutal, Button, EmptyState, Icon, IconButton, Segmented, T } from '@/components/ui';
import { OfflineBanner } from '@/components/app/Banners';
import { ReminderRow } from '@/components/app/Rows';
import { TAB_BAR_SPACE } from '@/components/app/TabBar';
import { ensurePermission, permissionStatus, scheduleReminder } from '@/services/notifications';
import type { Reminder } from '@/types';

type Tab = 'upcoming' | 'overdue' | 'done';
type Item = { k: 'h'; id: string; label: string } | { k: 'r'; id: string; r: Reminder };

export default function Reminders() {
  const t = useT();
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const reminders = useData((s) => s.reminders);
  const notificationsOn = useSettings((s) => s.notificationsEnabled);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [perm, setPerm] = useState<'granted' | 'denied' | 'undetermined'>('granted');

  const checkPerm = useCallback(() => {
    permissionStatus().then(setPerm).catch(() => undefined);
  }, []);
  useEffect(() => {
    checkPerm();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && checkPerm());
    return () => sub.remove();
  }, [checkPerm]);

  const isOverdue = (r: Reminder) => !r.done && r.repeat === 'none' && r.at < Date.now();
  const counts = useMemo(
    () => ({
      upcoming: reminders.filter((r) => !r.done && !isOverdue(r)).length,
      overdue: reminders.filter(isOverdue).length,
      done: reminders.filter((r) => r.done).length,
    }),
    [reminders],
  );

  const items = useMemo<Item[]>(() => {
    const list = reminders.filter((r) => (tab === 'done' ? r.done : tab === 'overdue' ? isOverdue(r) : !r.done && !isOverdue(r)));
    list.sort((a, b) => (tab === 'done' ? b.at - a.at : a.at - b.at));
    const out: Item[] = [];
    let last = '';
    list.forEach((r) => {
      const label = formatDay(r.at);
      if (label !== last) {
        out.push({ k: 'h', id: `h-${label}-${r.id}`, label: label === 'Today' ? t('Today') : label === 'Tomorrow' ? t('Tomorrow') : label === 'Yesterday' ? t('Yesterday') : label });
        last = label;
      }
      out.push({ k: 'r', id: r.id, r });
    });
    return out;
  }, [reminders, tab, t]);

  const toggleDone = async (r: Reminder) => {
    const store = useData.getState();
    if (r.repeat !== 'none') return router.push(`/reminder/${r.id}`);
    const done = !r.done;
    store.updateReminder(r.id, { done });
    const nid = await scheduleReminder({ ...r, done });
    store.updateReminder(r.id, { notificationId: nid });
  };

  const header = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10 }}>
        <View style={{ flex: 1 }}>
          <T variant="small" muted>
            {t('{n} coming up', { n: counts.upcoming })}
          </T>
          <T variant="h1">{t('Reminders')}</T>
        </View>
        <IconButton icon="plus" label={t('Create reminder')} bg={c.primary} color="#111" onPress={() => router.push('/reminder/new')} />
      </View>
      {(perm !== 'granted' || !notificationsOn) && reminders.length > 0 ? (
        <Brutal bg={c.orange} depth={3} radius={14} border={2} style={{ marginTop: 14 }} contentStyle={{ padding: 12, gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name="bell-off-outline" size={22} color="#111" />
            <T variant="small" color="#111" style={{ flex: 1 }}>
              {t('Notifications are off, so reminders won’t alert you.')}
            </T>
          </View>
          <Button
            small
            kind="dark"
            label={perm === 'denied' ? t('Open Settings') : t('Turn on')}
            onPress={async () => {
              if (perm === 'denied') return router.push('/prefs/notifications');
              const ok = await ensurePermission();
              useSettings.getState().set({ notificationsEnabled: ok });
              checkPerm();
            }}
          />
        </Brutal>
      ) : null}
      <View style={{ marginTop: 16, marginBottom: 12 }}>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { key: 'upcoming', label: `${t('Upcoming')} ${counts.upcoming}` },
            { key: 'overdue', label: `${t('Overdue')} ${counts.overdue}` },
            { key: 'done', label: `${t('Done')} ${counts.done}` },
          ]}
        />
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OfflineBanner />
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={header}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: TAB_BAR_SPACE + insets.bottom, gap: 12 }}
        ListEmptyComponent={
          <EmptyState
            icon={tab === 'done' ? 'check-circle-outline' : 'bell-plus-outline'}
            title={tab === 'upcoming' ? t('No reminders') : tab === 'overdue' ? t('Nothing overdue') : t('Nothing done yet')}
            message={tab === 'upcoming' ? t('Set a reminder and Nivora will nudge you at the right time.') : tab === 'overdue' ? t('You’re all caught up.') : t('Completed reminders show up here.')}
            actionLabel={tab === 'upcoming' ? t('Create reminder') : undefined}
            onAction={() => router.push('/reminder/new')}
          />
        }
        renderItem={({ item }) =>
          item.k === 'h' ? (
            <T variant="caps" muted style={{ marginTop: 6 }}>
              {item.label}
            </T>
          ) : (
            <ReminderRow reminder={item.r} onPress={() => router.push(`/reminder/${item.r.id}`)} onToggle={() => void toggleDone(item.r)} />
          )
        }
      />
    </View>
  );
}
