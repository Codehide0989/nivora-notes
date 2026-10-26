import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';
import { useT } from '@/i18n';
import { haptic } from '@/services/haptics';
import { authenticateBiometric, biometricInfo, BiometricInfo } from '@/services/security';
import { Brutal, Button, Icon, Screen, T, goBack } from '@/components/ui';

export default function FingerprintSetup() {
  const t = useT();
  const { c } = useTheme();
  const pinSet = useSession((s) => s.pinSet);
  const [info, setInfo] = useState<BiometricInfo | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'fail'>('idle');
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    biometricInfo().then(setInfo).catch(() => setInfo({ available: false, enrolled: false, kind: 'none' }));
    Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true })])).start();
  }, [pulse]);

  const face = info?.kind === 'face';
  const icon = state === 'ok' ? 'check-bold' : face ? 'face-recognition' : 'fingerprint';

  const scan = async () => {
    setState('busy');
    const ok = await authenticateBiometric(face ? t('Confirm your face to turn on face unlock') : t('Touch the sensor to turn on fingerprint unlock'));
    if (ok) {
      useSettings.getState().set({ biometricsEnabled: true });
      haptic('success');
      setState('ok');
    } else {
      haptic('error');
      setState('fail');
    }
  };

  return (
    <Screen
      header={{ title: face ? t('Face unlock') : t('Fingerprint setup'), onBack: () => goBack('/prefs/security') }}
      scroll={false}
      footer={
        state === 'ok' ? (
          <Button label={t('Done')} icon="check" onPress={() => goBack('/prefs/security')} />
        ) : !pinSet ? (
          <Button label={t('Create a PIN first')} onPress={() => router.replace('/prefs/pin?mode=create')} />
        ) : !info?.available ? (
          <Button label={t('Back')} kind="light" onPress={() => goBack('/prefs/security')} />
        ) : !info.enrolled ? (
          <Button label={t('Open device settings')} onPress={() => void Linking.openSettings()} />
        ) : (
          <Button label={state === 'fail' ? t('Try again') : t('Scan now')} icon={face ? 'face-recognition' : 'fingerprint'} loading={state === 'busy'} onPress={() => void scan()} />
        )
      }
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 }}>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View
            style={{
              position: 'absolute',
              width: 220,
              height: 220,
              borderRadius: 70,
              backgroundColor: c.primary,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.4] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.08] }) }],
            }}
          />
          <Brutal bg={state === 'ok' ? c.success : state === 'fail' ? c.danger : c.primary} depth={8} radius={46} border={4} contentStyle={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center', flexGrow: 0 }}>
            <Icon name={icon} size={88} color={state === 'fail' ? '#fff' : '#111'} />
          </Brutal>
        </View>
        <T variant="display" center>
          {state === 'ok' ? t('All set!') : state === 'fail' ? t('Not recognised') : face ? t('Set up face unlock') : t('Set up fingerprint')}
        </T>
        <T variant="body" muted center style={{ maxWidth: 310 }}>
          {state === 'ok'
            ? t('You can now unlock Nivora Notes with biometrics. Your PIN still works as a backup.')
            : !pinSet
              ? t('Biometrics sit on top of your PIN, so create a PIN first.')
              : !info?.available
                ? t('This device doesn’t support biometric unlock.')
                : !info.enrolled
                  ? t('No fingerprint or face is saved on this device yet. Add one in your device settings, then come back.')
                  : state === 'fail'
                    ? t('That didn’t work. Make sure your finger or face is clear and try again.')
                    : t('Use your device’s biometrics to open the app and locked notes without typing your PIN.')}
        </T>
      </View>
    </Screen>
  );
}
