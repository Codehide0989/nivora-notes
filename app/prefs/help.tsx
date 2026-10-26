import React, { useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import Constants from 'expo-constants';
import { useTheme } from '@/theme';
import { useT } from '@/i18n';
import { toast } from '@/store/ui';
import { SUPPORT_EMAIL } from '@/config';
import { Brutal, Button, Icon, Screen, SectionLabel, T } from '@/components/ui';

export default function Help() {
  const t = useT();
  const { c } = useTheme();
  const [open, setOpen] = useState<number | null>(0);

  const faqs: [string, string][] = [
    [t('Where are my notes stored?'), t('Everything is stored privately on this device. Nothing is uploaded unless you share or back up a file yourself.')],
    [t('How do I lock a note?'), t('Create a PIN in Settings → Security, then open a note, tap ⋮ and choose Lock note.')],
    [t('I forgot my PIN'), t('For your privacy the PIN can’t be recovered. Restore from a backup after reinstalling the app, or contact support.')],
    [t('How do reminders work?'), t('Create a reminder, pick a time and allow notifications. Reminders keep working offline and can repeat daily, weekly or monthly.')],
    [t('How do I back up my notes?'), t('Go to Settings → Backup & restore → Back up now. Then use Save a copy to keep the file in Drive, iCloud or email.')],
    [t('Can I use markdown?'), t('Yes. **bold**, *italic*, ==highlight==, # headings, - lists and - [ ] checklists all work, or use the toolbar.')],
    [t('How do I get deleted notes back?'), t('Open Settings → Trash, then tap Restore. Notes are kept for the number of days set there.')],
  ];

  const contact = async () => {
    const body = encodeURIComponent(`\n\n—\nNivora Notes ${Constants.expoConfig?.version ?? ''} · ${Platform.OS} ${Platform.Version}`);
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Nivora Notes support')}&body=${body}`;
    try {
      await Linking.openURL(url);
    } catch {
      toast.error(t('No email app found. Write to {mail}', { mail: SUPPORT_EMAIL }));
    }
  };

  return (
    <Screen header={{ title: t('Help & support') }}>
      <Brutal bg={c.primary} depth={4} radius={20} contentStyle={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Icon name="lifebuoy" size={40} color="#111" />
          <View style={{ flex: 1 }}>
            <T variant="h2" color="#111">
              {t('We’re here to help')}
            </T>
            <T variant="small" color="#111" style={{ opacity: 0.8 }}>
              {t('Replies usually within a day.')}
            </T>
          </View>
        </View>
        <Button small kind="dark" label={t('Email support')} icon="email-outline" onPress={() => void contact()} />
      </Brutal>

      <SectionLabel>{t('Frequently asked')}</SectionLabel>
      <View style={{ gap: 12 }}>
        {faqs.map(([q, a], i) => {
          const on = open === i;
          return (
            <Brutal key={q} depth={3} radius={16} onPress={() => setOpen(on ? null : i)} accessibilityLabel={q} contentStyle={{ padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <T variant="bodyBold" style={{ flex: 1 }}>
                  {q}
                </T>
                <Icon name={on ? 'minus' : 'plus'} size={22} color={c.ink} />
              </View>
              {on ? (
                <T variant="body" muted style={{ marginTop: 8 }}>
                  {a}
                </T>
              ) : null}
            </Brutal>
          );
        })}
      </View>
    </Screen>
  );
}
