import Zeroconf from 'react-native-zeroconf';
import { Platform } from 'react-native';
import TcpSocket from 'react-native-tcp-socket';
import { SERVICE_TYPE, PORT } from '../config';
import { isLanIP, isWifiDirectIP, detectLocalIP } from '../utils/networkSettings';

export type Device = {
  name: string;
  ip: string;
  port: number;
  platform?: string;
  isWifiDirect?: boolean;
  p2pAddress?: string;
  addresses?: string[];
};

const zc = new Zeroconf();
let probeCancelRef = { cancelled: false };

export function startAdvertising(deviceName: string) {
  try {
    zc.unpublishService(deviceName);
  } catch {}
  try {
    zc.publishService(SERVICE_TYPE, 'tcp', 'local.', deviceName, PORT, {
      platform: Platform.OS,
      v: '1',
    });
  } catch (e) {
    console.warn('[Discovery] startAdvertising error:', e);
  }
}

export function stopAdvertising(deviceName: string) {
  try {
    zc.unpublishService(deviceName);
  } catch {}
}

export function startScan(onFound: (d: Device) => void) {
  probeCancelRef.cancelled = true;
  probeCancelRef = { cancelled: false };

  // Remove old listeners before adding new one to prevent accumulation
  zc.removeAllListeners('resolved');
  zc.removeAllListeners('error');
  zc.removeAllListeners('found');
  zc.on('error', () => {
    // Avoid unhandled error crashes from zeroconf
  });

  let mySubnetPrefix = '';
  detectLocalIP().then(myIp => {
    if (myIp && myIp.includes('.')) {
      mySubnetPrefix = myIp.slice(0, myIp.lastIndexOf('.') + 1);
    }
  }).catch(() => {});

  zc.on('resolved', (s: any) => {
    const rawList: string[] = [...(s.addresses || [])];
    if (s.host && typeof s.host === 'string' && !rawList.includes(s.host)) {
      rawList.push(s.host);
    }

    const valid = rawList.filter(
      a =>
        a &&
        typeof a === 'string' &&
        !a.startsWith('127.') &&
        !a.startsWith('169.254.') &&
        a !== '::1' &&
        !a.startsWith('fe80:'),
    );

    // Filter out Wi-Fi Direct virtual IP 192.168.49.x unless local device is also on it
    const lan = valid.filter(a => isLanIP(a) && !isWifiDirectIP(a));

    // Best: same subnet as sender (e.g. 192.168.1.x)
    const sameSubnet = mySubnetPrefix ? lan.find(a => a.startsWith(mySubnetPrefix)) : undefined;
    const ip =
      sameSubnet ??
      lan[0] ??
      valid.find(a => isLanIP(a)) ??
      valid[0];

    if (ip) {
      onFound({
        name: s.name,
        ip,
        port: s.port || PORT,
        platform: s.txt?.platform,
        addresses: valid,
      });
    }
  });

  // Start mDNS zeroconf browse
  try {
    zc.scan(SERVICE_TYPE, 'tcp', 'local.');
  } catch {}

  // Parallel active subnet probe (handles routers with AP isolation or mobile hotspots)
  probeSubnet(onFound, probeCancelRef).catch(() => {});
}

export function stopScan() {
  probeCancelRef.cancelled = true;
  try {
    zc.stop();
  } catch {}
  zc.removeAllListeners('resolved');
  zc.removeAllListeners('error');
  zc.removeAllListeners('found');
}

/**
 * Actively probes the local Wi-Fi / hotspot subnet on PORT.
 * Guarantees discovery between 2 phones even if the router blocks multicast or on mobile hotspots.
 */
async function probeSubnet(
  onFound: (d: Device) => void,
  cancelRef: { cancelled: boolean },
) {
  try {
    const localIp = await detectLocalIP();
    if (!localIp || !localIp.includes('.') || localIp === '127.0.0.1') return;

    const parts = localIp.split('.');
    const subnetPrefix = `${parts[0]}.${parts[1]}.${parts[2]}.`;
    const myLast = parseInt(parts[3], 10);

    // Prioritized candidate list:
    // 1. Hotspot gateway / Router gateway (.1)
    // 2. Immediate neighbors around our IP (.myLast - 10 to .myLast + 10)
    // 3. Common DHCP range (.2 to .40)
    const hostsToProbe = new Set<number>();
    hostsToProbe.add(1);

    for (let i = Math.max(2, myLast - 10); i <= Math.min(254, myLast + 10); i++) {
      if (i !== myLast) hostsToProbe.add(i);
    }
    for (let i = 2; i <= 40; i++) {
      if (i !== myLast) hostsToProbe.add(i);
    }

    const hostList = Array.from(hostsToProbe);
    const BATCH_SIZE = 12;

    for (let b = 0; b < hostList.length; b += BATCH_SIZE) {
      if (cancelRef.cancelled) break;
      const batch = hostList.slice(b, b + BATCH_SIZE);
      await Promise.all(
        batch.map(h => {
          const targetIp = `${subnetPrefix}${h}`;
          return probeIp(targetIp, onFound);
        }),
      );
    }
  } catch {}
}

function probeIp(targetIp: string, onFound: (d: Device) => void): Promise<void> {
  return new Promise(resolve => {
    let resolved = false;
    let client: any = null;

    const done = () => {
      if (resolved) return;
      resolved = true;
      try {
        client?.destroy();
      } catch {}
      resolve();
    };

    const timer = setTimeout(done, 500);

    try {
      client = TcpSocket.createConnection({ host: targetIp, port: PORT }, () => {
        clearTimeout(timer);
        onFound({
          name: `Nearby Device (${targetIp})`,
          ip: targetIp,
          port: PORT,
          addresses: [targetIp],
        });
        done();
      });
      client.setTimeout(500);

      client.on('error', () => {
        clearTimeout(timer);
        done();
      });
      client.on('timeout', () => {
        clearTimeout(timer);
        done();
      });
    } catch {
      clearTimeout(timer);
      done();
    }
  });
}
