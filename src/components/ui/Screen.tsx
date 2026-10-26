import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { IconButton } from './Button';
import { T } from './Text';

export function goBack(fallback: string = '/(tabs)') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}

interface HeaderProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  accentTitle?: boolean;
}

export function Header({ title, subtitle, back = true, onBack, right }: HeaderProps) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>
      {back ? <IconButton icon="arrow-left" label="Back" onPress={onBack ?? (() => goBack())} /> : null}
      <View style={{ flex: 1 }}>
        <T variant="h1" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontSize: 24 }}>
          {title}
        </T>
        {subtitle ? (
          <T variant="small" muted numberOfLines={1} style={{ color: c.muted }}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right ? <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>{right}</View> : null}
    </View>
  );
}

interface ScreenProps {
  children: React.ReactNode;
  header?: HeaderProps;
  scroll?: boolean;
  footer?: React.ReactNode;
  /** Extra bottom padding (e.g. to clear the tab bar). */
  bottomPad?: number;
  contentStyle?: StyleProp<ViewStyle>;
  /** Hide the header's safe-area top inset (for custom full-bleed headers). */
  edgeTop?: boolean;
  bg?: string;
  keyboard?: boolean;
  onScroll?: React.ComponentProps<typeof ScrollView>['onScroll'];
}

export function Screen({ children, header, scroll = true, footer, bottomPad = 24, contentStyle, edgeTop = true, bg, keyboard = true }: ScreenProps) {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: bottomPad }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, paddingHorizontal: 16 }, contentStyle]}>{children}</View>
  );
  const inner = (
    <>
      {body}
      {footer ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12) }}>{footer}</View>
      ) : null}
    </>
  );
  return (
    <View style={{ flex: 1, backgroundColor: bg ?? c.bg, paddingTop: edgeTop ? insets.top : 0 }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {header ? <Header {...header} /> : null}
      {keyboard ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </View>
  );
}
