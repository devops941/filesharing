import { PermissionsAndroid, Platform } from 'react-native';

/**
 * BUG-11 FIX: Previously always returned true regardless of actual grant status.
 * Now returns true only if all critical permissions are granted (or on iOS).
 * Also adds READ_MEDIA_* permissions for Android 13+ to allow file reading.
 */
export async function requestPermissions(_forAction: 'send' | 'receive' = 'send'): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const perms: string[] = [];

  // Location is required for Wi-Fi Direct peer discovery on Android < 13
  perms.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  perms.push(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);

  if (Platform.Version >= 33) {
    // Android 13+: NEARBY_WIFI_DEVICES replaces location for Wi-Fi Direct
    perms.push(PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES);
    perms.push('android.permission.POST_NOTIFICATIONS' as any);
    // Android 13+: Fine-grained media permissions for file reading
    perms.push('android.permission.READ_MEDIA_IMAGES' as any);
    perms.push('android.permission.READ_MEDIA_VIDEO' as any);
    perms.push('android.permission.READ_MEDIA_AUDIO' as any);
  }

  if (perms.length === 0) return true;

  try {
    const results = await PermissionsAndroid.requestMultiple(
      perms as Parameters<typeof PermissionsAndroid.requestMultiple>[0],
    );

    // Check that the critical networking permissions are granted.
    // Use a typed array of known PermissionsAndroid.PERMISSIONS values so the
    // results lookup stays within the union type (avoids the 'any' index error).
    type AndroidPermission = Parameters<typeof PermissionsAndroid.requestMultiple>[0][number];

    const fineLoc = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const coarseLoc = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
    const locationGranted =
      results[fineLoc as keyof typeof results] === PermissionsAndroid.RESULTS.GRANTED ||
      results[coarseLoc as keyof typeof results] === PermissionsAndroid.RESULTS.GRANTED;

    if (Platform.Version >= 33) {
      // Android 13+: NEARBY_WIFI_DEVICES replaces location for Wi-Fi Direct peer discovery.
      // If NEARBY_WIFI_DEVICES is granted, location is not strictly required.
      const nearbyKey = PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES as unknown as AndroidPermission;
      const nearbyGranted = results[nearbyKey as keyof typeof results] === PermissionsAndroid.RESULTS.GRANTED;
      return nearbyGranted || locationGranted;
    }

    return locationGranted;
  } catch {
    return false;
  }
}
