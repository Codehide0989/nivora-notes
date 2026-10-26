import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleProp, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { FONTS, useTheme } from '@/theme';
import { haptic } from '@/services/haptics';
import { Brutal } from './Brutal';
import { Icon } from './Icon';
import { T } from './Text';

export function Switch({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const { c } = useTheme();
  const x = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(x, { toValue: value ? 1 : 0, duration: 140, useNativeDriver: true }).start();
  }, [value, x]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        haptic('select');
        onChange(!value);
      }}
      style={{
        width: 56,
        height: 32,
        borderRadius: 16,
        borderWidth: 2.5,
        borderColor: c.line,
        backgroundColor: value ? c.primary : c.surface2,
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Animated.View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: value ? '#111' : c.line,
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [4, 28] }) }],
        }}
      />
    </Pressable>
  );
}

interface ChipProps {
  label: string;
  selected?: boolean;
  icon?: string;
  onPress?: () => void;
  bg?: string;
  small?: boolean;
}

export function Chip({ label, selected, icon, onPress, bg, small }: ChipProps) {
  const { c } = useTheme();
  const fill = selected ? c.primary : bg ?? c.surface;
  const fg = selected ? c.primaryInk : bg ? '#111' : c.ink;
  return (
    <Brutal
      bg={fill}
      depth={selected ? 3 : 2}
      radius={999}
      border={2}
      onPress={onPress}
      quiet
      contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: small ? 10 : 14, paddingVertical: small ? 5 : 8, flexGrow: 0 }}
    >
      {icon ? <Icon name={icon} size={small ? 14 : 16} color={fg} /> : null}
      <T variant="label" color={fg} fixed style={{ letterSpacing: 0.4 }}>
        {label}
      </T>
    </Brutal>
  );
}

export function ChipRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[{ gap: 8, paddingRight: 8, paddingBottom: 6, paddingTop: 2 }, style]}>
      {children}
    </ScrollView>
  );
}

export interface SegOption<K extends string> {
  key: K;
  label: string;
  icon?: string;
}

export function Segmented<K extends string>({ options, value, onChange }: { options: SegOption<K>[]; value: K; onChange: (k: K) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', borderWidth: 2.5, borderColor: c.line, borderRadius: 16, backgroundColor: c.surface, overflow: 'hidden' }}>
      {options.map((o, i) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => {
              haptic('select');
              onChange(o.key);
            }}
            style={{
              flex: 1,
              paddingVertical: 10,
              flexDirection: 'row',
              gap: 6,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? c.primary : 'transparent',
              borderLeftWidth: i === 0 ? 0 : 2.5,
              borderLeftColor: c.line,
            }}
          >
            {o.icon ? <Icon name={o.icon} size={16} color={on ? c.primaryInk : c.ink} /> : null}
            <T variant="label" fixed color={on ? c.primaryInk : c.ink}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

interface FieldProps extends TextInputProps {
  label?: string;
  icon?: string;
  error?: string | null;
  right?: React.ReactNode;
  boxStyle?: StyleProp<ViewStyle>;
}

export const Field = React.forwardRef<TextInput, FieldProps>(function Field({ label, icon, error, right, multiline, boxStyle, style, ...rest }, ref) {
  const { c, scale } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={boxStyle}>
      {label ? (
        <T variant="label" muted style={{ marginBottom: 6 }}>
          {label}
        </T>
      ) : null}
      <Brutal
        bg={focus ? c.surface2 : c.surface}
        depth={focus ? 4 : 3}
        radius={14}
        contentStyle={{ flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', paddingHorizontal: 14, gap: 10 }}
      >
        {icon ? (
          <View style={{ paddingTop: multiline ? 14 : 0 }}>
            <Icon name={icon} size={20} color={c.muted} />
          </View>
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={c.muted}
          selectionColor={c.primary}
          cursorColor={c.ink}
          multiline={multiline}
          onFocus={(e) => {
            setFocus(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            rest.onBlur?.(e);
          }}
          {...rest}
          style={[
            {
              flex: 1,
              fontFamily: FONTS.medium,
              fontSize: Math.round(16 * scale),
              color: c.ink,
              paddingVertical: multiline ? 12 : 14,
              minHeight: multiline ? 96 : 50,
              textAlignVertical: multiline ? 'top' : 'center',
            },
            style,
          ]}
        />
        {right}
      </Brutal>
      {error ? (
        <T variant="small" color={c.danger} style={{ marginTop: 6 }}>
          {error}
        </T>
      ) : null}
    </View>
  );
});

export function ProgressBar({ value, height = 16, color }: { value: number; height?: number; color?: string }) {
  const { c } = useTheme();
  const a = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: Math.max(0, Math.min(1, value)), duration: 260, useNativeDriver: false }).start();
  }, [value, a]);
  return (
    <View style={{ height, borderRadius: height / 2, borderWidth: 2.5, borderColor: c.line, backgroundColor: c.surface, overflow: 'hidden' }}>
      <Animated.View
        style={{
          height: '100%',
          width: a.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: color ?? c.primary,
          borderRightWidth: 2.5,
          borderRightColor: c.line,
        }}
      />
    </View>
  );
}

export function Badge({ label, bg, fg }: { label: string; bg?: string; fg?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: bg ?? c.primary, borderWidth: 2, borderColor: c.line, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
      <T variant="caps" fixed color={fg ?? c.primaryInk} style={{ fontSize: 10, lineHeight: 14 }}>
        {label}
      </T>
    </View>
  );
}

export function Sticker({ icon, bg, size = 44, color, rotate = 0 }: { icon: string; bg: string; size?: number; color?: string; rotate?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ paddingRight: 3, paddingBottom: 3, transform: [{ rotate: `${rotate}deg` }] }}>
      <View style={{ position: 'absolute', left: 3, top: 3, right: 0, bottom: 0, borderRadius: size / 3.2, backgroundColor: c.shadow }} />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 3.2,
          backgroundColor: bg,
          borderWidth: 2.5,
          borderColor: c.line,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={size * 0.54} color={color ?? '#111'} />
      </View>
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const { c } = useTheme();
  return <View style={{ height: 1.5, backgroundColor: c.hairline, marginLeft: inset }} />;
}

export function SectionLabel({ children, right }: { children: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 }}>
      <T variant="caps" muted>
        {children}
      </T>
      {right}
    </View>
  );
}

export function Avatar({ name, size = 56 }: { name: string; size?: number }) {
  const { c } = useTheme();
  const initial = (name.trim()[0] ?? 'N').toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 3,
        backgroundColor: c.primary,
        borderWidth: 2.5,
        borderColor: c.line,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <T variant="h1" color={c.primaryInk} fixed style={{ fontSize: size * 0.46, lineHeight: size * 0.56 }}>
        {initial}
      </T>
    </View>
  );
}

interface SettingRowProps {
  icon: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  last?: boolean;
  chevron?: boolean;
}

export function SettingGroup({ children }: { children: React.ReactNode }) {
  return (
    <Brutal depth={4} radius={18} contentStyle={{ paddingVertical: 2 }}>
      {children}
    </Brutal>
  );
}

export function SettingRow({ icon, iconBg, title, subtitle, value, onPress, right, danger, last, chevron = true }: SettingRowProps) {
  const { c } = useTheme();
  const inner = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
      <Sticker icon={icon} bg={danger ? c.danger : iconBg ?? c.primary} size={38} color={danger ? '#fff' : '#111'} />
      <View style={{ flex: 1 }}>
        <T variant="bodyBold" color={danger ? c.danger : c.ink} numberOfLines={1}>
          {title}
        </T>
        {subtitle ? (
          <T variant="small" muted numberOfLines={2}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {value ? (
        <T variant="small" muted numberOfLines={1} style={{ maxWidth: 120 }}>
          {value}
        </T>
      ) : null}
      {right}
      {onPress && chevron && !right ? <Icon name="chevron-right" size={22} color={c.muted} /> : null}
    </View>
  );
  return (
    <View>
      {onPress ? (
        <Pressable onPress={() => { haptic('light'); onPress(); }} android_ripple={{ color: c.hairline }} accessibilityRole="button" accessibilityLabel={title}>
          {inner}
        </Pressable>
      ) : (
        inner
      )}
      {last ? null : <Divider inset={64} />}
    </View>
  );
}
