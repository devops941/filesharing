import { Linking, Platform } from 'react-native';
import TcpSocket from 'react-native-tcp-socket';

/**
 * Checks whether an IP address belongs to a mobile hotspot or direct peer network.
 * Android: 192.168.43.x, 192.168.44.x, 192.168.49.x, 192.168.50.x
 * iOS: 172.20.10.x
 * AOSP / Lineage: 10.42.0.x
 */
export function isHotspotIP(ip?: string | null): boolean {
  if (!ip) return false;
  return (
    ip.startsWith('192.168.43.') ||
    ip.startsWith('192.168.44.') ||
    ip.startsWith('192.168.49.') ||
    ip.startsWith('192.168.50.') ||
    ip.startsWith('172.20.10.') ||
    ip.startsWith('10.42.0.')
  );
}

/**
 * Checks whether an IP address is a private IPv4 LAN address (RFC 1918).
 */
export function isLanIP(ip?: string | null): boolean {
  if (!ip || ip === '127.0.0.1') return false;
  if (ip.startsWith('192.168.') || ip.startsWith('10.')) return true;
  const parts = ip.split('.');
  if (parts[0] === '172') {
    const b = parseInt(parts[1], 10);
    return b >= 16 && b <= 31;
  }
  return false;
}

/**
 * Rapidly detects local device LAN IP by probing standard local gateway / DNS sockets.
 * Does not create server sockets (avoiding native Android event emitter bugs).
 */
export function detectLocalIP(): Promise<string> {
  return new Promise(resolve => {
    let resolved = false;

    function finish(foundIp: string) {
      if (!resolved && foundIp && isLanIP(foundIp)) {
        resolved = true;
        resolve(foundIp);
      }
    }

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve('');
      }
    }, 2500);

    const probeHosts: [string, number][] = [
      ['192.168.49.1', 47800],
      ['192.168.43.1', 47800],
      ['192.168.44.1', 47800],
      ['172.20.10.1', 47800],
      ['10.42.0.1', 47800],
      ['1.1.1.1', 80],
      ['8.8.8.8', 53],
      ['1.1.1.1', 53],
      ['8.8.8.8', 443],
      ['192.168.1.1', 80],
      ['192.168.0.1', 80],
      ['10.0.0.1', 80],
    ];

    for (const [host, port] of probeHosts) {
      try {
        const sock = TcpSocket.createConnection({ host, port }, () => {
          const addr = (sock as any).address?.();
          try { sock.destroy(); } catch {}
          if (addr?.address) finish(addr.address);
        });
        (sock as any).on('error', () => {});
      } catch {}
    }
  });
}

/**
 * Opens Android Tethering & Portable Hotspot settings screen with 1 tap.
 */
export async function openHotspotSettings(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Linking.sendIntent('android.settings.TETHER_SETTINGS');
      return;
    } catch {
      try {
        await Linking.sendIntent('android.settings.WIRELESS_SETTINGS');
        return;
      } catch {
        await Linking.openSettings();
      }
    }
  } else {
    try {
      await Linking.openURL('App-Prefs:root=INTERNET_TETHERING');
    } catch {
      await Linking.openSettings();
    }
  }
}

/**
 * Opens Wi-Fi picker settings screen so user can connect to receiver's hotspot.
 */
export async function openWifiSettings(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Linking.sendIntent('android.settings.WIFI_SETTINGS');
      return;
    } catch {
      await Linking.openSettings();
    }
  } else {
    try {
      await Linking.openURL('App-Prefs:root=WIFI');
    } catch {
      await Linking.openSettings();
    }
  }
}
