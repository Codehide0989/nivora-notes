import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useT } from '@/i18n';
import { unlockVault } from '@/services/vaultAccess';
import { EmptyState } from '@/components/ui';

/** Shown instead of vault content until the user passes the PIN / biometric check. */
export function VaultLock({ pinSet }: { pinSet: boolean }) {
  const t = useT();
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      {pinSet ? (
        <EmptyState
          icon="shield-lock-outline"
          title={t('Your vault is locked')}
          message={t('Passwords are protected by your PIN or fingerprint every time you open them.')}
          actionLabel={t('Unlock vault')}
          onAction={() => void unlockVault()}
        />
      ) : (
        <EmptyState
          icon="shield-key-outline"
          title={t('Create a PIN first')}
          message={t('The vault stores passwords, so it needs a PIN (and optional fingerprint) to keep them safe.')}
          actionLabel={t('Create PIN')}
          onAction={() => router.push('/prefs/pin?mode=create')}
        />
      )}
    </View>
  );
}
