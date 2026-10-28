import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { startAdvertising, stopAdvertising } from '../net/discovery';
import { startReceiver } from '../net/receiver';
import type { OfferInfo } from '../net/receiver';
import { getDeviceName, saveDeviceName } from '../utils/deviceName';
import {
  initWifiDirect,
  createP2pGroup,
  setP2pDeviceName,
  removeP2pGroup,
  subscribeP2pConnection,
} from '../net/wifiDirect';
import { requestPermissions } from '../permissions';
import {
  notifyReceiving,
  notifyDone,
  notifyCancelled,
  resetNotifProgress,
} from '../notifications';
import { registerTransferCancel } from '../net/activeTransfer';

// Quick Share Brand Theme Colors (Light)
const C = {
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  surface2: '#F1F5F9',
  surfaceCard: '#FFFFFF',
  primary: '#0284C7', // Quick Share Sky Blue
  primaryGlow: 'rgba(2, 132, 199, 0.12)',
  accent: '#6366F1', // Electric Indigo
  success: '#059669', // Mint Green
  text: '#0F172A',
  textSub: '#475569',
  textDim: '#94A3B8',
  border: '#E2E8F0',
  borderGlow: 'rgba(2, 132, 199, 0.35)',
};

type Props = NativeStackScreenProps<RootStackParamList, 'Receive'>;

export default function ReceiveScreen({ navigation }: Props) {
  useKeepAwake();
  const [deviceName, setDeviceName] = useState('');
  const [showRename, setShowRename] = useState(false);
  const [newName, setNewName] = useState('');
  const [isReceivingActive, setIsReceivingActive] = useState(false);

  const serverRef = useRef<any>(null);
  const advertisingName = useRef('');
  const currentFileRef = useRef<{ name: string; size: number } | null>(null);

  // Quick Share concentric ripple animations
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const pulseAvatar = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const createRippleAnim = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 2800, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );

    const a1 = createRippleAnim(ring1, 0);
    const a2 = createRippleAnim(ring2, 900);
    const a3 = createRippleAnim(ring3, 1800);

    const avatarLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAvatar, { toValue: 1.05, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulseAvatar, { toValue: 1.0, duration: 1400, useNativeDriver: true }),
      ]),
    );

    a1.start();
    a2.start();
    a3.start();
    avatarLoop.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
      avatarLoop.stop();
    };
  }, [ring1, ring2, ring3, pulseAvatar]);

  useEffect(() => {
    let mounted = true;
    let unmounted = false;
    let p2pSub: { remove(): void } | null = null;

    requestPermissions('receive').then(async () => {
      if (!mounted) return;

      // BUG-8 FIX: Receiver must become the Wi-Fi Direct Group Owner (GO),
      // NOT a discoverer. The sender will find us via mDNS and connect to our GO.
      // Quick Share model: receiver = autonomous GO, sender = client.
      const ok = await initWifiDirect();
      if (ok && mounted) {
        // Create autonomous group so this device advertises as GO
        await createP2pGroup().catch(() => {});
        setIsReceivingActive(true);

        p2pSub = subscribeP2pConnection(info => {
          if (!mounted) return;
          if (info?.groupFormed) {
            setIsReceivingActive(true);
          }
        });
      }
    });

    getDeviceName().then(name => {
      if (!mounted) return;
      setDeviceName(name);
      advertisingName.current = name;
      startAdvertising(name);
      setP2pDeviceName(name).catch(() => {});
    });

    const cancelRef = { cancel: () => {} };
    registerTransferCancel(() => {
      cancelRef.cancel();
      try {
        serverRef.current?.close();
      } catch {}
    });

    serverRef.current = startReceiver(
      {
        confirmCode: code => {
          return new Promise(resolve => {
            if (unmounted) {
              resolve(false);
              return;
            }
            navigation.navigate('Pairing', {
              code,
              onConfirm: (ok: boolean) => resolve(ok),
            });
          });
        },
        acceptFile: (offer: OfferInfo) => {
          currentFileRef.current = { name: offer.fileName, size: offer.size };
          resetNotifProgress();
          navigation.navigate('Transfer', {
            total: offer.size,
            received: 0,
            fileName: offer.fileName,
            fileIndex: offer.fileIndex ?? 1,
            fileTotal: offer.fileTotal ?? 1,
          });
          return Promise.resolve(true);
        },
        progress: bytes => {
          const f = currentFileRef.current;
          navigation.navigate('Transfer', {
            total: f?.size ?? 0,
            received: bytes,
            fileName: f?.name,
          });
          if (f) {
            const pct = f.size > 0 ? Math.min(99, Math.round((bytes / f.size) * 100)) : 0;
            notifyReceiving(f.name, pct).catch(() => {});
          }
        },
        done: (filePath, verified, fileCount) => {
          registerTransferCancel(null);
          navigation.navigate('Done', { filePath, verified, fileCount: fileCount ?? 1 });
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
      },
      cancelRef,
    );

    return () => {
      mounted = false;
      unmounted = true;
      registerTransferCancel(null);
      p2pSub?.remove();
      if (advertisingName.current) stopAdvertising(advertisingName.current);
      // BUG-8 FIX: Receiver is GO — remove group on cleanup, not stopDiscovery
      serverRef.current?.close();
      removeP2pGroup().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRename() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (advertisingName.current) stopAdvertising(advertisingName.current);
    await saveDeviceName(trimmed);
    setDeviceName(trimmed);
    advertisingName.current = trimmed;
    startAdvertising(trimmed);
    setShowRename(false);
  }

  const deviceInitial = (deviceName || 'M').charAt(0).toUpperCase();

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

        {/* Device identity chip */}
        <TouchableOpacity
          style={styles.nameChip}
          onPress={() => {
            setNewName(deviceName);
            setShowRename(true);
          }}
          activeOpacity={0.8}>
          <Text style={styles.nameChipText}>📱 {deviceName || 'My Device'}</Text>
          <Text style={styles.renameHint}>Tap to rename</Text>
        </TouchableOpacity>
      </View>

      {/* Main Quick Share radar visual */}
      <View style={styles.centerSection}>
        <View style={styles.radarContainer}>
          {[ring1, ring2, ring3].map((anim, idx) => (
            <Animated.View
              key={idx}
              style={[
                styles.radarRing,
                {
                  opacity: anim.interpolate({
                    inputRange: [0, 0.25, 0.8, 1],
                    outputRange: [0, 0.45, 0.15, 0],
                  }),
                  transform: [
                    {
                      scale: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.35, 1.3],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}

          {/* Central glowing device avatar */}
          <Animated.View
            style={[
              styles.avatarCircle,
              { transform: [{ scale: pulseAvatar }] },
            ]}>
            <Text style={styles.avatarInitial}>{deviceInitial}</Text>
          </Animated.View>
        </View>

        {/* Quick Share title & status */}
        <Text style={styles.quickShareTitle}>Quick Share</Text>
        <Text style={styles.quickShareSub}>Ready to receive files</Text>

        {/* Status pill badge */}
        <View style={styles.statusPill}>
          <View style={styles.liveDot} />
          <Text style={styles.statusPillText}>
            {isReceivingActive ? 'Visible to nearby devices' : 'Broadcasting presence'}
          </Text>
        </View>
      </View>

      {/* Bottom instructional card */}
      <View style={styles.bottomCard}>
        <View style={styles.bottomIconWrap}>
          <Text style={styles.bottomIcon}>⚡</Text>
        </View>
        <View style={styles.bottomTextWrap}>
          <Text style={styles.bottomTitle}>Direct High-Speed Transfer</Text>
          <Text style={styles.bottomDesc}>
            On the sender phone, select files and tap{' '}
            <Text style={styles.highlightText}>{deviceName || 'this device'}</Text> in the
            Quick Share list.
          </Text>
        </View>
      </View>

      {/* Rename modal */}
      <Modal visible={showRename} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Device Name</Text>
            <Text style={styles.modalSub}>This name will appear on nearby devices.</Text>
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
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowRename(false)}>
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
    backgroundColor: C.bg,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
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
  nameChip: {
    alignItems: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  nameChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },
  renameHint: {
    fontSize: 11,
    color: C.primary,
    marginTop: 2,
    fontWeight: '500',
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  radarContainer: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  radarRing: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 2,
    borderColor: C.primary,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E0F2FE',
    borderWidth: 2.5,
    borderColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  avatarInitial: {
    fontSize: 42,
    fontWeight: '800',
    color: C.primary,
  },
  quickShareTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: C.text,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  quickShareSub: {
    fontSize: 14,
    color: C.textSub,
    marginBottom: 16,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.25)',
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.success,
  },
  statusPillText: {
    color: C.success,
    fontSize: 13,
    fontWeight: '600',
  },
  bottomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  bottomIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomIcon: {
    fontSize: 22,
  },
  bottomTextWrap: {
    flex: 1,
  },
  bottomTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    marginBottom: 2,
  },
  bottomDesc: {
    fontSize: 12,
    color: C.textSub,
    lineHeight: 17,
  },
  highlightText: {
    fontWeight: '700',
    color: C.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: C.surface,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  modalTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSub: {
    color: C.textSub,
    fontSize: 13,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: C.surface2,
    color: C.text,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    backgroundColor: C.surface2,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    color: C.textSub,
    fontWeight: '600',
  },
  modalSave: {
    flex: 1,
    backgroundColor: C.primary,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
