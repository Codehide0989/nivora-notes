import React from 'react';
import { ActivityIndicator, StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Brutal } from './Brutal';
import { Icon } from './Icon';
import { T } from './Text';

type Kind = 'primary' | 'dark' | 'light' | 'danger' | 'orange';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  kind?: Kind;
  icon?: string;
  iconRight?: string;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, kind = 'primary', icon, iconRight, loading, disabled, small, style }: ButtonProps) {
  const { c, isDark } = useTheme();
  let bg = c.primary;
  let fg = c.primaryInk;
  if (kind === 'dark') {
    bg = isDark ? c.surface2 : '#111111';
    fg = isDark ? c.ink : '#FFF9E3';
  } else if (kind === 'light') {
    bg = c.surface;
    fg = c.ink;
  } else if (kind === 'danger') {
    bg = c.danger;
    fg = '#FFFFFF';
  } else if (kind === 'orange') {
    bg = c.orange;
    fg = '#111111';
  }
  return (
    <Brutal
      bg={bg}
      depth={small ? 3 : 4}
      radius={small ? 12 : 16}
      onPress={loading ? undefined : onPress}
      disabled={disabled || loading}
      style={style}
      accessibilityLabel={label}
      contentStyle={{
        minHeight: small ? 40 : 54,
        paddingHorizontal: small ? 14 : 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={small ? 18 : 22} color={fg} /> : null}
          <T variant="caps" color={fg} style={{ fontSize: small ? 12 : 14 }} fixed numberOfLines={1}>
            {label}
          </T>
          {iconRight ? <Icon name={iconRight} size={small ? 18 : 22} color={fg} /> : null}
        </>
      )}
    </Brutal>
  );
}

interface IconButtonProps {
  icon: string;
  onPress?: () => void;
  size?: number;
  bg?: string;
  color?: string;
  label: string;
  depth?: number;
  disabled?: boolean;
}

export function IconButton({ icon, onPress, size = 44, bg, color, label, depth = 3, disabled }: IconButtonProps) {
  const { c } = useTheme();
  return (
    <Brutal
      bg={bg ?? c.surface}
      depth={depth}
      radius={size / 3.4}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      contentStyle={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', flexGrow: 0 }}
    >
      <Icon name={icon} size={size * 0.5} color={color ?? c.ink} />
    </Brutal>
  );
}

export function Spacer({ h = 12, w }: { h?: number; w?: number }) {
  return <View style={{ height: h, width: w }} />;
}
