import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  StatusBar,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
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

const C = {
  bg: '#0F1117',
  surface: '#1A1C24',
  surface2: '#22242E',
  primary: '#4ADE80',
  primaryBg: '#052E16',
  accent: '#818CF8',
  text: '#E2E4EE',
  textSub: '#888BA0',
  textDim: '#4E5068',
  border: '#252830',
  red: '#F87171',
};

type Props = NativeStackScreenProps<RootStackParamList, 'Send'>;

export default function SendScreen({ navigation }: Props) {
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [scanning, setScanning] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrScanned, setQrScanned] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const cancelConnectionRef = useRef<(() => void) | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showQrScanner) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
          Animated.timing(scanLineAnim, { toValue: 0, duration: 1600, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      scanLineAnim.setValue(0);
    }
  }, [showQrScanner, scanLineAnim]);

  useEffect(() => {
    const createRingAnim = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(val, { toValue: 1, duration: 2400, useNativeDriver: true }),
          ]),
          Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
    const a1 = createRingAnim(ring1, 0);
    const a2 = createRingAnim(ring2, 800);
    const a3 = createRingAnim(ring3, 1600);
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
    setScanning(true);
    startScan(d => {
      setDevices(prev => {
        if (prev.find(x => x.ip === d.ip)) return prev;
        return [...prev, d];
      });
    });
    return () => {
      stopScan();
      setScanning(false);
    };
  }, []);

  async function pickFiles() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: false,
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

  async function openQrScanner() {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Camera permission required to scan QR code');
        return;
      }
    }
    setQrScanned(false);
    setShowQrScanner(true);
  }

  function handleQrScanned({ data }: { data: string }) {
    if (qrScanned) return;
    setQrScanned(true);
    setShowQrScanner(false);
    try {
      const parsed = JSON.parse(data) as { ip: string; port: number; name: string };
      if (!parsed.ip || !parsed.port) throw new Error('Invalid QR');
      const device: Device = {
        name: parsed.name ?? 'Scanned Device',
        ip: parsed.ip,
        port: parsed.port,
      };
      connectToDevice(device);
    } catch {
      Alert.alert('Invalid QR code', 'Could not read device info from QR code.');
    }
  }

  async function connectToDevice(device: Device) {
    if (files.length === 0) {
      Alert.alert('Pick files first');
      return;
    }
    const transferParams = {
      total: totalSize,
      received: 0,
      fileName: files[0].name,
      fileIndex: 1,
      fileTotal: files.length,
    };
    resetNotifProgress();
    setConnecting(true);
    const cancelRef = { cancel: () => {} };
    cancelConnectionRef.current = () => cancelRef.cancel();
    registerTransferCancel(() => cancelRef.cancel());
    await sendFiles(device, files, {
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
        navigation.navigate('Done', { filePath: '', verified: true, fileCount: files.length });
        notifyDone('sent', files.map(f => f.name)).catch(() => {});
      },
      rejected: (_idx, reason) => {
        registerTransferCancel(null);
        Alert.alert('Rejected', reason);
      },
      error: msg => {
        registerTransferCancel(null);
        setConnecting(false);
        notifyCancelled().catch(() => {});
        Alert.alert('Connection Failed', msg, [{ text: 'OK' }]);
      },
      cancelled: () => {
        registerTransferCancel(null);
        setConnecting(false);
        cancelConnectionRef.current = null;
        notifyCancelled().catch(() => {});
      },
    }, cancelRef);
    registerTransferCancel(null);
    setConnecting(false);
    cancelConnectionRef.current = null;
  }

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Share</Text>
      </View>

      {/* File picker card */}
      <TouchableOpacity onPress={pickFiles} style={styles.fileCard} activeOpacity={0.8}>
        {files.length === 0 ? (
          <View style={styles.fileCardEmpty}>
            <Text style={styles.fileCardIcon}>📁</Text>
            <Text style={styles.fileCardTitle}>Add files to share</Text>
            <Text style={styles.fileCardSub}>Tap to pick files</Text>
          </View>
        ) : (
          <View style={styles.fileCardFilled}>
            <View style={styles.fileCardFilledRow}>
              <Text style={styles.fileCardTitle}>
                {files.length} file{files.length > 1 ? 's' : ''} ready
              </Text>
              <Text style={styles.fileCardSub}>
                {(totalSize / 1024 / 1024).toFixed(1)} MB · Tap to change
              </Text>
            </View>
            {files.slice(0, 3).map((f, i) => (
              <Text key={i} style={styles.fileRow} numberOfLines={1}>
                📄 {f.name}
              </Text>
            ))}
            {files.length > 3 && (
              <Text style={styles.fileMore}>+{files.length - 3} more</Text>
            )}
          </View>
        )}
      </TouchableOpacity>

      {/* Nearby Devices section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>NEARBY DEVICES</Text>

        <View style={styles.radarArea}>
          {/* Radar pulse rings */}
          <View style={styles.radar}>
            {[ring1, ring2, ring3].map((anim, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.radarRing,
                  {
                    opacity: anim.interpolate({
                      inputRange: [0, 0.3, 1],
                      outputRange: [0, 0.5, 0],
                    }),
                    transform: [
                      {
                        scale: anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.3, 1],
                        }),
                      },
                    ],
                  },
                ]}
              />
            ))}
            <View style={styles.radarCenter} />
          </View>

          {/* Scanning status text */}
          {scanning && devices.length === 0 && (
            <Text style={styles.scanningText}>Looking for nearby devices...</Text>
          )}

          {/* Device cards — horizontal scroll */}
          {devices.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.deviceScroll}
              contentContainerStyle={styles.deviceScrollContent}>
              {devices.map(item => (
                <TouchableOpacity
                  key={item.ip}
                  onPress={() => connectToDevice(item)}
                  style={styles.deviceCard}
                  activeOpacity={0.75}>
                  <View style={styles.deviceIconWrap}>
                    <Text style={styles.deviceIcon}>📱</Text>
                  </View>
                  <Text style={styles.deviceName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      {/* QR Scan button */}
      <TouchableOpacity style={styles.qrBtn} onPress={openQrScanner} activeOpacity={0.8}>
        <Text style={styles.qrBtnText}>📷  Scan QR Code</Text>
      </TouchableOpacity>

      {/* QR Scanner Modal */}
      <Modal visible={showQrScanner} animationType="slide" statusBarTranslucent>
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleQrScanned}
          />
          {/* Top overlay */}
          <View style={styles.scannerTopOverlay}>
            <Text style={styles.scannerTitle}>Scan QR Code</Text>
            <Text style={styles.scannerSubtitle}>
              Hold your device over the QR code on the receiver's screen
            </Text>
          </View>
          {/* Middle row: side overlays + viewfinder cutout */}
          <View style={styles.scannerMiddleRow}>
            <View style={styles.scannerSideOverlay} />
            <View style={styles.viewfinder}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    transform: [
                      {
                        translateY: scanLineAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 248],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </View>
            <View style={styles.scannerSideOverlay} />
          </View>
          {/* Bottom overlay */}
          <View style={styles.scannerBottomOverlay}>
            {qrScanned ? (
              <View style={styles.scanningRow}>
                <ActivityIndicator color={C.primary} size="small" />
                <Text style={styles.scanningRowText}>SCANNING...</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.cancelScanBtn}
                onPress={() => setShowQrScanner(false)}>
                <Text style={styles.cancelScanText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Connecting overlay */}
      <Modal visible={connecting} transparent animationType="fade">
        <View style={styles.connectingOverlay}>
          <View style={styles.connectingBox}>
            <ActivityIndicator color={C.primary} size="large" />
            <Text style={styles.connectingTitle}>Connecting</Text>
            <Text style={styles.connectingHint}>
              Make sure the receiver's phone has Receive Mode open
            </Text>
            <TouchableOpacity
              style={styles.connectingCancel}
              onPress={() => {
                cancelConnectionRef.current?.();
                cancelConnectionRef.current = null;
                setConnecting(false);
              }}>
              <Text style={styles.connectingCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Layout
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: C.text,
    letterSpacing: -0.5,
  },

  // File card
  fileCard: {
    margin: 16,
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  fileCardEmpty: {
    padding: 28,
    alignItems: 'center',
    gap: 6,
  },
  fileCardIcon: {
    fontSize: 36,
    marginBottom: 4,
  },
  fileCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
  },
  fileCardSub: {
    fontSize: 13,
    color: C.textSub,
  },
  fileCardFilled: {
    padding: 18,
    gap: 6,
  },
  fileCardFilledRow: {
    marginBottom: 8,
  },
  fileRow: {
    fontSize: 13,
    color: C.textSub,
    paddingVertical: 2,
  },
  fileMore: {
    fontSize: 12,
    color: C.textDim,
    marginTop: 2,
  },

  // Nearby Devices section
  section: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textDim,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  radarArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },

  // Radar
  radar: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  radarRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: C.primary,
  },
  radarCenter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.primary,
  },
  scanningText: {
    fontSize: 13,
    color: C.textSub,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // Device scroll
  deviceScroll: {
    flexGrow: 0,
  },
  deviceScrollContent: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  deviceCard: {
    alignItems: 'center',
    backgroundColor: C.surface2,
    borderRadius: 20,
    padding: 16,
    marginRight: 12,
    minWidth: 100,
    borderWidth: 1,
    borderColor: C.border,
  },
  deviceIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  deviceIcon: {
    fontSize: 22,
  },
  deviceName: {
    fontSize: 12,
    fontWeight: '600',
    color: C.text,
    textAlign: 'center',
  },

  // QR button
  qrBtn: {
    margin: 16,
    marginTop: 8,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  qrBtnText: {
    color: C.text,
    fontWeight: '600',
    fontSize: 15,
  },

  // QR Scanner Modal
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerTopOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 24,
  },
  scannerTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  scannerSubtitle: {
    color: C.textSub,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  scannerMiddleRow: {
    flexDirection: 'row',
    height: 260,
  },
  scannerSideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  viewfinder: {
    width: 260,
    height: 260,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: C.primary,
    borderWidth: 4,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 6,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: C.primary,
    shadowColor: C.primary,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  scannerBottomOverlay: {
    flex: 1.2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  scanningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scanningRowText: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2,
  },
  cancelScanBtn: {
    backgroundColor: C.surface,
    borderRadius: 100,
    paddingHorizontal: 36,
    paddingVertical: 14,
  },
  cancelScanText: {
    color: C.text,
    fontWeight: '700',
    fontSize: 15,
  },

  // Connecting Modal
  connectingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectingBox: {
    backgroundColor: C.surface,
    borderRadius: 28,
    padding: 32,
    width: '85%',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  connectingTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: '700',
  },
  connectingHint: {
    color: C.textSub,
    fontSize: 13,
    textAlign: 'center',
  },
  connectingCancel: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 100,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  connectingCancelText: {
    color: C.red,
    fontWeight: '600',
    fontSize: 15,
  },
});
