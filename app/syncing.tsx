import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { useData } from '@/store/data';
import { toast } from '@/store/ui';
import { useT } from '@/i18n';
import { runSync, SyncError } from '@/services/sync';
import { Brutal, Icon, ProgressBar, Screen, T } from '@/components/ui';

export default function Syncing() {
  const t = useT();
  const { c } = useTheme();
  const spin = useRef(new Animated.Value(0)).current;
  const [step, setStep] = useState({ fraction: 0, label: '' });
  const notes = useData((d) => d.notes.length);
  const tasks = useData((d) => d.tasks.length);
  const started = useRef(false);

  useEffect(() => {
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true })).start();
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const res = await runSync(setStep);
        router.replace(`/status/sync-complete?count=${res.pushed}`);
      } catch (e) {
        if (e instanceof SyncError && e.code === 'auth') {
          toast.error(e.message);
          router.replace('/prefs/account');
          return;
        }
        if (e instanceof SyncError && e.code === 'offline') router.replace('/status/sync-failed');
        else router.replace(`/status/sync-failed?detail=${encodeURIComponent(e instanceof Error ? e.message : '')}`);
      }
    })();
  }, [spin]);

  return (
    <Screen scroll={false} contentStyle={{ justifyContent: 'center' }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24 }}>
        <Brutal bg={c.primary} depth={8} radius={40} border={4} contentStyle={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center', flexGrow: 0 }}>
          <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
            <Icon name="sync" size={80} color="#111" />
          </Animated.View>
        </Brutal>
        <T variant="display" center>
          {t('Syncing notes')}
        </T>
        <T variant="body" muted center>
          {step.label || t('Getting started…')}
        </T>
        <View style={{ alignSelf: 'stretch' }}>
          <ProgressBar value={step.fraction} height={22} />
        </View>
        <T variant="label" muted>
          {t('{a} notes · {b} tasks', { a: notes, b: tasks })}
        </T>
      </View>
    </Screen>
  );
}
