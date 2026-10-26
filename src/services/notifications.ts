import { Platform } from 'react-native';
import type * as NotificationsTypes from 'expo-notifications';
import { getNotifications } from '@/services/notificationsModule';
import { router } from 'expo-router';
import { useData } from '@/store/data';
import { useSettings } from '@/store/settings';
import type { Reminder } from '@/types';

const CHANNELS = {
  sv: { id: 'reminders-sound-vibe', sound: true, vibrate: true },
  s: { id: 'reminders-sound', sound: true, vibrate: false },
  v: { id: 'reminders-vibe', sound: false, vibrate: true },
  q: { id: 'reminders-quiet', sound: false, vibrate: false },
};

function channelId(): string {
  const { notifySound, notifyVibrate } = useSettings.getState();
  if (notifySound && notifyVibrate) return CHANNELS.sv.id;
  if (notifySound) return CHANNELS.s.id;
  if (notifyVibrate) return CHANNELS.v.id;
  return CHANNELS.q.id;
}

let configured = false;

export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;
  const Notifications = getNotifications();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: useSettings.getState().notifySound,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    for (const ch of Object.values(CHANNELS)) {
      await Notifications.setNotificationChannelAsync(ch.id, {
        name: `Reminders${ch.sound ? ' · sound' : ''}${ch.vibrate ? ' · vibration' : ''}`,
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: ch.vibrate ? [0, 250, 200, 250] : undefined,
        sound: ch.sound ? 'default' : undefined,
        lightColor: '#FFD400',
      });
    }
  }
  try {
    await Notifications.setNotificationCategoryAsync('reminder', [
      { identifier: 'snooze', buttonTitle: 'Snooze 10 min', options: { opensAppToForeground: false } },
      { identifier: 'done', buttonTitle: 'Mark done', options: { opensAppToForeground: false } },
    ]);
  } catch {
    /* categories unsupported on this platform */
  }
}

export async function permissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const Notifications = getNotifications();
  if (!Notifications) return 'denied';
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

export async function ensurePermission(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return true;
  if (!p.canAskAgain) return false;
  const r = await Notifications.requestPermissionsAsync();
  return r.granted;
}

type Trigger = NotificationsTypes.NotificationTriggerInput;

function triggerFor(r: Pick<Reminder, 'at' | 'repeat'>): Trigger | null {
  const Notifications = getNotifications();
  if (!Notifications) return null;
  const d = new Date(r.at);
  const T = Notifications.SchedulableTriggerInputTypes;
  const ch = Platform.OS === 'android' ? { channelId: channelId() } : {};
  switch (r.repeat) {
    case 'daily':
      return { type: T.DAILY, hour: d.getHours(), minute: d.getMinutes(), ...ch } as Trigger;
    case 'weekly':
      return { type: T.WEEKLY, weekday: d.getDay() + 1, hour: d.getHours(), minute: d.getMinutes(), ...ch } as Trigger;
    case 'monthly':
      return { type: T.MONTHLY, day: d.getDate(), hour: d.getHours(), minute: d.getMinutes(), ...ch } as Trigger;
    default:
      if (r.at <= Date.now() + 1000) return null;
      return { type: T.DATE, date: d, ...ch } as Trigger;
  }
}

export async function cancelNotification(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await getNotifications()?.cancelScheduledNotificationAsync(id);
  } catch {
    /* nothing scheduled */
  }
}

/** (Re)schedule the OS notification for a reminder. Returns the new notification id, or null if none is needed. */
export async function scheduleReminder(r: Reminder): Promise<string | null> {
  await cancelNotification(r.notificationId);
  const { notificationsEnabled, notifySound } = useSettings.getState();
  if (!notificationsEnabled || r.done) return null;
  const trigger = triggerFor(r);
  if (!trigger) return null;
  if (!(await ensurePermission())) return null;
  await configureNotifications();
  const Notifications = getNotifications();
  if (!Notifications) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: r.title || 'Reminder',
        body: r.notes || 'Tap to open in Nivora Notes',
        sound: notifySound,
        categoryIdentifier: 'reminder',
        data: { reminderId: r.id },
      },
      trigger,
    });
  } catch {
    return null;
  }
}

export async function rescheduleAll(): Promise<void> {
  const { reminders, updateReminder } = useData.getState();
  for (const r of reminders) {
    const id = await scheduleReminder(r);
    if (id !== r.notificationId) updateReminder(r.id, { notificationId: id });
  }
}

export async function cancelAllReminders(): Promise<void> {
  try {
    await getNotifications()?.cancelAllScheduledNotificationsAsync();
  } catch {
    /* ignore */
  }
}

export async function scheduleDailySummary(hour: number, minute: number): Promise<string | null> {
  const { dailySummaryId, set } = useSettings.getState();
  await cancelNotification(dailySummaryId);
  if (!(await ensurePermission())) {
    set({ dailySummaryId: null });
    return null;
  }
  await configureNotifications();
  const Notifications = getNotifications();
  if (!Notifications) {
    set({ dailySummaryId: null });
    return null;
  }
  const T = Notifications.SchedulableTriggerInputTypes;
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Plan your day',
      body: 'Open Nivora Notes to review today’s tasks and reminders.',
      sound: useSettings.getState().notifySound,
    },
    trigger: {
      type: T.DAILY,
      hour,
      minute,
      ...(Platform.OS === 'android' ? { channelId: channelId() } : {}),
    } as Trigger,
  });
  set({ dailySummaryId: id });
  return id;
}

export async function cancelDailySummary(): Promise<void> {
  const { dailySummaryId, set } = useSettings.getState();
  await cancelNotification(dailySummaryId);
  set({ dailySummaryId: null });
}

const handled = new Set<string>();

async function handleResponse(resp: NotificationsTypes.NotificationResponse): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  const key = `${resp.notification.request.identifier}:${resp.actionIdentifier}:${resp.notification.date}`;
  if (handled.has(key)) return;
  handled.add(key);
  const id = resp.notification.request.content.data?.reminderId as string | undefined;
  if (!id) return;
  const { reminders, updateReminder } = useData.getState();
  const rem = reminders.find((r) => r.id === id);
  if (!rem) return;
  if (resp.actionIdentifier === 'snooze') {
    const T = Notifications.SchedulableTriggerInputTypes;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: rem.title || 'Reminder',
        body: rem.notes || 'Snoozed reminder',
        categoryIdentifier: 'reminder',
        data: { reminderId: rem.id },
      },
      trigger: {
        type: T.DATE,
        date: new Date(Date.now() + 10 * 60_000),
        ...(Platform.OS === 'android' ? { channelId: channelId() } : {}),
      } as Trigger,
    });
    return;
  }
  if (resp.actionIdentifier === 'done') {
    if (rem.repeat === 'none') updateReminder(id, { done: true, notificationId: null });
    return;
  }
  if (resp.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
    router.push(`/reminder/${id}`);
  }
}

export function attachResponseListener(): () => void {
  const Notifications = getNotifications();
  if (!Notifications) return () => undefined;
  const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
    void handleResponse(resp);
  });
  try {
    // Sync in newer SDKs, a Promise in older ones — Promise.resolve handles both.
    Promise.resolve(Notifications.getLastNotificationResponse())
      .then((last) => (last ? handleResponse(last) : undefined))
      .catch(() => undefined);
  } catch {
    /* not available */
  }
  return () => sub.remove();
}

/** Fires a sample notification in 3 seconds (used by Settings → Notifications → Send test). */
export async function sendTestNotification(title: string, body: string): Promise<boolean> {
  if (!(await ensurePermission())) return false;
  await configureNotifications();
  const Notifications = getNotifications();
  if (!Notifications) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: useSettings.getState().notifySound },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
      ...(Platform.OS === 'android' ? { channelId: channelId() } : {}),
    } as Trigger,
  });
  return true;
}
