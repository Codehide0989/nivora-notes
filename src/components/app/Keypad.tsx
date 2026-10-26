import React, { useCallback, useRef } from 'react';
import { Animated, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme';
import { Brutal, Icon, T } from '@/components/ui';

export type PinTone = 'idle' | 'error' | 'ok';

export function useShake() {
  const x = useRef(new Animated.Value(0)).current;
  const shake = useCallback(() => {
    x.setValue(0);
    Animated.sequence([
      Animated.timing(x, { toValue: 12, duration: 55, useNativeDriver: true }),
      Animated.timing(x, { toValue: -12, duration: 55, useNativeDriver: true }),
      Animated.timing(x, { toValue: 9, duration: 55, useNativeDriver: true }),
      Animated.timing(x, { toValue: -9, duration: 55, useNativeDriver: true }),
      Animated.timing(x, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  }, [x]);
  return { x, shake };
}

export function PinDots({ length, filled, tone = 'idle', onDark }: { length: number; filled: number; tone?: PinTone; onDark?: boolean }) {
  const { c } = useTheme();
  const ink = onDark ? '#111111' : c.ink;
  const on = tone === 'error' ? c.danger : tone === 'ok' ? c.success : ink;
  return (
    <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center' }} accessibilityLabel={`${filled} of ${length} digits entered`}>
      {Array.from({ length }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 3,
            borderColor: tone === 'idle' ? ink : on,
            backgroundColor: i < filled ? on : 'transparent',
          }}
        />
      ))}
    </View>
  );
}

interface KeypadProps {
  onDigit: (d: string) => void;
  onDelete: () => void;
  onBiometric?: () => void;
  biometricIcon?: string;
  disabled?: boolean;
}

export function Keypad({ onDigit, onDelete, onBiometric, biometricIcon = 'fingerprint', disabled }: KeypadProps) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const size = Math.max(56, Math.min(78, Math.floor((width - 96) / 3), Math.floor((height - 420) / 4)));
  const key = (label: string, node?: React.ReactNode, onPress?: () => void, bg?: string) => (
    <Brutal
      key={label}
      bg={bg ?? c.surface}
      depth={3}
      radius={size / 3.2}
      disabled={disabled || !onPress}
      onPress={onPress}
      quiet
      accessibilityLabel={label}
      contentStyle={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', flexGrow: 0 }}
    >
      {node ?? (
        <T variant="h1" fixed style={{ fontSize: size * 0.4 }}>
          {label}
        </T>
      )}
    </Brutal>
  );
  const blank = (k: string) => <View key={k} style={{ width: size + 3, height: size + 3 }} />;
  const rows: React.ReactNode[][] = [
    ['1', '2', '3'].map((d) => key(d, undefined, () => onDigit(d))),
    ['4', '5', '6'].map((d) => key(d, undefined, () => onDigit(d))),
    ['7', '8', '9'].map((d) => key(d, undefined, () => onDigit(d))),
    [
      onBiometric ? key('Biometric', <Icon name={biometricIcon} size={size * 0.46} color="#111" />, onBiometric, c.primary) : blank('b'),
      key('0', undefined, () => onDigit('0')),
      key('Delete', <Icon name="backspace-outline" size={size * 0.42} color={c.ink} />, onDelete),
    ],
  ];
  return (
    <View style={{ gap: 14, alignItems: 'center' }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 18 }}>
          {r}
        </View>
      ))}
    </View>
  );
}
