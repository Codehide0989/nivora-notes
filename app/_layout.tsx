import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
import { SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { useData } from '@/store/data';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';
import { useCloud } from '@/store/cloud';
import { attachResponseListener } from '@/services/notifications';
import { bootApp, watchAppState } from '@/services/boot';
import { ToastHost } from '@/components/ui';
import { LockScreen } from '@/components/app/LockScreen';
import { PinPrompt } from '@/components/app/PinPrompt';
import { PrivacyCover } from '@/components/app/Banners';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Shell() {
  const { c } = useTheme();
  useEffect(() => attachResponseListener(), []);
  useEffect(() => watchAppState(), []);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="setup" />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="voice" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="syncing" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="status/[kind]" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack>
      <ToastHost />
      <PinPrompt />
      <LockScreen />
      <PrivacyCover />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ArchivoBlack_400Regular,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });
  const settingsReady = useSettings((s) => s.hydrated);
  const dataReady = useData((s) => s.hydrated);
  const cloudReady = useCloud((s) => s.hydrated);
  const booted = useSession((s) => s.ready);

  useEffect(() => {
    if (settingsReady && dataReady && cloudReady) void bootApp();
  }, [settingsReady, dataReady, cloudReady]);

  const ready = (fontsLoaded || !!fontError) && settingsReady && dataReady && cloudReady && booted;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}
