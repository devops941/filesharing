import { PermissionsAndroid, Platform } from 'react-native';

export async function requestPermissions(_forAction: 'send' | 'receive' = 'send'): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const perms: string[] = [];

  // Location is required for Wi-Fi Direct peer discovery on Android
  perms.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  perms.push(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);

  if (Platform.Version >= 33) {
    perms.push(PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES);
    perms.push('android.permission.POST_NOTIFICATIONS' as any);
  }

  if (perms.length === 0) return true;

  try {
    await PermissionsAndroid.requestMultiple(
      perms as Parameters<typeof PermissionsAndroid.requestMultiple>[0],
    );
  } catch {}

  return true;
}
