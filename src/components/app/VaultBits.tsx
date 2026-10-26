import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { T } from '@/components/ui';
import type { VaultCategory } from '@/types';

export const VAULT_CATEGORIES: { key: VaultCategory; label: string; icon: string }[] = [
  { key: 'social', label: 'Social', icon: 'account-group-outline' },
  { key: 'email', label: 'Email', icon: 'email-outline' },
  { key: 'banking', label: 'Banking', icon: 'bank-outline' },
  { key: 'shopping', label: 'Shopping', icon: 'cart-outline' },
  { key: 'work', label: 'Work', icon: 'briefcase-outline' },
  { key: 'other', label: 'Other', icon: 'dots-horizontal' },
];

const PALETTE = ['#FFD400', '#FF6B1A', '#FF5CA8', '#25D9A0', '#3DB8FF', '#A068FF'];

/** Letter avatar. No network requests: the vault never leaks which sites you use. */
export function VaultAvatar({ name, size = 46 }: { name: string; size?: number }) {
  const { c } = useTheme();
  const clean = name.replace(/^https?:\/\/(www\.)?/i, '').trim();
  let h = 0;
  for (let i = 0; i < clean.length; i += 1) h = (h * 31 + clean.charCodeAt(i)) >>> 0;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 3, borderWidth: 2.5, borderColor: c.line, backgroundColor: PALETTE[h % PALETTE.length], alignItems: 'center', justifyContent: 'center' }}>
      <T variant="h2" color="#111" fixed style={{ fontSize: size * 0.46 }}>
        {(clean[0] ?? '?').toUpperCase()}
      </T>
    </View>
  );
}

export function normaliseUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
}

