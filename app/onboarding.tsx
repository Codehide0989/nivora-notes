import React, { useRef, useState } from 'react';
import { Animated, FlatList, Pressable, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { useT } from '@/i18n';
import { haptic } from '@/services/haptics';
import { Brutal, Button, Icon, Sticker, T } from '@/components/ui';

interface Slide {
  key: string;
  icon: string;
  tint: 'primary' | 'orange' | 'mint';
  title: string;
  text: string;
  stickers: [string, string];
}

function Art({ slide }: { slide: Slide }) {
  const { c } = useTheme();
  const bg = slide.tint === 'primary' ? c.primary : slide.tint === 'orange' ? c.orange : '#25D9A0';
  return (
    <View style={{ width: 260, height: 260, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', left: 6, top: 18 }}>
        <Sticker icon={slide.stickers[0]} bg={c.surface} size={54} rotate={-12} />
      </View>
      <View style={{ position: 'absolute', right: 4, bottom: 22 }}>
        <Sticker icon={slide.stickers[1]} bg={c.orange} size={58} rotate={10} />
      </View>
      <View style={{ position: 'absolute', right: 30, top: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: c.ink }} />
      <View style={{ transform: [{ rotate: '-5deg' }] }}>
        <Brutal bg={bg} depth={9} radius={36} border={4} contentStyle={{ width: 170, height: 170, alignItems: 'center', justifyContent: 'center', flexGrow: 0 }}>
          <Icon name={slide.icon} size={96} color="#111" />
        </Brutal>
      </View>
    </View>
  );
}

export default function Onboarding() {
  const t = useT();
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const slides: Slide[] = [
    { key: 'ideas', icon: 'lightbulb-on', tint: 'primary', title: t('Your ideas start here'), text: t('Capture notes, checklists, photos and voice memos the moment inspiration strikes.'), stickers: ['pencil', 'star-four-points'] },
    { key: 'organise', icon: 'folder-star', tint: 'orange', title: t('Organise everything'), text: t('Categories, colours and pins keep every note exactly where you expect it.'), stickers: ['tag-outline', 'palette-outline'] },
    { key: 'safe', icon: 'shield-lock', tint: 'mint', title: t('Private & always with you'), text: t('Lock notes with a PIN or fingerprint, and keep working fully offline.'), stickers: ['fingerprint', 'cloud-check-outline'] },
  ];

  const last = index === slides.length - 1;
  const next = () => {
    haptic('light');
    if (last) router.push('/setup');
    else listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 }}>
        <T variant="caps" fixed>
          Nivora Notes
        </T>
        {!last ? (
          <Pressable onPress={() => router.push('/setup')} hitSlop={12} accessibilityRole="button">
            <T variant="caps" muted fixed>
              {t('Skip')}
            </T>
          </Pressable>
        ) : (
          <View />
        )}
      </View>
      <Animated.FlatList
        ref={listRef as never}
        data={slides}
        keyExtractor={(s: Slide) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e: { nativeEvent: { contentOffset: { x: number } } }) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }: { item: Slide }) => (
          <View style={{ width, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
            <Art slide={item} />
            <T variant="display" center style={{ marginTop: 28 }}>
              {item.title}
            </T>
            <T variant="body" muted center style={{ marginTop: 12, maxWidth: 320 }}>
              {item.text}
            </T>
          </View>
        )}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
        {slides.map((s, i) => {
          const w = scrollX.interpolate({ inputRange: [(i - 1) * width, i * width, (i + 1) * width], outputRange: [12, 34, 12], extrapolate: 'clamp' });
          return <Animated.View key={s.key} style={{ width: w, height: 12, borderRadius: 6, borderWidth: 2.5, borderColor: c.line, backgroundColor: i === index ? c.primary : c.surface }} />;
        })}
      </View>
      <View style={{ paddingHorizontal: 20 }}>
        <Button label={last ? t('Get started') : t('Next')} iconRight="arrow-right" onPress={next} />
      </View>
    </View>
  );
}
