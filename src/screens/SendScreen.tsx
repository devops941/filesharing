import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { startScan, stopScan } from '../net/discovery';
import type { Device } from '../net/discovery';
import { sendFiles } from '../net/sender';
import type { PickedFile } from '../net/sender';
import {
  notifySending,
  notifyDone,
  notifyCancelled,
  resetNotifProgress,
} from '../notifications';
import { registerTransferCancel } from '../net/activeTransfer';
import { requestPermissions } from '../permissions';
import {
  initWifiDirect,
  startP2pDiscovery,
  stopP2pDiscovery,
  subscribeP2pPeers,
  connectP2pPeer,
  cancelP2pConnect,
  removeP2pGroup,
  waitForGroupOwnerIP,
} from '../net/wifiDirect';
import { PORT } from '../config';

// Quick Share Theme Palette (Light)
const C = {
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  surface2: '#F1F5F9',
  surfaceCard: '#FFFFFF',
  primary: '#0284C7', // Quick Share Sky Blue
  primaryGlow: 'rgba(2, 132, 199, 0.12)',
  accent: '#6366F1', // Electric Indigo
  success: '#059669',
  text: '#0F172A',
  textSub: '#475569',
  textDim: '#94A3B8',
  border: '#E2E8F0',
  borderHighlight: 'rgba(2, 132, 199, 0.4)',
  red: '#DC2626',
};

type Props = NativeStackScreenProps<RootStackParamList, 'Send'>;

export default function SendScreen({ navigation }: Props) {
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectingDevice, setConnectingDevice] = useState<Device | null>(null);
  const cancelConnectionRef = useRef<(() => void) | null>(null);

  // Radar pulse rings
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createRippleAnim = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 2600, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );

    const a1 = createRippleAnim(ring1, 0);
    const a2 = createRippleAnim(ring2, 850);
    const a3 = createRippleAnim(ring3, 1700);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [ring1, ring2, ring3]);

  useEffect(() => {
    let mounted = true;
    let p2pSub: { remove(): void } | null = null;

    requestPermissions('send').then(async granted => {
      if (!mounted) return;
      // BUG-11/19 FIX: Alert user if critical permissions were not granted
      if (!granted) {
        Alert.alert(
          'Permissions Required',
          'SecureShare needs Location (or Nearby Wi-Fi Devices on Android 13+) permission to discover nearby devices. Please grant it in Settings.',
        );
        setScanning(false);
        return;
      }
      setScanning(true);

      // mDNS peer scan and active subnet probe
      startScan(d => {
        if (!mounted) return;
        setDevices(prev => {
          const existing = prev.find(x => x.ip === d.ip);
          if (existing) {
            if (existing.name.startsWith('Nearby Device') && !d.name.startsWith('Nearby Device')) {
              return prev.map(x => (x.ip === d.ip ? { ...x, name: d.name } : x));
            }
            return prev;
          }
          const filtered = prev.filter(
            x => !(x.isWifiDirect && x.name.toLowerCase() === d.name.toLowerCase()),
          );
          return [d, ...filtered];
        });
      });

      // Wi-Fi Direct peer discovery
      await initWifiDirect();
      await startP2pDiscovery().catch(() => {});
      p2pSub = subscribeP2pPeers(peers => {
        if (!mounted) return;
        setDevices(prev => {
          const mDnsDevices = prev.filter(d => !d.isWifiDirect);
          const p2pDevices: Device[] = peers
            .filter(
              p =>
                !mDnsDevices.some(
                  m => m.name.toLowerCase() === (p.deviceName || '').toLowerCase(),
                ),
            )
            .map(p => ({
              name: p.deviceName || 'Nearby Device',
              ip: '',
              port: PORT,
              isWifiDirect: true,
              p2pAddress: p.deviceAddress,
            }));
          return [...mDnsDevices, ...p2pDevices];
        });
      });
    });

    // Keep Wi-Fi Direct discovery actively pinging so Android radio doesn't sleep
    const refreshTimer = setInterval(() => {
      if (!mounted) return;
      startP2pDiscovery().catch(() => {});
    }, 4000);

    return () => {
      mounted = false;
      clearInterval(refreshTimer);
      stopScan();
      stopP2pDiscovery().catch(() => {});
      p2pSub?.remove();
      removeP2pGroup().catch(() => {});
      setScanning(false);
    };
  }, []);

  async function pickFiles() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        // BUG-19 FIX: copyToCacheDirectory=true ensures Android content:// URIs are
        // materialized to file:// paths that expo-file-system can read with position/length.
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled) return;
      setFiles(
        result.assets.map(a => ({
          uri: a.uri,
          name: a.name,
          size: a.size ?? 0,
          type: a.mimeType ?? undefined,
        })),
      );
    } catch {
      // user cancelled
    }
  }

  async function connectToDevice(device: Device) {
    if (files.length === 0) {
      Alert.alert('No files selected', 'Please tap the file box above to select files first.');
      return;
    }

    // Direct Wi-Fi Direct flow
    if (device.isWifiDirect && device.p2pAddress) {
      setConnectingDevice(device);
      setConnecting(true);
      let cancelled = false;

      cancelConnectionRef.current = () => {
        cancelled = true;
        cancelP2pConnect().catch(() => {});
        setConnecting(false);
      };

      try {
        await connectP2pPeer(device.p2pAddress);
        const ownerIp = await waitForGroupOwnerIP(20000);
        if (cancelled) return;

        const p2pDevice: Device = { ...device, ip: ownerIp, port: PORT };
        startSendProcess(p2pDevice, true);
      } catch (err: any) {
        if (cancelled) return;
        setConnecting(false);
        cancelConnectionRef.current = null;
        Alert.alert(
          'Quick Share Connection',
          err?.message ?? 'Could not connect. Make sure the receiver is on the Quick Share screen.',
        );
      }
      return;
    }

    // Direct LAN flow
    startSendProcess(device, false);
  }

  async function startSendProcess(device: Device, isP2p = false) {
    const transferParams = {
      total: files[0]?.size ?? 0,
      received: 0,
      fileName: files[0]?.name ?? '',
      fileIndex: 1,
      fileTotal: files.length,
    };
    resetNotifProgress();
    setConnectingDevice(device);
    setConnecting(true);
    const cancelRef = { cancel: () => {} };
    cancelConnectionRef.current = () => {
      cancelRef.cancel();
      if (isP2p) removeP2pGroup().catch(() => {});
    };
    registerTransferCancel(() => {
      cancelRef.cancel();
      if (isP2p) removeP2pGroup().catch(() => {});
    });

    await sendFiles(
      device,
      files,
      {
        confirmCode: code =>
          new Promise(resolve => {
            setConnecting(false);
            navigation.navigate('Pairing', {
              code,
              onConfirm: resolve,
              transferParams,
            });
          }),
        progress: (idx, sent, fileTotal) => {
          navigation.navigate('Transfer', {
            total: fileTotal,
            received: sent,
            fileIndex: idx + 1,
            fileName: files[idx]?.name ?? '',
            fileTotal: files.length,
          });
          const pct = fileTotal > 0 ? Math.min(99, Math.round((sent / fileTotal) * 100)) : 0;
          notifySending(files[idx]?.name ?? 'File', pct).catch(() => {});
        },
        done: () => {
          registerTransferCancel(null);
          if (isP2p) removeP2pGroup().catch(() => {});
          navigation.navigate('Done', { filePath: '', verified: true, fileCount: files.length });
          notifyDone('sent', files.map(f => f.name)).catch(() => {});
        },
        rejected: (_idx, reason) => {
          registerTransferCancel(null);
          if (isP2p) removeP2pGroup().catch(() => {});
          Alert.alert('Transfer Declined', reason);
        },
        error: msg => {
          registerTransferCancel(null);
          if (isP2p) removeP2pGroup().catch(() => {});
          setConnecting(false);
          notifyCancelled().catch(() => {});
          Alert.alert('Connection Failed', msg);
        },
        cancelled: () => {
          registerTransferCancel(null);
          if (isP2p) removeP2pGroup().catch(() => {});
          setConnecting(false);
          cancelConnectionRef.current = null;
          notifyCancelled().catch(() => {});
        },
      },
      cancelRef,
    );
    registerTransferCancel(null);
    setConnecting(false);
    cancelConnectionRef.current = null;
  }

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quick Share</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* File picker card */}
      <TouchableOpacity onPress={pickFiles} style={styles.fileCard} activeOpacity={0.85}>
        {files.length === 0 ? (
          <View style={styles.fileCardEmpty}>
            <View style={styles.fileIconBubble}>
              <Text style={styles.fileIconText}>📁</Text>
            </View>
            <View style={styles.fileCardTextWrap}>
              <Text style={styles.fileCardTitle}>Select files to share</Text>
              <Text style={styles.fileCardSub}>Photos, videos, and documents</Text>
            </View>
            <View style={styles.addBtnCircle}>
              <Text style={styles.addBtnPlus}>+</Text>
            </View>
          </View>
        ) : (
          <View style={styles.fileCardFilled}>
            <View style={styles.fileCardFilledHeader}>
              <View>
                <Text style={styles.fileCountTitle}>
                  {files.length} {files.length === 1 ? 'file' : 'files'} selected
                </Text>
                <Text style={styles.fileSizeText}>
                  {(totalSize / 1024 / 1024).toFixed(1)} MB total
                </Text>
              </View>
              <View style={styles.changeBtnPill}>
                <Text style={styles.changeBtnText}>Change</Text>
              </View>
            </View>
            <View style={styles.fileChipsRow}>
              {files.slice(0, 3).map((f, i) => (
                <View key={i} style={styles.fileChip}>
                  <Text style={styles.fileChipText} numberOfLines={1}>
                    {f.name}
                  </Text>
                </View>
              ))}
              {files.length > 3 && (
                <View style={styles.fileMoreChip}>
                  <Text style={styles.fileMoreText}>+{files.length - 3}</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Main Nearby Quick Share Section */}
      <View style={styles.nearbySection}>
        <Text style={styles.sectionLabel}>NEARBY DEVICES</Text>

        <View style={styles.radarArea}>
          {/* Subtle concentric ripple waves */}
          {[ring1, ring2, ring3].map((anim, idx) => (
            <Animated.View
              key={idx}
              style={[
                styles.radarRipple,
                {
                  opacity: anim.interpolate({
                    inputRange: [0, 0.3, 0.8, 1],
                    outputRange: [0, 0.35, 0.12, 0],
                  }),
                  transform: [
                    {
                      scale: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.35, 1.25],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}

          {/* Device list or scanning state */}
          {devices.length === 0 ? (
            <View style={styles.emptySearchContainer}>
              <View style={styles.centerPulsingIcon}>
                <ActivityIndicator color={C.primary} size="small" />
              </View>
              <Text style={styles.scanningNotice}>
                {scanning ? 'Searching for nearby Quick Share devices...' : 'Ready to search'}
              </Text>
              <Text style={styles.scanningHint}>
                Make sure the other device is on the Receive screen.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.deviceScroll}
              contentContainerStyle={styles.deviceScrollContent}>
              {devices.map((device, idx) => {
                const initial = (device.name || 'D').charAt(0).toUpperCase();
                return (
                  <TouchableOpacity
                    key={device.p2pAddress || device.ip || idx}
                    onPress={() => connectToDevice(device)}
                    style={styles.deviceBubbleCard}
                    activeOpacity={0.75}>
                    <View style={styles.deviceAvatarCircle}>
                      <Text style={styles.deviceInitialText}>{initial}</Text>
                      <View style={styles.deviceLiveDot} />
                    </View>
                    <Text style={styles.deviceCardName} numberOfLines={1}>
                      {device.name}
                    </Text>
                    <View style={styles.quickShareBadge}>
                      <Text style={styles.quickShareBadgeText}>Quick Share</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>

      {/* Connecting overlay modal */}
      <Modal visible={connecting} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.connectingSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.connectingAvatarWrap}>
              <ActivityIndicator color={C.primary} size="large" />
            </View>

            <Text style={styles.connectingDeviceTitle}>
              Connecting to {connectingDevice?.name || 'Device'}
            </Text>
            <Text style={styles.connectingSub}>
              Establishing direct peer-to-peer connection...
            </Text>

            <TouchableOpacity
              style={styles.cancelConnBtn}
              onPress={() => {
                cancelConnectionRef.current?.();
                cancelConnectionRef.current = null;
                setConnecting(false);
              }}
              activeOpacity={0.8}>
              <Text style={styles.cancelConnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  backArrow: {
    color: C.text,
    fontSize: 28,
    lineHeight: 32,
    marginTop: -2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.3,
  },
  headerRightPlaceholder: {
    width: 44,
  },
  fileCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 22,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  fileCardEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  fileIconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIconText: {
    fontSize: 24,
  },
  fileCardTextWrap: {
    flex: 1,
  },
  fileCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
    marginBottom: 2,
  },
  fileCardSub: {
    fontSize: 12,
    color: C.textSub,
  },
  addBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnPlus: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  fileCardFilled: {
    gap: 12,
  },
  fileCardFilledHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fileCountTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
  },
  fileSizeText: {
    fontSize: 12,
    color: C.textSub,
    marginTop: 2,
  },
  changeBtnPill: {
    backgroundColor: C.surface2,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  changeBtnText: {
    color: C.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  fileChipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  fileChip: {
    backgroundColor: C.surface2,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 160,
  },
  fileChipText: {
    fontSize: 11,
    color: C.textSub,
  },
  fileMoreChip: {
    backgroundColor: C.primaryGlow,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  fileMoreText: {
    fontSize: 11,
    color: C.primary,
    fontWeight: '700',
  },
  nearbySection: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: C.textDim,
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  radarArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    position: 'relative',
    padding: 16,
  },
  radarRipple: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 1.5,
    borderColor: C.primary,
  },
  emptySearchContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  centerPulsingIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },
  scanningNotice: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  scanningHint: {
    fontSize: 12,
    color: C.textSub,
    textAlign: 'center',
    lineHeight: 18,
  },
  deviceScroll: {
    width: '100%',
  },
  deviceScrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 12,
    minWidth: '100%',
  },
  deviceBubbleCard: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    width: 110,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  deviceAvatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E0F2FE',
    borderWidth: 2,
    borderColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    position: 'relative',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  deviceInitialText: {
    fontSize: 24,
    fontWeight: '800',
    color: C.primary,
  },
  deviceLiveDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.success,
    borderWidth: 2,
    borderColor: C.surface,
  },
  deviceCardName: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  quickShareBadge: {
    backgroundColor: '#E0F2FE',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  quickShareBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  connectingSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    marginBottom: 20,
  },
  connectingAvatarWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.primary,
    marginBottom: 16,
  },
  connectingDeviceTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  connectingSub: {
    fontSize: 13,
    color: C.textSub,
    marginBottom: 24,
    textAlign: 'center',
  },
  cancelConnBtn: {
    width: '100%',
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelConnText: {
    color: C.red,
    fontSize: 14,
    fontWeight: '700',
  },
});
