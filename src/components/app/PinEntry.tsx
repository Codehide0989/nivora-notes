import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { haptic } from '@/services/haptics';
import { useT } from '@/i18n';
import { getLockout, pinLength, verifyPin } from '@/services/security';
import { T } from '@/components/ui';
import { Keypad, PinDots, PinTone, useShake } from './Keypad';

interface Props {
  /** Called once the correct PIN has been entered. */
  onSuccess: () => void;
  onBiometric?: () => void;
  biometricIcon?: string;
  /** Tint text for use on the yellow lock-screen background. */
  onDark?: boolean;
  /** Re-checked each time this changes (e.g. when a lock screen reappears). */
  resetKey?: unknown;
}

/** PIN pad that verifies against the stored PIN, shakes on mistakes and honours lockouts. */
export function PinEntry({ onSuccess, onBiometric, biometricIcon, onDark, resetKey }: Props) {
  const t = useT();
  const [len, setLen] = useState(4);
  const [pin, setPin] = useState('');
  const [tone, setTone] = useState<PinTone>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const busy = useRef(false);
  const { x, shake } = useShake();

  useEffect(() => {
    let alive = true;
    setPin('');
    setTone('idle');
    setMessage(null);
    void (async () => {
      const l = await pinLength();
      const lock = await getLockout();
      if (!alive) return;
      setLen(l);
      setUntil(lock.until);
    })();
    return () => {
      alive = false;
    };
  }, [resetKey]);

  useEffect(() => {
    if (until <= Date.now()) return;
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= until) {
        setUntil(0);
        setMessage(null);
        setTone('idle');
      }
    }, 500);
    return () => clearInterval(id);
  }, [until]);

  const locked = until > now;
  const secondsLeft = Math.max(0, Math.ceil((until - now) / 1000));

  const submit = useCallback(
    async (value: string) => {
      if (busy.current) return;
      busy.current = true;
      const res = await verifyPin(value);
      busy.current = false;
      if (res.ok) {
        setTone('ok');
        haptic('success');
        onSuccess();
        return;
      }
      haptic('error');
      shake();
      setTone('error');
      setPin('');
      if (res.reason === 'locked') {
        setUntil(res.until);
        setNow(Date.now());
        setMessage(null);
      } else {
        setMessage(
          res.attemptsLeft > 0
            ? t('Incorrect PIN · {n} attempts left', { n: res.attemptsLeft })
            : t('Incorrect PIN'),
        );
      }
      setTimeout(() => setTone('idle'), 700);
    },
    [onSuccess, shake, t],
  );

  const onDigit = (d: string) => {
    if (locked || busy.current) return;
    haptic('select');
    setMessage(null);
    const next = (pin + d).slice(0, len);
    setPin(next);
    if (next.length === len) void submit(next);
  };

  const fg = onDark ? '#111111' : undefined;
  return (
    <View style={{ alignItems: 'center', gap: 26 }}>
      <Animated.View style={{ transform: [{ translateX: x }], gap: 14, alignItems: 'center' }}>
        <PinDots length={len} filled={pin.length} tone={tone} onDark={onDark} />
        <View style={{ minHeight: 22 }}>
          {locked ? (
            <T variant="bodyBold" center color={onDark ? '#111' : undefined}>
              {t('Too many attempts. Try again in {s}s', { s: secondsLeft })}
            </T>
          ) : message ? (
            <T variant="bodyBold" center color={onDark ? '#7A1409' : '#E5361F'}>
              {message}
            </T>
          ) : (
            <T variant="small" center color={fg} muted={!onDark}>
              {t('Enter your {n}-digit PIN', { n: len })}
            </T>
          )}
        </View>
      </Animated.View>
      <Keypad
        onDigit={onDigit}
        onDelete={() => {
          if (!locked) setPin((p) => p.slice(0, -1));
        }}
        onBiometric={onBiometric}
        biometricIcon={biometricIcon}
        disabled={locked}
      />
    </View>
  );
}
