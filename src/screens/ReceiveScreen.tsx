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
import TcpSocket from 'react-native-tcp-socket';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { startAdvertising, stopAdvertising } from '../net/discovery';
import { startReceiver } from '../net/receiver';
import type { OfferInfo } from '../net/receiver';
import { PORT } from '../config';
import { getDeviceName, saveDeviceName } from '../utils/deviceName';

type Props = NativeStackScreenProps<RootStackParamList, 'Receive'>;

function detectLocalIP(): Promise<string> {
  return new Promise(resolve => {
    let done = false;
    const finish = (ip: string) => {
      if (done || !ip || ip === '127.0.0.1') return;
      done = true;
      resolve(ip);
    };
    setTimeout(() => { if (!done) { done = true; resolve(''); } }, 4000);

    // Outbound probes — OS picks our source IP from the active interface
    for (const [host, port] of [
      ['8.8.8.8', 53], ['1.1.1.1', 53],
      ['192.168.1.1', 80], ['192.168.0.1', 80], ['10.0.0.1', 80],
    ] as [string, number][]) {
      const sock = TcpSocket.createConnection({ host, port: port as number }, () => {
        const addr = (sock as any).address?.();
        try { sock.destroy(); } catch {}
        finish(addr?.address ?? '');
      });
      (sock as any).on('error', () => {});
    }

    // Bind-based hotspot detection — if we CAN bind to this IP, it's ours
    // Outbound probes fail for hotspot providers (they ARE the gateway)
    for (const hotspotIp of ['192.168.43.1', '192.168.44.1', '172.20.10.1', '10.42.0.1']) {
      try {
        const s = TcpSocket.createServer(() => {});
        s.listen({ port: 0, host: hotspotIp });
        s.on('listening', () => { try { s.close(); } catch {} finish(hotspotIp); });
        s.on('error', () => {});
      } catch {}
    }
  });
}

export default function ReceiveScreen({ navigation }: Props) {
  const [deviceName, setDeviceName] = useState('');
  const [ip, setIp] = useState('');
  const [ipLoading, setIpLoading] = useState(true);
  const [showRename, setShowRename] = useState(false);
  const [newName, setNewName] = useState('');
  const [showManualIp, setShowManualIp] = useState(false);
  const [manualIpInput, setManualIpInput] = useState('');
  const serverRef = useRef<any>(null);
  const advertisingName = useRef('');

  useEffect(() => {
    let mounted = true;

    getDeviceName().then(name => {
      if (!mounted) return;
      setDeviceName(name);
      advertisingName.current = name;
      startAdvertising(name);
    });

    detectLocalIP().then(detectedIp => {
      if (!mounted) return;
      setIp(detectedIp);
      setIpLoading(false);
    });

    serverRef.current = startReceiver({
      confirmCode: code => {
        return new Promise(resolve => {
          navigation.navigate('Pairing', {
            code,
            onConfirm: (ok: boolean) => resolve(ok),
          });
        });
      },
      acceptFile: (offer: OfferInfo) => {
        return new Promise(resolve => {
          Alert.alert(
            'Incoming File',
            `Accept "${offer.fileName}" (${(offer.size / 1024 / 1024).toFixed(1)} MB)?`,
            [
              { text: 'Decline', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Accept', onPress: () => resolve(true) },
            ],
          );
        });
      },
      progress: bytes => {
        navigation.navigate('Transfer', { total: 0, received: bytes });
      },
      done: (filePath, verified) => {
        navigation.navigate('Done', { filePath, verified });
      },
      cancelled: () => navigation.goBack(),
      error: msg => Alert.alert('Error', msg),
    });

    return () => {
      mounted = false;
      if (advertisingName.current) stopAdvertising(advertisingName.current);
      serverRef.current?.close();
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

  const qrData = JSON.stringify({ ip, port: PORT, name: deviceName });

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Receive Mode</Text>

      <TouchableOpacity style={styles.nameRow} onPress={() => { setNewName(deviceName); setShowRename(true); }}>
        <Text style={styles.label}>{deviceName || '...'}</Text>
        <Text style={styles.editHint}>✏️ tap to rename</Text>
      </TouchableOpacity>

      {ipLoading ? (
        <View style={styles.ipBox}>
          <ActivityIndicator color="#818cf8" />
          <Text style={styles.ipDetecting}>Detecting IP...</Text>
        </View>
      ) : ip ? (
        <View style={styles.ipBox}>
          <Text style={styles.ipLabel}>Your IP — share with sender</Text>
          <Text style={styles.ipValue}>{ip}</Text>
          <Text style={styles.ipPort}>Port: {PORT}</Text>
          <TouchableOpacity onPress={() => { setManualIpInput(ip); setShowManualIp(true); }}>
            <Text style={styles.ipOverride}>Wrong IP? Set manually</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.ipBox}>
          <Text style={styles.ipLabel}>IP not detected</Text>
          <Text style={styles.ipFail}>Hotspot/WiFi IP not found</Text>
          <TouchableOpacity style={styles.ipSetBtn} onPress={() => { setManualIpInput(''); setShowManualIp(true); }}>
            <Text style={styles.ipSetBtnText}>Set IP Manually</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.qr}>
        {ip && deviceName ? (
          <QRCode value={qrData} size={200} backgroundColor="#1e293b" color="#f8fafc" />
        ) : (
          <View style={styles.qrPlaceholder}>
            <ActivityIndicator color="#818cf8" />
            <Text style={styles.qrWait}>Generating QR...</Text>
          </View>
        )}
      </View>
      <Text style={styles.waiting}>Waiting for sender...</Text>

      {/* Manual IP override modal */}
      <Modal visible={showManualIp} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Set Your IP</Text>
            <Text style={styles.modalSub}>Check Settings → WiFi / Hotspot for your IP</Text>
            <TextInput
              style={styles.modalInput}
              value={manualIpInput}
              onChangeText={setManualIpInput}
              placeholder="192.168.x.x"
              placeholderTextColor="#475569"
              keyboardType="numeric"
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowManualIp(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={() => {
                const trimmed = manualIpInput.trim();
                if (trimmed) setIp(trimmed);
                setShowManualIp(false);
              }}>
                <Text style={styles.modalSaveText}>Set IP</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showRename} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Set Device Name</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="My Phone"
              placeholderTextColor="#475569"
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
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', padding: 24 },
  title: { fontSize: 24, fontWeight: '700', color: '#f8fafc', marginBottom: 12 },
  nameRow: { alignItems: 'center', marginBottom: 16 },
  label: { fontSize: 18, color: '#818cf8', fontWeight: '600' },
  editHint: { fontSize: 11, color: '#475569', marginTop: 2 },
  ipBox: { backgroundColor: '#1e293b', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#4f46e5', minWidth: 220 },
  ipLabel: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  ipValue: { color: '#818cf8', fontSize: 28, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  ipPort: { color: '#475569', fontSize: 12 },
  ipDetecting: { color: '#64748b', fontSize: 13, marginTop: 8 },
  ipFail: { color: '#ef4444', fontSize: 13, marginTop: 4, textAlign: 'center' },
  ipOverride: { color: '#475569', fontSize: 11, marginTop: 6, textDecorationLine: 'underline' },
  ipSetBtn: { marginTop: 8, backgroundColor: '#6366f1', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  ipSetBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  qr: { backgroundColor: '#1e293b', padding: 16, borderRadius: 16, marginBottom: 20, minWidth: 232, minHeight: 232, alignItems: 'center', justifyContent: 'center' },
  qrPlaceholder: { alignItems: 'center', gap: 12 },
  qrWait: { color: '#64748b', fontSize: 13 },
  waiting: { fontSize: 14, color: '#94a3b8', fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#1e293b', borderRadius: 16, padding: 24, width: '80%', borderWidth: 1, borderColor: '#334155' },
  modalTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  modalSub: { color: '#64748b', fontSize: 12, marginBottom: 16 },
  modalInput: { backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: '#4f46e5' },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, backgroundColor: '#0f172a', borderRadius: 10, padding: 12, alignItems: 'center' },
  modalCancelText: { color: '#94a3b8', fontWeight: '600' },
  modalSave: { flex: 1, backgroundColor: '#6366f1', borderRadius: 10, padding: 12, alignItems: 'center' },
  modalSaveText: { color: '#fff', fontWeight: '700' },
});
