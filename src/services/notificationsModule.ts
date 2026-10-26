import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Expo from 'expo';
import type * as NotificationsTypes from 'expo-notifications';

export type NotificationsModule = typeof NotificationsTypes;

let cached: NotificationsModule | null | undefined;

const probe = (Expo as unknown as { requireOptionalNativeModule?: (name: string) => unknown }).requireOptionalNativeModule;
/** True when the native push module is missing (probe returns null instead of throwing). */
const pushModuleMissing = (): boolean => (typeof probe === 'function' ? !probe('ExpoTopicSubscriptionModule') : false);

/** True inside the Expo Go app (not in a development build or the released app). */
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Loads expo-notifications lazily and safely.
 *
 * On Android inside Expo Go (SDK 53+) the module cannot be loaded at all: its native push part is missing and
 * merely importing it raises "Cannot find native module 'ExpoTopicSubscriptionModule'". Metro reports that as a
 * fatal red screen instead of a catchable error, so we must not even try to import it there.
 * In that case this returns null and reminders are simply not scheduled. In a development build
 * (`npx expo run:android`) or the released app, notifications work normally.
 */
export function getNotifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  // Android: skip when running in Expo Go OR when the native push module is missing (checked without throwing).
  if (Platform.OS === 'android' && (inExpoGo || pushModuleMissing())) {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = (require('expo-notifications') as NotificationsModule | undefined) ?? null;
  } catch {
    cached = null;
  }
  return cached;
}

export const notificationsAvailable = (): boolean => getNotifications() !== null;
