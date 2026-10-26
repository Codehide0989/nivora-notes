import React from 'react';
import { Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { useT } from '@/i18n';
import { resolveGate, useGate } from '@/services/gate';
import { Button, Icon, T } from '@/components/ui';
import { PinEntry } from './PinEntry';

/** Modal PIN pad used to open locked notes and other protected actions. */
export function PinPrompt() {
  const { open, reason } = useGate();
  const { c } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} animationType="slide" onRequestClose={() => resolveGate(false)} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16, alignItems: 'center' }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 22,
            backgroundColor: c.primary,
            borderWidth: 3,
            borderColor: c.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="lock" size={36} color="#111" />
        </View>
        <T variant="h1" center style={{ marginTop: 18 }}>
          {t('Locked')}
        </T>
        <T variant="body" muted center style={{ marginTop: 6, paddingHorizontal: 32 }}>
          {reason}
        </T>
        <View style={{ flex: 1, justifyContent: 'center' }}>{open ? <PinEntry onSuccess={() => resolveGate(true)} resetKey={reason} /> : null}</View>
        <View style={{ alignSelf: 'stretch', paddingHorizontal: 20 }}>
          <Button label={t('Cancel')} kind="light" onPress={() => resolveGate(false)} />
        </View>
      </View>
    </Modal>
  );
}
