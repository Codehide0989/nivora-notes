import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSettings } from '@/store/settings';
import { useT } from '@/i18n';
import { LogoMark } from '@/components/app/Logo';
import { T } from '@/components/ui';

/** Animated splash: shown for a beat, then routes to onboarding (first run) or the notes tabs. */
export default function Splash() {
  const t = useT();
  const onboarded = useSettings((s) => s.onboarded);
  const { width, height } = useWindowDimensions();
  const pop = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, bounciness: 12, speed: 10 }),
      Animated.timing(rise, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    Animated.timing(bar, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: false }).start();
    const id = setTimeout(() => router.replace(onboarded ? '/(tabs)' : '/onboarding'), 1700);
    return () => clearTimeout(id);
  }, [onboarded, pop, rise, bar]);

  const stripe = (top: number, w: number, color: string, rot: string) => (
    <View style={{ position: 'absolute', top, left: -40, width: w, height: 34, backgroundColor: color, transform: [{ rotate: rot }] }} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFD400', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <StatusBar style="dark" />
      {stripe(height * 0.08, width * 1.4, '#111', '-14deg')}
      {stripe(height * 0.08 + 52, width * 1.2, '#FF6B1A', '-14deg')}
      {stripe(height * 0.86, width * 1.4, '#111', '-14deg')}
      {stripe(height * 0.86 + 52, width * 0.9, '#FF6B1A', '-14deg')}
      <Animated.View style={{ transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }, { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '-4deg'] }) }] }}>
        <LogoMark size={104} />
      </Animated.View>
      <Animated.View style={{ alignItems: 'center', marginTop: 28, opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
        <T variant="display" fixed color="#111" style={{ fontSize: 46, lineHeight: 50 }}>
          Nivora
        </T>
        <T variant="display" fixed color="#111" style={{ fontSize: 46, lineHeight: 50 }}>
          Notes
        </T>
        <View style={{ backgroundColor: '#111', paddingHorizontal: 12, paddingVertical: 5, marginTop: 14, borderRadius: 8, transform: [{ rotate: '-2deg' }] }}>
          <T variant="label" fixed color="#FFD400">
            {t('Write · Plan · Remember')}
          </T>
        </View>
      </Animated.View>
      <View style={{ position: 'absolute', bottom: height * 0.07 + 8, width: width * 0.5, height: 12, borderRadius: 6, borderWidth: 2.5, borderColor: '#111', overflow: 'hidden', backgroundColor: '#FFF3A0' }}>
        <Animated.View style={{ height: '100%', backgroundColor: '#111', width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
      </View>
    </View>
  );
}
