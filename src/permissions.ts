import { PermissionsAndroid, Platform } from 'react-native';

export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true; // iOS handles prompts automatically

  const perms: string[] = [PermissionsAndroid.PERMISSIONS.CAMERA];

  if (Platform.Version >= 33) {
    perms.push(PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES);
  }

  const res = await PermissionsAndroid.requestMultiple(
    perms as Parameters<typeof PermissionsAndroid.requestMultiple>[0],
  );
  return Object.values(res).every(r => r === 'granted');
}
