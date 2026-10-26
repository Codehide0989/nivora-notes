import React from 'react';
import { Pressable, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { useT } from '@/i18n';
import { haptic } from '@/services/haptics';
import { useData } from '@/store/data';
import { Brutal, Icon, T } from '@/components/ui';

type Item = { name: string; icon: string; iconOn: string; label: string } | 'fab';

/** Route name -> URL. Works with expo-router in every SDK, so we never depend on the `navigation` prop. */
const TAB_PATH: Record<string, string> = { index: '/', tasks: '/tasks', reminders: '/reminders', vault: '/vault', settings: '/settings' };

export function TabBar({ state }: BottomTabBarProps) {
  const { c } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const overdue = useData((s) => s.reminders.filter((r) => !r.done && r.repeat === 'none' && r.at < Date.now()).length);
  const active = state?.routes?.[state.index]?.name;

  const items: Item[] = [
    { name: 'index', icon: 'note-text-outline', iconOn: 'note-text', label: t('Notes') },
    { name: 'tasks', icon: 'checkbox-marked-circle-outline', iconOn: 'checkbox-marked-circle', label: t('Tasks') },
    'fab',
    { name: 'reminders', icon: 'bell-outline', iconOn: 'bell', label: t('Reminders') },
    { name: 'vault', icon: 'shield-key-outline', iconOn: 'shield-key', label: t('Vault') },
    { name: 'settings', icon: 'cog-outline', iconOn: 'cog', label: t('Settings') },
  ];

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: c.surface,
        borderTopWidth: 2.5,
        borderColor: c.line,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 8,
        paddingHorizontal: 8,
        flexDirection: 'row',
        alignItems: 'flex-end',
      }}
    >
      {items.map((it) => {
        if (it === 'fab') {
          return (
            <View key="fab" style={{ flex: 1, alignItems: 'center', marginTop: -30 }}>
              <Brutal
                bg={c.primary}
                depth={4}
                radius={20}
                onPress={() => router.push('/new')}
                accessibilityLabel={t('Create new note')}
                contentStyle={{ width: 62, height: 62, alignItems: 'center', justifyContent: 'center', flexGrow: 0 }}
              >
                <Icon name="plus" size={36} color="#111" />
              </Brutal>
            </View>
          );
        }
        const on = active === it.name;
        const badge = it.name === 'reminders' && overdue > 0;
        return (
          <Pressable
            key={it.name}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={it.label}
            onPress={() => {
              haptic('select');
              if (!on) router.navigate(TAB_PATH[it.name] as never);
            }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 2 }}
          >
            <View
              style={{
                width: 48,
                height: 34,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: on ? c.primary : 'transparent',
                borderWidth: on ? 2.5 : 0,
                borderColor: c.line,
              }}
            >
              <Icon name={on ? it.iconOn : it.icon} size={23} color={on ? '#111' : c.ink} />
              {badge ? (
                <View style={{ position: 'absolute', top: -3, right: -1, width: 12, height: 12, borderRadius: 6, backgroundColor: c.danger, borderWidth: 2, borderColor: c.surface }} />
              ) : null}
            </View>
            <T variant="label" fixed style={{ fontSize: 10, marginTop: 3, opacity: on ? 1 : 0.65 }}>
              {it.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export const TAB_BAR_SPACE = 112;
