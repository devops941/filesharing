import Zeroconf from 'react-native-zeroconf';
import { Platform } from 'react-native';
import { SERVICE_TYPE, PORT } from '../config';

export type Device = {
  name: string;
  ip: string;
  port: number;
  platform?: string;
};

const zc = new Zeroconf();

export function startAdvertising(deviceName: string) {
  zc.publishService(SERVICE_TYPE, 'tcp', 'local.', deviceName, PORT, {
    platform: Platform.OS,
    v: '1',
  });
}

export function stopAdvertising(deviceName: string) {
  zc.unpublishService(deviceName);
}

export function startScan(onFound: (d: Device) => void) {
  // Remove old listeners before adding new one to prevent accumulation
  zc.removeAllListeners('resolved');
  zc.on('resolved', (s: any) => {
    const ip = s.addresses?.find((a: string) => a.includes('.'));
    if (ip) {
      onFound({
        name: s.name,
        ip,
        port: s.port,
        platform: s.txt?.platform,
      });
    }
  });
  zc.scan(SERVICE_TYPE, 'tcp', 'local.');
}

export function stopScan() {
  zc.stop();
  zc.removeAllListeners('resolved');
}
