import { useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { useSettings } from '@/store/settings';
import type { NoteColor } from '@/types';

export const ACCENTS = {
  yellow: '#FFD400',
  orange: '#FF6B1A',
  pink: '#FF5CA8',
  mint: '#25D9A0',
  sky: '#3DB8FF',
  violet: '#A068FF',
} as const;
export type AccentKey = keyof typeof ACCENTS;
export type ThemeMode = 'light' | 'dark' | 'system';

export interface Colors {
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  muted: string;
  line: string;
  hairline: string;
  shadow: string;
  primary: string;
  primaryInk: string;
  orange: string;
  danger: string;
  success: string;
  info: string;
  overlay: string;
}

const light = (primary: string): Colors => ({
  bg: '#FFF9E3',
  surface: '#FFFFFF',
  surface2: '#FFF1B8',
  ink: '#111111',
  muted: '#6F6A58',
  line: '#111111',
  hairline: '#E3DCBB',
  shadow: '#111111',
  primary,
  primaryInk: '#111111',
  orange: '#FF6B1A',
  danger: '#E5361F',
  success: '#17B26A',
  info: '#2F7BFF',
  overlay: 'rgba(17,17,17,0.55)',
});

const dark = (primary: string): Colors => ({
  bg: '#101010',
  surface: '#1B1B1B',
  surface2: '#2A2A2A',
  ink: '#FFF6D6',
  muted: '#A39F8C',
  line: '#FFF6D6',
  hairline: '#333333',
  shadow: primary,
  primary,
  primaryInk: '#111111',
  orange: '#FF7A33',
  danger: '#FF5A45',
  success: '#2ED47F',
  info: '#5C9BFF',
  overlay: 'rgba(0,0,0,0.7)',
});

export const NOTE_COLORS: Record<NoteColor, { light: string; dark: string }> = {
  none: { light: '#FFFFFF', dark: '#1B1B1B' },
  yellow: { light: '#FFE45C', dark: '#6B5A00' },
  orange: { light: '#FFB27A', dark: '#7A3A10' },
  pink: { light: '#FFB3D4', dark: '#7A2150' },
  mint: { light: '#9DF2D2', dark: '#0F5E45' },
  sky: { light: '#A8E0FF', dark: '#124E78' },
  violet: { light: '#D2B8FF', dark: '#46257F' },
};

export const FONTS = {
  display: 'ArchivoBlack_400Regular',
  regular: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  bold: 'SpaceGrotesk_700Bold',
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }) as string,
};

export interface Theme {
  c: Colors;
  isDark: boolean;
  accent: AccentKey;
  scale: number;
  fs: (n: number) => number;
  noteBg: (color: NoteColor) => string;
}

export function useTheme(): Theme {
  const mode = useSettings((s) => s.theme);
  const accent = useSettings((s) => s.accent);
  const scale = useSettings((s) => s.fontScale);
  const sys = useColorScheme();
  const isDark = mode === 'system' ? sys === 'dark' : mode === 'dark';
  return useMemo(() => {
    const primary = ACCENTS[accent];
    return {
      c: isDark ? dark(primary) : light(primary),
      isDark,
      accent,
      scale,
      fs: (n: number) => Math.round(n * scale),
      noteBg: (color: NoteColor) => (isDark ? NOTE_COLORS[color].dark : NOTE_COLORS[color].light),
    };
  }, [isDark, accent, scale]);
}

export const RADIUS = { sm: 10, md: 14, lg: 20, xl: 28 };
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
