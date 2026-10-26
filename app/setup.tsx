import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { ACCENTS, AccentKey, ThemeMode, useTheme } from '@/theme';
import { useSettings } from '@/store/settings';
import { LANGUAGES, useT } from '@/i18n';
import { haptic } from '@/services/haptics';
import { ensurePermission } from '@/services/notifications';
import { Button, Field, Icon, Screen, Segmented, SectionLabel, SettingGroup, SettingRow, Switch, T } from '@/components/ui';

export default function Setup() {
  const t = useT();
  const { c } = useTheme();
  const settings = useSettings();
  const [name, setName] = useState(settings.profileName);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const language = LANGUAGES.find((l) => l.code === settings.language)?.native ?? 'English';

  const finish = async () => {
    setBusy(true);
    let allowed = false;
    if (notify) {
      try {
        allowed = await ensurePermission();
      } catch {
        allowed = false;
      }
    }
    settings.set({ onboarded: true, signedIn: true, profileName: name.trim(), notificationsEnabled: notify && allowed });
    haptic('success');
    setBusy(false);
    router.replace('/(tabs)');
  };

  return (
    <Screen
      header={{ title: t('Set up your notes'), subtitle: t('Takes less than a minute') }}
      footer={<Button label={t('Start writing')} icon="pencil" onPress={finish} loading={busy} />}
    >
      <Field
        label={t('What should we call you?')}
        icon="account-outline"
        value={name}
        onChangeText={setName}
        placeholder={t('Your name')}
        autoCapitalize="words"
        returnKeyType="done"
        maxLength={32}
      />

      <SectionLabel>{t('Accent colour')}</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {(Object.keys(ACCENTS) as AccentKey[]).map((k) => {
          const on = settings.accent === k;
          return (
            <Pressable
              key={k}
              accessibilityRole="radio"
              accessibilityLabel={k}
              accessibilityState={{ selected: on }}
              onPress={() => {
                haptic('select');
                settings.set({ accent: k });
              }}
              style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: ACCENTS[k], borderWidth: on ? 5 : 2.5, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}
            >
              {on ? <Icon name="check-bold" size={22} color="#111" /> : null}
            </Pressable>
          );
        })}
      </View>

      <SectionLabel>{t('Theme')}</SectionLabel>
      <Segmented<ThemeMode>
        value={settings.theme}
        onChange={(k) => settings.set({ theme: k })}
        options={[
          { key: 'system', label: t('Auto'), icon: 'theme-light-dark' },
          { key: 'light', label: t('Light'), icon: 'white-balance-sunny' },
          { key: 'dark', label: t('Dark'), icon: 'moon-waning-crescent' },
        ]}
      />

      <SectionLabel>{t('Preferences')}</SectionLabel>
      <SettingGroup>
        <SettingRow icon="translate" title={t('Language')} value={language} onPress={() => router.push('/prefs/language')} />
        <SettingRow
          icon="bell-ring-outline"
          title={t('Reminders & alerts')}
          subtitle={t('Get notified when a reminder is due')}
          right={<Switch value={notify} onChange={setNotify} />}
          last
        />
      </SettingGroup>
      <T variant="small" muted center style={{ marginTop: 18 }}>
        {t('Everything stays on your device. You can change all of this later in Settings.')}
      </T>
    </Screen>
  );
}
