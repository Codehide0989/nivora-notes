import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { useSession } from '@/store/session';
import { LockTimeout, useSettings } from '@/store/settings';
import { toast } from '@/store/ui';
import { useT } from '@/i18n';
import { biometricInfo, BiometricInfo } from '@/services/security';
import { Brutal, Icon, Screen, SectionLabel, SettingGroup, SettingRow, Sheet, Switch, T } from '@/components/ui';
import { ActionRow } from '@/components/app/Pickers';

export default function Security() {
  const t = useT();
  const { c } = useTheme();
  const s = useSettings();
  const pinSet = useSession((x) => x.pinSet);
  const [bio, setBio] = useState<BiometricInfo>({ available: false, enrolled: false, kind: 'none' });
  const [timeoutOpen, setTimeoutOpen] = useState(false);

  useEffect(() => {
    biometricInfo().then(setBio).catch(() => undefined);
  }, []);

  const options: [LockTimeout, string][] = [
    [0, t('Immediately')],
    [30, t('After 30 seconds')],
    [60, t('After 1 minute')],
    [300, t('After 5 minutes')],
  ];
  const timeoutLabel = options.find(([k]) => k === s.lockTimeout)?.[1] ?? '';
  const bioLabel = bio.kind === 'face' ? t('Face unlock') : t('Fingerprint unlock');

  return (
    <Screen header={{ title: t('Security') }}>
      <Brutal bg={pinSet ? c.success : c.primary} depth={4} radius={20} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
        <Icon name={pinSet ? 'shield-check' : 'shield-alert-outline'} size={42} color="#111" />
        <View style={{ flex: 1 }}>
          <T variant="h3" color="#111">
            {pinSet ? t('Your notes are protected') : t('Protect your notes')}
          </T>
          <T variant="small" color="#111" style={{ opacity: 0.8 }}>
            {pinSet ? t('PIN lock is on.') : t('Add a PIN to lock the app and individual notes.')}
          </T>
        </View>
      </Brutal>

      <SectionLabel>{t('App lock')}</SectionLabel>
      <SettingGroup>
        <SettingRow
          icon="lock-outline"
          title={t('PIN lock')}
          subtitle={pinSet ? t('Required when you open the app') : t('Off')}
          right={<Switch value={pinSet} onChange={(v) => router.push(`/prefs/pin?mode=${v ? 'create' : 'remove'}`)} />}
        />
        <SettingRow icon="form-textbox-password" iconBg={c.orange} title={t('Change PIN')} onPress={pinSet ? () => router.push('/prefs/pin?mode=change') : undefined} chevron={pinSet} />
        <SettingRow
          icon={bio.kind === 'face' ? 'face-recognition' : 'fingerprint'}
          title={bioLabel}
          subtitle={!bio.available ? t('Not available on this device') : !bio.enrolled ? t('Add a fingerprint or face in device settings') : t('Unlock quickly with biometrics')}
          right={
            <Switch
              value={s.biometricsEnabled && pinSet}
              disabled={!bio.available}
              onChange={(v) => {
                if (!pinSet) return toast.show(t('Create a PIN first'), { actionLabel: t('Set PIN'), onAction: () => router.push('/prefs/pin?mode=create') });
                if (v) router.push('/prefs/fingerprint');
                else s.set({ biometricsEnabled: false });
              }}
            />
          }
        />
        <SettingRow icon="timer-lock-outline" title={t('Auto-lock')} value={timeoutLabel} onPress={pinSet ? () => setTimeoutOpen(true) : undefined} chevron={pinSet} />
        <SettingRow
          icon="eye-off-outline"
          iconBg={c.orange}
          title={t('Hide in app switcher')}
          subtitle={t('Blank preview in recent apps')}
          right={<Switch value={s.hideContentInSwitcher} onChange={(v) => s.set({ hideContentInSwitcher: v })} />}
          last
        />
      </SettingGroup>

      <SectionLabel>{t('Private notes')}</SectionLabel>
      <Brutal depth={3} radius={16} contentStyle={{ padding: 14, gap: 8 }}>
        <T variant="bodyBold">{t('Lock single notes')}</T>
        <T variant="small" muted>
          {t('Open any note, tap ⋮ and choose Lock note. Locked notes hide their preview and need your PIN or biometrics to open, share or export.')}
        </T>
      </Brutal>
      <T variant="small" muted center style={{ marginTop: 18 }}>
        {t('Your PIN is stored securely on this device and never leaves it. If you forget it, you’ll need to reinstall the app, which erases local data.')}
      </T>

      <Sheet visible={timeoutOpen} onClose={() => setTimeoutOpen(false)} title={t('Lock the app')}>
        {options.map(([k, label], i) => (
          <ActionRow
            key={k}
            icon="timer-outline"
            label={label}
            selected={s.lockTimeout === k}
            last={i === options.length - 1}
            onPress={() => {
              s.set({ lockTimeout: k });
              setTimeoutOpen(false);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}
