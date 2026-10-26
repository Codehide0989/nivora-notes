import React, { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { useT } from '@/i18n';
import { useData, pendingChanges } from '@/store/data';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';
import { useNetwork } from '@/hooks/useNetwork';
import { Brutal, Icon, T } from '@/components/ui';

/** Slim bar shown at the top of the main tabs while offline (or when Offline mode is switched on). */
export function OfflineBanner() {
  const { online, deviceOnline } = useNetwork();
  const forced = useSettings((s) => s.offlineMode);
  const t = useT();
  const { c } = useTheme();
  // re-render when notes change so the pending count stays fresh
  useData((s) => s.notes);
  useData((s) => s.tasks);
  if (online) return null;
  const pending = pendingChanges();
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
      <Brutal
        bg={c.orange}
        depth={3}
        radius={12}
        border={2}
        onPress={() => router.push('/prefs/offline')}
        accessibilityLabel={t('Offline mode')}
        contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 12 }}
      >
        <Icon name="wifi-off" size={18} color="#111" />
        <T variant="small" color="#111" style={{ flex: 1 }} numberOfLines={1}>
          {forced && deviceOnline ? t('Offline mode is on') : t('You’re offline')} · {pending > 0 ? t('{n} changes waiting', { n: pending }) : t('Everything is saved on this device')}
        </T>
        <Icon name="chevron-right" size={18} color="#111" />
      </Brutal>
    </View>
  );
}

/** Covers the UI in the app switcher so locked notes never leak into the recents preview. */
export function PrivacyCover() {
  const hide = useSettings((s) => s.hideContentInSwitcher);
  const pinSet = useSession((s) => s.pinSet);
  const [covered, setCovered] = useState(false);
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setCovered(s !== 'active'));
    return () => sub.remove();
  }, []);
  if (!hide || !pinSet || !covered) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 3000, backgroundColor: isDark ? c.bg : c.primary, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top }}
    >
      <T variant="display" fixed color={isDark ? c.primary : '#111'} style={{ fontSize: 40 }}>
        Nivora
      </T>
      <T variant="display" fixed color={isDark ? c.primary : '#111'} style={{ fontSize: 40 }}>
        Notes
      </T>
    </View>
  );
}
