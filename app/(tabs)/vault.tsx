import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useTheme } from '@/theme';
import { ensureVaultLoaded, useVault } from '@/store/vault';
import { useT } from '@/i18n';
import { copySecret, copyPlain } from '@/services/clipboard';
import { passwordScore } from '@/services/crypto';
import { lockVaultNow, touchVault, unlockVault, useVaultAccess } from '@/services/vaultAccess';
import { Brutal, Chip, ChipRow, EmptyState, Field, Icon, IconButton, T } from '@/components/ui';
import { OfflineBanner } from '@/components/app/Banners';
import { TAB_BAR_SPACE } from '@/components/app/TabBar';
import { VaultLock } from '@/components/app/VaultLock';
import { VAULT_CATEGORIES, VaultAvatar } from '@/components/app/VaultBits';
import type { VaultCategory, VaultItem } from '@/types';

type Filter = 'all' | 'favourite' | VaultCategory;

export default function Vault() {
  const t = useT();
  const { c, isDark, fs } = useTheme();
  const insets = useSafeAreaInsets();
  const { unlocked, pinSet } = useVaultAccess();
  const items = useVault((s) => s.items);
  const loaded = useVault((s) => s.loaded);
  const unreadable = useVault((s) => s.unreadable);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  usePreventScreenCapture('vault-list');

  useEffect(() => {
    if (unlocked) void ensureVaultLoaded();
  }, [unlocked]);

  // Ask for the PIN / fingerprint as soon as the tab is opened.
  useFocusEffect(
    React.useCallback(() => {
      if (pinSet && !unlocked) void unlockVault();
      return undefined;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pinSet]),
  );

  const health = useMemo(() => {
    const seen = new Map<string, number>();
    items.forEach((i) => i.password && seen.set(i.password, (seen.get(i.password) ?? 0) + 1));
    return {
      weak: items.filter((i) => i.password && passwordScore(i.password) < 2).length,
      reused: items.filter((i) => i.password && (seen.get(i.password) ?? 0) > 1).length,
    };
  }, [items]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items
      .filter((i) => (filter === 'all' ? true : filter === 'favourite' ? i.favourite : i.category === filter))
      .filter((i) => !needle || `${i.title} ${i.username} ${i.url}`.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.favourite) - Number(a.favourite) || a.title.localeCompare(b.title));
  }, [items, q, filter]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OfflineBanner />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <T variant="h1">{t('Vault')}</T>
          <T variant="small" muted>
            {unlocked ? t('{n} logins · encrypted', { n: items.length }) : t('Passwords & logins, locked tight')}
          </T>
        </View>
        {unlocked ? (
          <>
            <IconButton icon="lock-outline" label={t('Lock vault')} onPress={lockVaultNow} />
            <IconButton icon="plus" label={t('Add login')} bg={c.primary} color="#111" onPress={() => router.push('/vault/new')} />
          </>
        ) : null}
      </View>

      {!unlocked ? (
        <VaultLock pinSet={pinSet} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: TAB_BAR_SPACE + insets.bottom, gap: 12 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={touchVault}
        >
          {unreadable ? (
            <Brutal bg={c.orange} depth={4} radius={16} contentStyle={{ padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Icon name="alert-outline" size={24} color="#111" />
              <T variant="small" color="#111" style={{ flex: 1 }}>
                {t('The saved vault on this phone could not be unlocked (the secure key was reset). Sign in to your cloud account and sync to restore it.')}
              </T>
            </Brutal>
          ) : null}

          {items.length > 0 ? (
            <>
              <Field value={q} onChangeText={setQ} placeholder={t('Search logins')} icon="magnify" autoCapitalize="none" autoCorrect={false} />
              <ChipRow>
                <Chip label={t('All')} selected={filter === 'all'} onPress={() => setFilter('all')} />
                <Chip label={t('Favourites')} icon="star" selected={filter === 'favourite'} onPress={() => setFilter('favourite')} />
                {VAULT_CATEGORIES.map((x) => (
                  <Chip key={x.key} label={t(x.label)} icon={x.icon} selected={filter === x.key} onPress={() => setFilter(x.key)} />
                ))}
              </ChipRow>
              {health.weak + health.reused > 0 ? (
                <Brutal bg={c.surface2} depth={3} radius={14} contentStyle={{ padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <Icon name="shield-alert-outline" size={22} color={c.ink} />
                  <T variant="small" style={{ flex: 1 }}>
                    {t('Password check: {a} weak · {b} reused', { a: health.weak, b: health.reused })}
                  </T>
                </Brutal>
              ) : null}
            </>
          ) : null}

          {!loaded ? null : items.length === 0 ? (
            <EmptyState
              icon="key-plus"
              title={t('No logins yet')}
              message={t('Save the ID, password and website for any account. Everything is encrypted on this phone.')}
              actionLabel={t('Add your first login')}
              onAction={() => router.push('/vault/new')}
            />
          ) : list.length === 0 ? (
            <EmptyState icon="magnify-close" title={t('No search results')} message={t('Try a different search.')} />
          ) : (
            list.map((i) => <Row key={i.id} item={i} fs={fs} />)
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Row({ item, fs }: { item: VaultItem; fs: (n: number) => number }) {
  const t = useT();
  const { c } = useTheme();
  return (
    <Brutal depth={3} radius={16} onPress={() => router.push(`/vault/${item.id}`)} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
      <VaultAvatar name={item.title || item.url} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T variant="bodyBold" numberOfLines={1} style={{ flexShrink: 1, fontSize: fs(16) }}>
            {item.title || t('Untitled login')}
          </T>
          {item.favourite ? <Icon name="star" size={16} color={c.orange} /> : null}
        </View>
        <T variant="small" muted numberOfLines={1}>
          {item.username || item.url || '—'}
        </T>
      </View>
      {item.username ? (
        <Pressable hitSlop={8} accessibilityLabel={t('Copy username')} onPress={() => void copyPlain(item.username, t('Username'))}>
          <Icon name="account-outline" size={24} color={c.ink} />
        </Pressable>
      ) : null}
      {item.password ? (
        <Pressable hitSlop={8} accessibilityLabel={t('Copy password')} onPress={() => void copySecret(item.password, t('Password'))}>
          <Icon name="key-outline" size={24} color={c.ink} />
        </Pressable>
      ) : null}
    </Brutal>
  );
}
