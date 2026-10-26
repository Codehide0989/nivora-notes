import React from 'react';
import { Linking, View } from 'react-native';
import Constants from 'expo-constants';
import { useTheme } from '@/theme';
import { useT } from '@/i18n';
import { toast } from '@/store/ui';
import { PRIVACY_URL, TERMS_URL, WEBSITE_URL } from '@/config';
import { Icon, Screen, SectionLabel, SettingGroup, SettingRow, T } from '@/components/ui';
import { LogoMark } from '@/components/app/Logo';

export default function About() {
  const t = useT();
  const { c } = useTheme();
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const open = (url: string) => Linking.openURL(url).catch(() => toast.error(t('Could not open the link')));

  const features: [string, string][] = [
    ['format-text', t('Rich text, checklists & templates')],
    ['microphone-outline', t('Voice notes and photos')],
    ['bell-ring-outline', t('Smart repeating reminders')],
    ['shield-lock-outline', t('PIN & biometric locked notes')],
    ['backup-restore', t('Backup, restore & export')],
    ['wifi-off', t('Fully offline, private by design')],
  ];

  return (
    <Screen header={{ title: t('About Nivora Notes') }}>
      <View style={{ alignItems: 'center', paddingVertical: 14 }}>
        <LogoMark size={92} />
        <T variant="display" center style={{ marginTop: 20 }}>
          Nivora Notes
        </T>
        <T variant="small" muted center>
          {t('Version {v}', { v: version })}
        </T>
        <T variant="body" muted center style={{ marginTop: 10, maxWidth: 300 }}>
          {t('A bold, private notebook for your notes, tasks and reminders.')}
        </T>
      </View>

      <SectionLabel>{t('What’s inside')}</SectionLabel>
      <View style={{ gap: 12 }}>
        {features.map(([icon, label]) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name={icon} size={22} color={c.ink} />
            <T variant="bodyBold">{label}</T>
          </View>
        ))}
      </View>

      <SectionLabel>{t('Legal')}</SectionLabel>
      <SettingGroup>
        <SettingRow icon="shield-account-outline" title={t('Privacy policy')} onPress={() => open(PRIVACY_URL)} />
        <SettingRow icon="file-document-outline" iconBg={c.orange} title={t('Terms of use')} onPress={() => open(TERMS_URL)} />
        <SettingRow icon="web" title={t('Website')} onPress={() => open(WEBSITE_URL)} last />
      </SettingGroup>
      <T variant="small" muted center style={{ marginTop: 22 }}>
        © {new Date().getFullYear()} Nivora. {t('All rights reserved.')}
      </T>
    </Screen>
  );
}
