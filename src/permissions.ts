import { PermissionsAndroid, Platform } from 'react-native';

export async function requestPermissions(forAction: 'send' | 'receive' = 'send'): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const perms: string[] = [];
  if (forAction === 'send') {
    perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
  }

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
