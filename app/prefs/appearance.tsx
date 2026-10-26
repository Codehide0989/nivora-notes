import React from 'react';
import { Pressable, View } from 'react-native';
import { ACCENTS, AccentKey, ThemeMode, useTheme } from '@/theme';
import { useSettings, NoteView, SortBy } from '@/store/settings';
import { useT } from '@/i18n';
import { haptic } from '@/services/haptics';
import { Brutal, Icon, Screen, SectionLabel, Segmented, SettingGroup, SettingRow, Switch, T } from '@/components/ui';

export default function Appearance() {
  const t = useT();
  const { c } = useTheme();
  const s = useSettings();
  const sizes = [0.9, 1, 1.15, 1.3];

  return (
    <Screen header={{ title: t('Appearance') }}>
      <Brutal bg={c.primary} depth={4} radius={20} contentStyle={{ padding: 16, gap: 6 }}>
        <T variant="label" color="#111">
          {t('Preview')}
        </T>
        <T variant="h2" color="#111">
          {t('Weekend trip to Goa')}
        </T>
        <T variant="body" color="#111" style={{ opacity: 0.8 }}>
          {t('Book the hotel, pack sunscreen and plan the beach days.')}
        </T>
      </Brutal>

      <SectionLabel>{t('Theme')}</SectionLabel>
      <Segmented<ThemeMode>
        value={s.theme}
        onChange={(k) => s.set({ theme: k })}
        options={[
          { key: 'system', label: t('Auto'), icon: 'theme-light-dark' },
          { key: 'light', label: t('Light'), icon: 'white-balance-sunny' },
          { key: 'dark', label: t('Dark'), icon: 'moon-waning-crescent' },
        ]}
      />

      <SectionLabel>{t('Accent colour')}</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {(Object.keys(ACCENTS) as AccentKey[]).map((k) => {
          const on = s.accent === k;
          return (
            <Pressable
              key={k}
              accessibilityRole="radio"
              accessibilityLabel={k}
              accessibilityState={{ selected: on }}
              onPress={() => {
                haptic('select');
                s.set({ accent: k });
              }}
              style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: ACCENTS[k], borderWidth: on ? 5 : 2.5, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}
            >
              {on ? <Icon name="check-bold" size={22} color="#111" /> : null}
            </Pressable>
          );
        })}
      </View>

      <SectionLabel>{t('Text size')}</SectionLabel>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {sizes.map((z, i) => {
          const on = s.fontScale === z;
          return (
            <Brutal key={z} bg={on ? c.primary : c.surface} depth={on ? 3 : 2} radius={14} style={{ flex: 1 }} onPress={() => s.set({ fontScale: z })} accessibilityLabel={`${Math.round(z * 100)}%`} contentStyle={{ paddingVertical: 12, alignItems: 'center' }}>
              <T variant="h2" fixed color={on ? '#111' : c.ink} style={{ fontSize: 13 + i * 4 }}>
                Aa
              </T>
            </Brutal>
          );
        })}
      </View>

      <SectionLabel>{t('Notes')}</SectionLabel>
      <Segmented<NoteView>
        value={s.noteView}
        onChange={(k) => s.set({ noteView: k })}
        options={[
          { key: 'list', label: t('List'), icon: 'view-agenda-outline' },
          { key: 'grid', label: t('Grid'), icon: 'view-grid-outline' },
        ]}
      />
      <View style={{ height: 14 }} />
      <Segmented<SortBy>
        value={s.sortBy}
        onChange={(k) => s.set({ sortBy: k })}
        options={[
          { key: 'updated', label: t('Edited') },
          { key: 'created', label: t('Created') },
          { key: 'title', label: t('A–Z') },
        ]}
      />

      <SectionLabel>{t('Feedback')}</SectionLabel>
      <SettingGroup>
        <SettingRow icon="vibrate" title={t('Haptic feedback')} subtitle={t('Subtle vibrations when you tap')} right={<Switch value={s.haptics} onChange={(v) => s.set({ haptics: v })} />} last />
      </SettingGroup>
    </Screen>
  );
}
