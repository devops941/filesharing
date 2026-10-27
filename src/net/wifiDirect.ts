import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { WifiP2pModule } = NativeModules;
const eventEmitter = WifiP2pModule ? new NativeEventEmitter(WifiP2pModule) : null;

export interface WifiP2pPeer {
  deviceName: string;
  deviceAddress: string;
  primaryDeviceType?: string;
  status: number;
}

export interface WifiP2pConnectionInfo {
  isConnected: boolean;
  isGroupOwner: boolean;
  groupOwnerAddress: string;
}

/**
 * Checks if Wi-Fi Direct is supported on this device.
 */
export async function isWifiDirectSupported(): Promise<boolean> {
  if (Platform.OS !== 'android' || !WifiP2pModule) return false;
  try {
    return await WifiP2pModule.isSupported();
  } catch {
    return false;
  }
}

/**
 * Starts continuous Wi-Fi Direct peer discovery.
 */
export async function startWifiDirectDiscovery(): Promise<boolean> {
  if (Platform.OS !== 'android' || !WifiP2pModule) return false;
  try {
    return await WifiP2pModule.discoverPeers();
  } catch (err) {
    console.warn('[WifiDirect] discoverPeers error:', err);
    return false;
  }
}

/**
 * Stops Wi-Fi Direct peer discovery.
 */
export async function stopWifiDirectDiscovery(): Promise<boolean> {
  if (Platform.OS !== 'android' || !WifiP2pModule) return false;
  try {
    return await WifiP2pModule.stopPeerDiscovery();
  } catch {
    return false;
  }
}

/**
 * Connects to a Wi-Fi Direct peer using its MAC address.
 */
export async function connectWifiDirect(deviceAddress: string): Promise<boolean> {
  if (Platform.OS !== 'android' || !WifiP2pModule) return false;
  try {
    return await WifiP2pModule.connect(deviceAddress);
  } catch (err) {
    console.warn('[WifiDirect] connect error:', err);
    return false;
  }
}

/**
 * Cancels an ongoing Wi-Fi Direct connection attempt.
 */
export async function cancelConnectWifiDirect(): Promise<boolean> {
  if (Platform.OS !== 'android' || !WifiP2pModule) return false;
  try {
    return await WifiP2pModule.cancelConnect();
  } catch {
    return false;
  }
}

/**
 * Creates an autonomous Wi-Fi Direct group (acts as Group Owner at 192.168.49.1).
 */
export async function createWifiDirectGroup(): Promise<boolean> {
  if (Platform.OS !== 'android' || !WifiP2pModule) return false;
  try {
    return await WifiP2pModule.createGroup();
  } catch (err) {
    console.warn('[WifiDirect] createGroup error:', err);
    return false;
  }
}

/**
 * Removes the current Wi-Fi Direct group / disconnects.
 */
export async function removeWifiDirectGroup(): Promise<boolean> {
  if (Platform.OS !== 'android' || !WifiP2pModule) return false;
  try {
    return await WifiP2pModule.removeGroup();
  } catch {
    return false;
  }
}

/**
 * Gets the current Wi-Fi Direct connection info.
 */
export async function getWifiDirectConnectionInfo(): Promise<WifiP2pConnectionInfo> {
  if (Platform.OS !== 'android' || !WifiP2pModule) {
    return { isConnected: false, isGroupOwner: false, groupOwnerAddress: '' };
  }
  try {
    return await WifiP2pModule.getConnectionInfo();
  } catch {
    return { isConnected: false, isGroupOwner: false, groupOwnerAddress: '' };
  }
}

/**
 * Listens for discovered Wi-Fi Direct peers.
 */
export function subscribeWifiDirectPeers(callback: (devices: WifiP2pPeer[]) => void): () => void {
  if (!eventEmitter) return () => {};
  const sub = eventEmitter.addListener('onPeersChanged', (event: any) => {
    callback(event?.devices || []);
  });
  return () => sub.remove();
}

/**
 * Listens for Wi-Fi Direct connection state changes.
 */
export function subscribeWifiDirectConnection(
  callback: (info: WifiP2pConnectionInfo) => void,
): () => void {
  if (!eventEmitter) return () => {};
  const sub = eventEmitter.addListener('onConnectionChanged', (event: any) => {
    callback(event as WifiP2pConnectionInfo);
  });
  return () => sub.remove();
}
