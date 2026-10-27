import { NativeModules, DeviceEventEmitter, Platform } from 'react-native';
import type { EmitterSubscription } from 'react-native';

const P2pNative = NativeModules.WifiP2pModule;

export type WifiP2pDevice = {
  deviceName: string;
  deviceAddress: string;
  primaryDeviceType?: string;
  status: number;
};

export type WifiP2pInfo = {
  isConnected: boolean;
  isGroupOwner: boolean;
  groupOwnerAddress?: { hostAddress?: string } | string;
  groupFormed?: boolean;
};

function normalizeInfo(info: any): WifiP2pInfo {
  const host =
    typeof info?.groupOwnerAddress === 'string'
      ? info.groupOwnerAddress
      : info?.groupOwnerAddress?.hostAddress ?? '';
  const connected = !!(info?.isConnected || info?.groupFormed);
  return {
    isConnected: connected,
    groupFormed: connected,
    isGroupOwner: !!info?.isGroupOwner,
    groupOwnerAddress: { hostAddress: host },
  };
}

export async function initWifiDirect(): Promise<boolean> {
  if (Platform.OS !== 'android' || !P2pNative) return false;
  try {
    if (P2pNative.isSupported) {
      const ok = await P2pNative.isSupported();
      return !!ok;
    }
    return true;
  } catch {
    return false;
  }
}

export async function startP2pDiscovery(): Promise<void> {
  if (Platform.OS !== 'android' || !P2pNative) return;
  try {
    await P2pNative.discoverPeers();
  } catch (e) {
    console.warn('[WifiDirect] startDiscovery:', e);
  }
}

export async function stopP2pDiscovery(): Promise<void> {
  if (Platform.OS !== 'android' || !P2pNative) return;
  try {
    await P2pNative.stopPeerDiscovery();
  } catch {}
}

export function subscribeP2pPeers(
  cb: (devices: WifiP2pDevice[]) => void,
): EmitterSubscription | null {
  if (Platform.OS !== 'android' || !P2pNative) return null;

  const sub = DeviceEventEmitter.addListener(
    'onPeersChanged',
    (data: { devices?: WifiP2pDevice[] }) => {
      if (Array.isArray(data?.devices)) {
        cb(data.devices);
      }
    },
  );

  // Initial check immediately
  if (P2pNative.getPeers) {
    P2pNative.getPeers().then((devices: WifiP2pDevice[]) => {
      if (Array.isArray(devices) && devices.length > 0) {
        cb(devices);
      }
    }).catch(() => {});
  }

  return sub;
}

export function subscribeP2pConnection(
  cb: (info: WifiP2pInfo) => void,
): EmitterSubscription | null {
  if (Platform.OS !== 'android' || !P2pNative) return null;
  return DeviceEventEmitter.addListener('onConnectionChanged', info => {
    cb(normalizeInfo(info));
  });
}

export async function connectP2pPeer(deviceAddress: string): Promise<void> {
  if (Platform.OS !== 'android' || !P2pNative) return;
  try {
    await P2pNative.stopPeerDiscovery();
  } catch {}
  await P2pNative.connect(deviceAddress);
}

export async function cancelP2pConnect(): Promise<void> {
  if (Platform.OS !== 'android' || !P2pNative) return;
  try {
    await P2pNative.cancelConnect();
  } catch {}
}

export function waitForGroupOwnerIP(timeoutMs = 20000): Promise<string> {
  return new Promise((resolve, reject) => {
    let sub: EmitterSubscription | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let resolved = false;

    function cleanup() {
      resolved = true;
      clearTimeout(timer);
      if (pollTimer) clearInterval(pollTimer);
      sub?.remove();
    }

    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          'WiFi Direct connection timed out. Make sure Wi-Fi & Location are ON and accept any connection prompt on the other phone.',
        ),
      );
    }, timeoutMs);

    function tryResolve(info: WifiP2pInfo) {
      if (resolved) return;
      const ip =
        typeof info?.groupOwnerAddress === 'string'
          ? info.groupOwnerAddress
          : info?.groupOwnerAddress?.hostAddress;
      if (info?.groupFormed && ip && ip !== '0.0.0.0') {
        cleanup();
        resolve(ip);
      }
    }

    sub = subscribeP2pConnection(tryResolve);

    // Active polling fallback every 500ms
    pollTimer = setInterval(() => {
      if (resolved) return;
      getConnectionInfo()
        .then(tryResolve)
        .catch(() => {});
    }, 500);

    getConnectionInfo()
      .then(tryResolve)
      .catch(() => {});
  });
}

export async function getConnectionInfo(): Promise<WifiP2pInfo> {
  if (Platform.OS !== 'android' || !P2pNative) {
    return { isConnected: false, isGroupOwner: false, groupFormed: false };
  }
  try {
    const raw = await P2pNative.getConnectionInfo();
    return normalizeInfo(raw);
  } catch {
    return { isConnected: false, isGroupOwner: false, groupFormed: false };
  }
}

export async function createP2pGroup(): Promise<boolean> {
  if (Platform.OS !== 'android' || !P2pNative) return false;
  try {
    await P2pNative.createGroup();
    return true;
  } catch (e) {
    console.warn('[WifiDirect] createGroup error:', e);
    return false;
  }
}

export async function removeP2pGroup(): Promise<void> {
  if (Platform.OS !== 'android' || !P2pNative) return;
  try {
    await P2pNative.removeGroup();
  } catch {}
}

export async function setP2pDeviceName(name: string): Promise<boolean> {
  if (Platform.OS !== 'android' || !P2pNative?.setDeviceName) return false;
  try {
    return await P2pNative.setDeviceName(name);
  } catch {
    return false;
  }
}
