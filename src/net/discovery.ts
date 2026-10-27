import Zeroconf from 'react-native-zeroconf';
import { Platform } from 'react-native';
import { SERVICE_TYPE, PORT } from '../config';

export type Device = {
  name: string;
  ip: string;
  port: number;
  platform?: string;
  isWifiDirect?: boolean;
  p2pAddress?: string;
};

const zc = new Zeroconf();

export function startAdvertising(deviceName: string) {
  try {
    zc.unpublishService(deviceName);
  } catch {}
  zc.publishService(SERVICE_TYPE, 'tcp', 'local.', deviceName, PORT, {
    platform: Platform.OS,
    v: '1',
  });
}

export function stopAdvertising(deviceName: string) {
  try {
    zc.unpublishService(deviceName);
  } catch {}
}

export function startScan(onFound: (d: Device) => void) {
  // Remove old listeners before adding new one to prevent accumulation
  zc.removeAllListeners('resolved');
  zc.removeAllListeners('error');
  zc.on('error', () => {
    // Avoid unhandled error crashes from zeroconf
  });
  zc.on('resolved', (s: any) => {
    const ip = s.addresses?.find((a: string) => a.includes('.')) ??
      s.addresses?.find((a: string) => a.includes(':'));
    if (ip) {
      onFound({
        name: s.name,
        ip,
        port: s.port || PORT,
        platform: s.txt?.platform,
      });
    }
  });
  try {
    zc.scan(SERVICE_TYPE, 'tcp', 'local.');
  } catch {}
}

export function stopScan() {
  try {
    zc.stop();
  } catch {}
  zc.removeAllListeners('resolved');
  zc.removeAllListeners('error');
}
