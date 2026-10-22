import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'secureshare_transfers';
const PROGRESS_ID = 'ss_transfer_progress';

// Show notifications when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowList: true,
  }),
});

export async function setupNotifications(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'File Transfers',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      enableVibrate: false,
      showBadge: false,
    });
  }
  await Notifications.requestPermissionsAsync();
}

function bar(pct: number): string {
  const n = Math.round(pct / 10);
  return '█'.repeat(n) + '░'.repeat(10 - n) + `  ${pct}%`;
}

// Module-level throttle: only update notification every 5%
let _lastPct = -1;

export function resetNotifProgress(): void {
  _lastPct = -1;
}

export async function notifyReceiving(fileName: string, pct: number): Promise<void> {
  if (pct < _lastPct + 5 && pct < 99) return;
  _lastPct = pct;
  await Notifications.scheduleNotificationAsync({
    identifier: PROGRESS_ID,
    content: {
      title: '📥 Receiving...',
      body: `${fileName}\n${bar(pct)}`,
      sticky: true,
      sound: false,
    },
    trigger: null,
  });
}

export async function notifySending(fileName: string, pct: number): Promise<void> {
  if (pct < _lastPct + 5 && pct < 99) return;
  _lastPct = pct;
  await Notifications.scheduleNotificationAsync({
    identifier: PROGRESS_ID,
    content: {
      title: '📤 Sending...',
      body: `${fileName}\n${bar(pct)}`,
      sticky: true,
      sound: false,
    },
    trigger: null,
  });
}

export async function notifyDone(
  direction: 'sent' | 'received',
  fileNames: string[],
): Promise<void> {
  _lastPct = -1;
  await Notifications.dismissNotificationAsync(PROGRESS_ID).catch(() => {});
  const label =
    fileNames.length === 1
      ? fileNames[0]
      : `${fileNames.length} files`;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: direction === 'received' ? '✓ File received' : '✓ File sent',
      body: label,
      sound: false,
    },
    trigger: null,
  });
}

export async function notifyCancelled(): Promise<void> {
  _lastPct = -1;
  await Notifications.dismissNotificationAsync(PROGRESS_ID).catch(() => {});
}
