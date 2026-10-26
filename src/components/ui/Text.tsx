import React from 'react';
import { Text as RNText, TextProps, TextStyle } from 'react-native';
import { FONTS, useTheme } from '@/theme';

export type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodyBold' | 'small' | 'label' | 'caps' | 'mono';

const SPEC: Record<Variant, TextStyle> = {
  display: { fontFamily: FONTS.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.5, textTransform: 'uppercase' },
  h1: { fontFamily: FONTS.display, fontSize: 26, lineHeight: 30, textTransform: 'uppercase' },
  h2: { fontFamily: FONTS.display, fontSize: 19, lineHeight: 24, textTransform: 'uppercase' },
  h3: { fontFamily: FONTS.bold, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: FONTS.medium, fontSize: 15, lineHeight: 22 },
  bodyBold: { fontFamily: FONTS.bold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: FONTS.medium, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: FONTS.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: 'uppercase' },
  caps: { fontFamily: FONTS.display, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
  mono: { fontFamily: FONTS.mono, fontSize: 14, lineHeight: 20 },
};

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
  muted?: boolean;
  center?: boolean;
  /** Skip user font scaling (for fixed-size UI like tab labels). */
  fixed?: boolean;
}

export function T({ variant = 'body', color, muted, center, fixed, style, children, ...rest }: Props) {
  const { c, scale } = useTheme();
  const spec = SPEC[variant];
  const k = fixed ? 1 : scale;
  return (
    <RNText
      allowFontScaling={false}
      {...rest}
      style={[
        spec,
        {
          color: color ?? (muted ? c.muted : c.ink),
          fontSize: Math.round((spec.fontSize ?? 15) * k),
          lineHeight: Math.round((spec.lineHeight ?? 22) * k),
        },
        center && { textAlign: 'center' },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
