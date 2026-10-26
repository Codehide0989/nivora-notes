import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';
import { useT } from '@/i18n';
import { authenticateBiometric, biometricInfo } from '@/services/security';
import { haptic } from '@/services/haptics';
import { useTheme } from '@/theme';
import { Icon, T } from '@/components/ui';
import { LogoMark } from './Logo';
import { PinEntry } from './PinEntry';

/** Full-screen overlay shown whenever the app is locked. It sits above navigation so nothing underneath is reachable. */
export function LockScreen() {
  const locked = useSession((s) => s.locked);
  const unlock = useSession((s) => s.unlock);
  const bioEnabled = useSettings((s) => s.biometricsEnabled);
  const t = useT();
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [bio, setBio] = useState<{ ok: boolean; icon: string }>({ ok: false, icon: 'fingerprint' });
  const [done, setDone] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const pop = useRef(new Animated.Value(0)).current;

  const finish = useCallback(() => {
    setDone(true);
    haptic('success');
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, bounciness: 10 }).start();
    setTimeout(() => {
      unlock();
      setDone(false);
      pop.setValue(0);
    }, 650);
  }, [pop, unlock]);

  const tryBio = useCallback(async () => {
    const ok = await authenticateBiometric(t('Unlock Nivora Notes'));
    if (ok) finish();
  }, [finish, t]);

  useEffect(() => {
    if (!locked) return;
    setEpoch((e) => e + 1);
    let alive = true;
    void (async () => {
      if (!bioEnabled) {
        setBio({ ok: false, icon: 'fingerprint' });
        return;
      }
      const info = await biometricInfo();
      if (!alive) return;
      const ok = info.available && info.enrolled;
      setBio({ ok, icon: info.kind === 'face' ? 'face-recognition' : 'fingerprint' });
      if (ok && AppState.currentState === 'active') setTimeout(() => void tryBio(), 350);
    })();
    return () => {
      alive = false;
    };
  }, [locked, bioEnabled, tryBio]);

  if (!locked) return null;
  const bg = isDark ? c.bg : c.primary;
  return (
    <View
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 2000, backgroundColor: bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16, alignItems: 'center' }}
      accessibilityViewIsModal
    >
      <LogoMark size={64} />
      <T variant="display" center color={isDark ? c.primary : '#111'} style={{ marginTop: 18 }}>
        {done ? t('Unlocked') : t('App locked')}
      </T>
      <T variant="body" center color={isDark ? c.muted : '#111'} style={{ marginTop: 6, opacity: 0.8 }}>
        {done ? t('Welcome back') : t('Enter your PIN to open your notes')}
      </T>
      <View style={{ flex: 1, justifyContent: 'center', alignSelf: 'stretch', alignItems: 'center' }}>
        {done ? (
          <Animated.View
            style={{
              width: 130,
              height: 130,
              borderRadius: 40,
              backgroundColor: c.success,
              borderWidth: 4,
              borderColor: isDark ? c.line : '#111',
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }, { rotate: '-4deg' }],
            }}
          >
            <Icon name="lock-open-variant" size={64} color="#111" />
          </Animated.View>
        ) : (
          <PinEntry onSuccess={finish} onDark={!isDark} resetKey={epoch} onBiometric={bio.ok ? () => void tryBio() : undefined} biometricIcon={bio.icon} />
        )}
      </View>
    </View>
  );
}
