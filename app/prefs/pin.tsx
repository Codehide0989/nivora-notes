import React, { useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSettings } from '@/store/settings';
import { toast } from '@/store/ui';
import { useT } from '@/i18n';
import { haptic } from '@/services/haptics';
import { removePin, setPin } from '@/services/security';
import { Screen, Segmented, T, goBack } from '@/components/ui';
import { Keypad, PinDots, PinTone, useShake } from '@/components/app/Keypad';
import { PinEntry } from '@/components/app/PinEntry';

type Mode = 'create' | 'change' | 'remove';
type Step = 'verify' | 'new' | 'confirm';

export default function PinScreen() {
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const mode: Mode = modeParam === 'change' || modeParam === 'remove' ? modeParam : 'create';
  const t = useT();
  const [step, setStep] = useState<Step>(mode === 'create' ? 'new' : 'verify');
  const [len, setLen] = useState<4 | 6>(4);
  const [first, setFirst] = useState('');
  const [value, setValue] = useState('');
  const [tone, setTone] = useState<PinTone>('idle');
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const { x, shake } = useShake();

  const title = mode === 'create' ? t('Create PIN') : mode === 'change' ? t('Change PIN') : t('Turn off PIN');
  const subtitle =
    step === 'verify' ? t('Enter your current PIN') : step === 'new' ? t('Choose a {n}-digit PIN', { n: len }) : t('Enter it again to confirm');

  const onDigit = (d: string) => {
    if (busy.current) return;
    haptic('select');
    setError(null);
    const next = (value + d).slice(0, len);
    setValue(next);
    if (next.length < len) return;
    if (step === 'new') {
      setFirst(next);
      setValue('');
      setStep('confirm');
      return;
    }
    // confirm
    if (next === first) {
      busy.current = true;
      setTone('ok');
      void (async () => {
        try {
          await setPin(next);
          haptic('success');
          toast.success(mode === 'change' ? t('PIN changed') : t('PIN lock is on'));
          goBack('/prefs/security');
        } catch {
          busy.current = false;
          setTone('error');
          setError(t('Could not save your PIN. Please try again.'));
        }
      })();
    } else {
      haptic('error');
      shake();
      setTone('error');
      setError(t('PINs don’t match. Try again.'));
      setTimeout(() => {
        setTone('idle');
        setValue('');
        setFirst('');
        setStep('new');
      }, 650);
    }
  };

  return (
    <Screen header={{ title, onBack: () => goBack('/prefs/security') }} scroll={false}>
      {step === 'verify' ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <PinEntry
            onSuccess={() => {
              if (mode === 'remove') {
                void removePin().then(() => {
                  useSettings.getState().set({ biometricsEnabled: false });
                  toast.success(t('PIN lock turned off'));
                  goBack('/prefs/security');
                });
              } else {
                setStep('new');
                setValue('');
              }
            }}
          />
        </View>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 22 }}>
          {step === 'new' && value.length === 0 ? (
            <View style={{ alignSelf: 'stretch' }}>
              <Segmented<'4' | '6'>
                value={String(len) as '4' | '6'}
                onChange={(k) => {
                  setLen(k === '6' ? 6 : 4);
                  setValue('');
                }}
                options={[
                  { key: '4', label: t('4 digits') },
                  { key: '6', label: t('6 digits') },
                ]}
              />
            </View>
          ) : null}
          <Animated.View style={{ transform: [{ translateX: x }], gap: 16, alignItems: 'center' }}>
            <PinDots length={len} filled={value.length} tone={tone} />
            <T variant="bodyBold" center color={error ? '#E5361F' : undefined}>
              {error ?? subtitle}
            </T>
          </Animated.View>
          <Keypad onDigit={onDigit} onDelete={() => setValue((v) => v.slice(0, -1))} />
          <T variant="small" muted center style={{ paddingHorizontal: 20 }}>
            {t('Avoid obvious PINs like 1234 or your birth year.')}
          </T>
        </View>
      )}
    </Screen>
  );
}
