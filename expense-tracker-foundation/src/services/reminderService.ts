// The expo-notifications entry registers push-token listeners on import, which throws in Android Expo Go.
// These local-notification modules avoid that side effect.
import { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
import { localFireDate, remindersToSchedule, shouldSchedule } from '../domain/recurring';
import { listRecurring, saveRecurring } from '../repositories/ledgerRepository';
import type { RecurringRow } from '../repositories/types';

try {
  setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // Expo Go can omit the notifications native module. Reminders then stay unscheduled.
}

export async function notificationPermission(): Promise<'granted' | 'denied'> {
  const current = await getPermissionsAsync();
  if (current.granted) return 'granted';
  const requested = await requestPermissionsAsync();
  return requested.granted ? 'granted' : 'denied';
}

export async function syncRecurringNotification(item: RecurringRow, requestPermission = true): Promise<{ scheduled: boolean; reason?: string }> {
  if (item.notificationId) {
    await cancelScheduledNotificationAsync(item.notificationId).catch(() => undefined);
  }
  if (!shouldSchedule(item)) {
    if (item.notificationId) await saveRecurring({ ...item, notificationId: null });
    return { scheduled: false, reason: 'Only confirmed reminders are scheduled.' };
  }
  const current = await getPermissionsAsync();
  const permission = current.granted || !requestPermission ? current : await requestPermissionsAsync();
  if (!permission.granted) return { scheduled: false, reason: 'Notifications are off for this app.' };
  const fireAt = remindersToSchedule([item])[0]?.fireAt;
  if (!fireAt) return { scheduled: false };
  const notificationId = await scheduleNotificationAsync({
    content: {
      title: item.label,
      body: 'A recurring item you confirmed is coming up.',
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DATE,
      date: localFireDate(fireAt),
    },
  });
  await saveRecurring({ ...item, notificationId });
  return { scheduled: true };
}

export async function syncAllReminders(): Promise<void> {
  const current = await getPermissionsAsync();
  if (!current.granted) return;
  const items = await listRecurring();
  for (const item of items) {
    await syncRecurringNotification(item, false);
  }
}
