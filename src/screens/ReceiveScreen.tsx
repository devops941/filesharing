import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useKeepAwake } from 'expo-keep-awake';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { startReceiver } from '../net/receiver';
import type { OfferInfo } from '../net/receiver';
import { PORT } from '../config';
import { getDeviceName, saveDeviceName } from '../utils/deviceName';
import { detectLocalIP } from '../utils/networkSettings';
import { requestPermissions } from '../permissions';
import {
  createWifiDirectGroup,
  removeWifiDirectGroup,
  startWifiDirectDiscovery,
  stopWifiDirectDiscovery,
  isWifiDirectSupported,
} from '../net/wifiDirect';
import {
  notifyReceiving,
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

type Props = NativeStackScreenProps<RootStackParamList, 'Receive'>;

export default function ReceiveScreen({ navigation }: Props) {
  useKeepAwake();
  const [deviceName, setDeviceName] = useState('');
  const [ip, setIp] = useState('192.168.49.1');
  const [showRename, setShowRename] = useState(false);
  const [newName, setNewName] = useState('');
  const serverRef = useRef<any>(null);
  const currentFileRef = useRef<{ name: string; size: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    let unmounted = false;

    getDeviceName().then(name => {
      if (!mounted) return;
      setDeviceName(name);
    });

    requestPermissions('receive').then(() => {
      if (!mounted) return;
      isWifiDirectSupported().then(supported => {
        if (supported && mounted) {
          createWifiDirectGroup().then(() => {
            if (mounted) {
              detectLocalIP().then(p2pIp => {
                if (mounted && p2pIp) {
                  setIp(p2pIp);
                }
              });
            }
          });
          startWifiDirectDiscovery().catch(() => {});
        }
      });
    });

    serverRef.current = startReceiver({
      confirmCode: code => {
        return new Promise(resolve => {
          if (unmounted) { resolve(false); return; }
          navigation.navigate('Pairing', {
            code,
            onConfirm: (ok: boolean) => resolve(ok),
          });
        });
      },
      acceptFile: (offer: OfferInfo) => {
        currentFileRef.current = { name: offer.fileName, size: offer.size };
        resetNotifProgress();
        registerTransferCancel(() => {
          try { serverRef.current?.close(); } catch {}
        });
        navigation.navigate('Transfer', {
          total: offer.size,
          received: 0,
          fileName: offer.fileName,
        });
        return Promise.resolve(true);
      },
      progress: bytes => {
        const f = currentFileRef.current;
        const total = f?.size ?? 0;
        navigation.navigate('Transfer', {
          total,
          received: bytes,
          fileName: f?.name,
        });
        if (f) {
          const pct = f.size > 0 ? Math.min(99, Math.round((bytes / f.size) * 100)) : 0;
          notifyReceiving(f.name, pct).catch(() => {});
        }
      },
      done: (filePath, verified) => {
        registerTransferCancel(null);
        navigation.navigate('Done', { filePath, verified });
        const f = currentFileRef.current;
        notifyDone('received', f ? [f.name] : ['File']).catch(() => {});
        currentFileRef.current = null;
      },
      cancelled: () => {
        registerTransferCancel(null);
        navigation.goBack();
        notifyCancelled().catch(() => {});
        currentFileRef.current = null;
      },
      error: msg => {
        registerTransferCancel(null);
        Alert.alert('Error', msg);
        notifyCancelled().catch(() => {});
        currentFileRef.current = null;
      },
    });

    return () => {
      mounted = false;
      unmounted = true;
      registerTransferCancel(null);
      serverRef.current?.close();
      removeWifiDirectGroup().catch(() => {});
      stopWifiDirectDiscovery().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRename() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await saveDeviceName(trimmed);
    setDeviceName(trimmed);
    setShowRename(false);
  }

  const qrData = JSON.stringify({ ip: ip || '192.168.49.1', port: PORT, name: deviceName, isWifiDirect: true });

  return (
    <SafeAreaView style={styles.container}>
      {/* Device name chip / tap to rename */}
      <TouchableOpacity
        style={styles.nameChip}
        onPress={() => { setNewName(deviceName); setShowRename(true); }}
      >
        <Text style={styles.nameChipText}>{deviceName || '...'}</Text>
        <Text style={styles.renameHint}>rename</Text>
      </TouchableOpacity>

      {/* Title */}
      <Text style={styles.title}>Receive</Text>
      <Text style={styles.subtitle}>Let the sender scan this code or select your device</Text>

      {/* Quick Share Mode Active badge */}
      <View style={styles.hotspotActiveBadge}>
        <Text style={styles.hotspotActiveText}>
          ⚡ Google Quick Share (Wi-Fi Direct) Ready · Max 50 MB/s
        </Text>
      </View>

      {/* QR card */}
      <View style={styles.qrCard}>
        {deviceName ? (
          <QRCode
            value={qrData}
            size={200}
            backgroundColor="#FFFFFF"
            color="#0F1117"
          />
        ) : (
          <View style={styles.qrPlaceholder}>
            <ActivityIndicator color={C.primary} />
            <Text style={styles.qrWait}>Preparing Quick Share...</Text>
          </View>
        )}
      </View>

      {/* Waiting indicator */}
      <View style={styles.waitingRow}>
        <View style={styles.dot} />
        <Text style={styles.waitingText}>Waiting for sender...</Text>
      </View>

      {/* Rename modal */}
      <Modal visible={showRename} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Set Device Name</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="My Phone"
              placeholderTextColor={C.textDim}
              autoFocus
              maxLength={24}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowRename(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleRename}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
    padding: 24,
  },
  nameChip: {
    alignItems: 'center',
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  nameChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
  },
  renameHint: {
    fontSize: 11,
    color: C.textDim,
    marginTop: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: C.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: C.textSub,
    marginBottom: 28,
  },
  noNetWarn: {
    alignItems: 'center',
    marginBottom: 16,
  },
  noNetMsg: {
    color: C.red,
    fontSize: 13,
    marginBottom: 8,
  },
  retryBtn: {
    backgroundColor: C.surface2,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  retryBtnText: {
    color: C.textSub,
    fontWeight: '600',
    fontSize: 13,
  },
  qrCard: {
    backgroundColor: C.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 248,
    minHeight: 248,
    marginBottom: 32,
  },
  qrPlaceholder: {
    alignItems: 'center',
    gap: 12,
  },
  qrWait: {
    color: C.textSub,
    fontSize: 13,
    marginTop: 12,
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.primary,
  },
  waitingText: {
    fontSize: 14,
    color: C.textSub,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: C.surface2,
    borderRadius: 24,
    padding: 24,
    width: '80%' as any,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: C.surface,
    color: C.text,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    color: C.textSub,
    fontWeight: '600',
  },
  modalSave: {
    flex: 1,
    backgroundColor: C.primary,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#0F1117',
    fontWeight: '700',
  },
  hotspotActiveBadge: {
    backgroundColor: C.primaryBg,
    borderColor: C.primary,
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
    marginTop: -8,
  },
  hotspotActiveText: {
    color: C.primary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
