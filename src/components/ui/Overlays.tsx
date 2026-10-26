import React, { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { useT } from '@/i18n';
import { useUi } from '@/store/ui';
import { Brutal } from './Brutal';
import { Button } from './Button';
import { Icon } from './Icon';
import { T } from './Text';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeightRatio?: number;
}

export function Sheet({ visible, onClose, title, children, maxHeightRatio = 0.85 }: SheetProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const p = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(p, { toValue: 1, useNativeDriver: true, bounciness: 3, speed: 16 }).start();
    } else {
      Animated.timing(p, { toValue: 0, duration: 170, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, p]);

  if (!mounted) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay, opacity: p }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <KeyboardAvoidingView
        pointerEvents="box-none"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <Animated.View
          style={{
            transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) }],
            backgroundColor: c.surface,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            borderWidth: 2.5,
            borderBottomWidth: 0,
            borderColor: c.line,
            paddingBottom: Math.max(insets.bottom, 16),
            maxHeight: `${Math.round(maxHeightRatio * 100)}%`,
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            <View style={{ width: 46, height: 5, borderRadius: 3, backgroundColor: c.line, opacity: 0.35 }} />
          </View>
          {title ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4 }}>
              <T variant="h2">{title}</T>
            </View>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface DialogProps {
  visible: boolean;
  title: string;
  message?: string;
  icon?: string;
  danger?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

export function Dialog({ visible, title, message, icon, danger, confirmLabel, cancelLabel, loading, onConfirm, onCancel, children }: DialogProps) {
  const { c, isDark } = useTheme();
  const t = useT();
  const bg = isDark ? c.surface : '#111111';
  const fg = '#FFF8E1';
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: c.overlay, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Brutal bg={bg} depth={6} radius={24} style={{ width: '100%', maxWidth: 380 }} contentStyle={{ padding: 22 }}>
          {icon ? (
            <View
              style={{
                width: 58,
                height: 58,
                borderRadius: 18,
                backgroundColor: danger ? c.danger : c.primary,
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'center',
                marginBottom: 14,
                borderWidth: 2.5,
                borderColor: '#FFF8E1',
              }}
            >
              <Icon name={icon} size={30} color={danger ? '#fff' : '#111'} />
            </View>
          ) : null}
          <T variant="h2" color={fg} center>
            {title}
          </T>
          {message ? (
            <T variant="body" color="#CFC8A8" center style={{ marginTop: 8 }}>
              {message}
            </T>
          ) : null}
          {children}
          <View style={{ marginTop: 20, gap: 12 }}>
            <Button label={confirmLabel ?? t('Confirm')} kind={danger ? 'danger' : 'primary'} onPress={onConfirm} loading={loading} />
            <Button label={cancelLabel ?? t('Cancel')} kind="light" onPress={onCancel} disabled={loading} />
          </View>
        </Brutal>
      </View>
    </Modal>
  );
}

function ToastView({ id, message, tone, actionLabel, onAction }: { id: string; message: string; tone: 'default' | 'success' | 'error'; actionLabel?: string; onAction?: () => void }) {
  const { c } = useTheme();
  const dismiss = useUi((s) => s.dismiss);
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: 1, useNativeDriver: true, bounciness: 6 }).start();
    const timer = setTimeout(() => {
      Animated.timing(a, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => dismiss(id));
    }, actionLabel ? 5000 : 3000);
    return () => clearTimeout(timer);
  }, [a, dismiss, id, actionLabel]);
  const bg = tone === 'success' ? c.success : tone === 'error' ? c.danger : '#111111';
  const fg = tone === 'default' ? '#FFF8E1' : '#111111';
  return (
    <Animated.View
      style={{
        opacity: a,
        transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
        marginTop: 8,
      }}
    >
      <Brutal bg={bg} depth={3} radius={14} border={2} contentStyle={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 12 }}>
        <Icon name={tone === 'error' ? 'alert-circle' : tone === 'success' ? 'check-circle' : 'information'} size={20} color={fg} />
        <T variant="bodyBold" color={fg} style={{ flex: 1 }} numberOfLines={2}>
          {message}
        </T>
        {actionLabel ? (
          <Pressable
            onPress={() => {
              onAction?.();
              dismiss(id);
            }}
            hitSlop={10}
          >
            <T variant="caps" color={tone === 'default' ? c.primary : '#111'}>
              {actionLabel}
            </T>
          </Pressable>
        ) : null}
      </Brutal>
    </Animated.View>
  );
}

export function ToastHost() {
  const toasts = useUi((s) => s.toasts);
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 92, zIndex: 999 }}>
      {toasts.map((t) => (
        <ToastView key={t.id} {...t} />
      ))}
    </View>
  );
}
