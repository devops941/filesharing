import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { startScan, stopScan } from '../net/discovery';
import type { Device } from '../net/discovery';
import { sendFile } from '../net/sender';
import type { PickedFile } from '../net/sender';

type Props = NativeStackScreenProps<RootStackParamList, 'Send'>;

export default function SendScreen({ navigation }: Props) {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [scanning, setScanning] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrScanned, setQrScanned] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

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

  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: false,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setFile({
        uri: asset.uri,
        name: asset.name,
        size: asset.size ?? 0,
        type: asset.mimeType ?? undefined,
      });
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
    if (!file) {
      Alert.alert('Pick a file first');
      return;
    }
    navigation.navigate('Transfer', { total: file.size, received: 0 });
    await sendFile(device, file, {
      confirmCode: code =>
        new Promise(resolve => {
          navigation.navigate('Pairing', {
            code,
            onConfirm: (ok: boolean) => resolve(ok),
          });
        }),
      progress: sent => navigation.setParams({ received: sent } as any),
      done: () => navigation.navigate('Done', { filePath: '', verified: true }),
      rejected: reason => Alert.alert('Rejected', reason),
      error: msg => Alert.alert('Error', msg),
      cancelled: () => navigation.goBack(),
    });
  }

  async function connectManual() {
    if (!manualIp.trim()) return;
    const device: Device = { name: 'Manual', ip: manualIp.trim(), port: 47800 };
    await connectToDevice(device);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Send File</Text>

      {/* File picker */}
      <TouchableOpacity style={styles.btn} onPress={pickFile}>
        <Text style={styles.btnText} numberOfLines={1}>
          {file ? `📄 ${file.name}` : 'Pick File'}
        </Text>
      </TouchableOpacity>
      {file && (
        <Text style={styles.fileSize}>
          {(file.size / 1024 / 1024).toFixed(2)} MB
        </Text>
      )}

      {/* Nearby devices via mDNS */}
      <Text style={styles.sectionTitle}>Nearby Devices</Text>
      {scanning && devices.length === 0 && (
        <ActivityIndicator color="#6366f1" style={{ marginVertical: 8 }} />
      )}
      <FlatList
        data={devices}
        keyExtractor={d => d.ip}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.deviceRow}
            onPress={() => connectToDevice(item)}>
            <Text style={styles.deviceName}>
              {item.platform === 'android' ? '🤖' : '🍎'} {item.name}
            </Text>
            <Text style={styles.deviceIp}>{item.ip}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Scanning… open Receive on the other phone</Text>
        }
        style={styles.list}
      />

      {/* QR scan */}
      <Text style={styles.sectionTitle}>Scan QR Code</Text>
      <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={openQrScanner}>
        <Text style={styles.btnText}>📷  Scan Receiver QR Code</Text>
      </TouchableOpacity>

      {/* Manual IP */}
      <Text style={styles.sectionTitle}>Enter IP Manually</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="192.168.x.x"
          placeholderTextColor="#475569"
          value={manualIp}
          onChangeText={setManualIp}
          keyboardType="numeric"
        />
        <TouchableOpacity style={styles.goBtn} onPress={connectManual}>
          <Text style={styles.goBtnText}>Go</Text>
        </TouchableOpacity>
      </View>

      {/* QR Scanner Modal */}
      <Modal visible={showQrScanner} animationType="slide">
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleQrScanned}
          />
          <View style={styles.scannerOverlay}>
            <Text style={styles.scannerLabel}>Point at the QR code on the receiver</Text>
            <TouchableOpacity
              style={styles.cancelScanBtn}
              onPress={() => setShowQrScanner(false)}>
              <Text style={styles.cancelScanText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 24 },
  title: { fontSize: 24, fontWeight: '700', color: '#f8fafc', marginBottom: 16 },
  btn: { backgroundColor: '#6366f1', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 4 },
  btnSecondary: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#4f46e5', marginTop: 4 },
  btnText: { color: '#f8fafc', fontWeight: '600', fontSize: 15 },
  fileSize: { color: '#94a3b8', fontSize: 12, marginBottom: 12, textAlign: 'center' },
  sectionTitle: { color: '#64748b', fontSize: 11, fontWeight: '700', marginTop: 18, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  list: { maxHeight: 180 },
  deviceRow: { backgroundColor: '#1e293b', borderRadius: 10, padding: 14, marginBottom: 8 },
  deviceName: { color: '#f8fafc', fontSize: 15, fontWeight: '600' },
  deviceIp: { color: '#64748b', fontSize: 12, marginTop: 2 },
  empty: { color: '#475569', fontSize: 13, fontStyle: 'italic', textAlign: 'center', marginVertical: 8 },
  row: { flexDirection: 'row', gap: 8, marginTop: 4 },
  input: { flex: 1, backgroundColor: '#1e293b', color: '#f8fafc', borderRadius: 10, padding: 12, fontSize: 14 },
  goBtn: { backgroundColor: '#6366f1', borderRadius: 10, paddingHorizontal: 20, justifyContent: 'center' },
  goBtnText: { color: '#f8fafc', fontWeight: '700' },
  scannerContainer: { flex: 1, backgroundColor: '#000' },
  scannerOverlay: { position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', gap: 16 },
  scannerLabel: { color: '#f8fafc', fontSize: 14, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  cancelScanBtn: { backgroundColor: '#ef4444', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  cancelScanText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
