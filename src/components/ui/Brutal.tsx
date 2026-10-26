import React from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { haptic } from '@/services/haptics';

interface Props {
  children?: React.ReactNode;
  /** Layout style for the outer wrapper (flex, margin, width...). */
  style?: StyleProp<ViewStyle>;
  /** Style for the bordered box itself (padding, alignment...). */
  contentStyle?: StyleProp<ViewStyle>;
  bg?: string;
  radius?: number;
  depth?: number;
  border?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  flat?: boolean;
  quiet?: boolean;
  accessibilityLabel?: string;
  hitSlop?: number;
}

/** The signature neo-brutalist surface: thick outline + hard offset shadow that "presses" in. */
export function Brutal({
  children,
  style,
  contentStyle,
  bg,
  radius = 14,
  depth = 4,
  border = 2.5,
  onPress,
  onLongPress,
  disabled,
  flat,
  quiet,
  accessibilityLabel,
  hitSlop,
}: Props) {
  const { c } = useTheme();
  const d = flat ? 0 : depth;
  const box: ViewStyle = {
    backgroundColor: bg ?? c.surface,
    borderRadius: radius,
    borderWidth: border,
    borderColor: c.line,
    flexGrow: 1,
    overflow: 'hidden',
  };
  return (
    <View style={[{ paddingRight: d, paddingBottom: d, opacity: disabled ? 0.5 : 1 }, style]}>
      {!flat && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: d, top: d, right: 0, bottom: 0, borderRadius: radius, backgroundColor: c.shadow }}
        />
      )}
      {onPress || onLongPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          disabled={disabled}
          hitSlop={hitSlop}
          onPress={() => {
            if (!quiet) haptic('light');
            onPress?.();
          }}
          onLongPress={() => {
            haptic('medium');
            onLongPress?.();
          }}
          style={({ pressed }) => [
            box,
            pressed && d > 0 && { transform: [{ translateX: d * 0.7 }, { translateY: d * 0.7 }] },
            contentStyle,
          ]}
        >
          {children}
        </Pressable>
      ) : (
        <View style={[box, contentStyle]}>{children}</View>
      )}
    </View>
  );
}
