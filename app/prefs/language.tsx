import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { useSettings } from '@/store/settings';
import { LANGUAGES, useT } from '@/i18n';
import { haptic } from '@/services/haptics';
import { Brutal, Button, EmptyState, Field, Icon, Screen, T, goBack } from '@/components/ui';

export default function Language() {
  const t = useT();
  const { c } = useTheme();
  const current = useSettings((s) => s.language);
  const set = useSettings((s) => s.set);
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    return LANGUAGES.filter((l) => l.ready && (!k || l.name.toLowerCase().includes(k) || l.native.toLowerCase().includes(k)));
  }, [q]);

  return (
    <Screen header={{ title: t('Language') }} footer={<Button label={t('Continue')} iconRight="arrow-right" onPress={() => goBack('/(tabs)/settings')} />}>
      <Field value={q} onChangeText={setQ} placeholder={t('Search language')} icon="magnify" />
      <View style={{ gap: 12, marginTop: 16 }}>
        {list.map((l) => {
          const on = l.code === current;
          return (
            <Brutal
              key={l.code}
              bg={on ? c.primary : c.surface}
              depth={on ? 4 : 3}
              radius={16}
              onPress={() => {
                haptic('select');
                set({ language: l.code });
              }}
              accessibilityLabel={l.name}
              contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}
            >
              <View style={{ flex: 1 }}>
                <T variant="h3" color={on ? '#111' : c.ink}>
                  {l.native}
                </T>
                <T variant="small" color={on ? '#111' : c.muted}>
                  {l.name}
                </T>
              </View>
              <Icon name={on ? 'radiobox-marked' : 'radiobox-blank'} size={26} color={on ? '#111' : c.muted} />
            </Brutal>
          );
        })}
        {list.length === 0 ? <EmptyState icon="translate-off" title={t('No languages found')} message={t('Try a different search.')} /> : null}
      </View>
    </Screen>
  );
}
