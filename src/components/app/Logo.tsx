import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { T } from '@/components/ui';

export function LogoMark({ size = 64 }: { size?: number }) {
  const { c } = useTheme();
  const d = Math.max(3, Math.round(size / 11));
  return (
    <View style={{ paddingRight: d, paddingBottom: d }}>
      <View style={{ position: 'absolute', left: d, top: d, right: 0, bottom: 0, borderRadius: size / 4, backgroundColor: c.orange }} />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 4,
          backgroundColor: '#111',
          borderWidth: Math.max(2, size / 24),
          borderColor: '#111',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <T variant="display" color="#FFD400" fixed style={{ fontSize: size * 0.62, lineHeight: size * 0.74 }}>
          N
        </T>
      </View>
    </View>
  );
}

export function Wordmark({ size = 26, center }: { size?: number; center?: boolean }) {
  return (
    <View style={{ alignItems: center ? 'center' : 'flex-start' }}>
      <T variant="display" fixed style={{ fontSize: size, lineHeight: size * 1.05 }}>
        Nivora
      </T>
      <T variant="display" fixed style={{ fontSize: size, lineHeight: size * 1.05 }}>
        Notes
      </T>
    </View>
  );
}
