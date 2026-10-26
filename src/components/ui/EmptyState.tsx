import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Brutal } from './Brutal';
import { Button } from './Button';
import { Icon } from './Icon';
import { Sticker } from './Controls';
import { T } from './Text';

interface Props {
  icon: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  tone?: 'default' | 'danger' | 'success';
}

export function Illustration({ icon, tone = 'default' }: { icon: string; tone?: 'default' | 'danger' | 'success' }) {
  const { c } = useTheme();
  const main = tone === 'danger' ? c.danger : tone === 'success' ? c.success : c.primary;
  return (
    <View style={{ width: 190, height: 170, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', left: 8, top: 20 }}>
        <Sticker icon="star-four-points" bg={c.orange} size={34} rotate={-12} />
      </View>
      <View style={{ position: 'absolute', right: 6, bottom: 14 }}>
        <Sticker icon="pencil" bg={c.surface} size={38} rotate={10} />
      </View>
      <View style={{ position: 'absolute', right: 20, top: 8 }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c.ink }} />
      </View>
      <View style={{ transform: [{ rotate: '-5deg' }] }}>
        <Brutal bg={main} depth={7} radius={26} contentStyle={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center', flexGrow: 0 }}>
          <Icon name={icon} size={64} color={tone === 'danger' ? '#fff' : '#111'} />
        </Brutal>
      </View>
    </View>
  );
}

export function EmptyState({ icon, title, message, actionLabel, onAction, secondaryLabel, onSecondary, tone }: Props) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 12 }}>
      <Illustration icon={icon} tone={tone} />
      <T variant="h1" center style={{ marginTop: 18 }}>
        {title}
      </T>
      <T variant="body" muted center style={{ marginTop: 8, maxWidth: 300 }}>
        {message}
      </T>
      {actionLabel ? (
        <View style={{ marginTop: 22, alignSelf: 'stretch', gap: 12 }}>
          <Button label={actionLabel} onPress={onAction} />
          {secondaryLabel ? <Button label={secondaryLabel} kind="light" onPress={onSecondary} /> : null}
        </View>
      ) : null}
    </View>
  );
}
