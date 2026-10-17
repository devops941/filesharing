import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { startAdvertising, stopAdvertising } from '../net/discovery';
import { startReceiver } from '../net/receiver';
import type { OfferInfo } from '../net/receiver';
import { PORT } from '../config';

type Props = NativeStackScreenProps<RootStackParamList, 'Receive'>;

function getDeviceName(): string {
  // Fallback device name
  return 'SecureShare-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export default function ReceiveScreen({ navigation }: Props) {
  const [deviceName] = useState(getDeviceName);
  const [ip, setIp] = useState('');
  const serverRef = useRef<any>(null);
  const pendingCode = useRef<{ resolve: (ok: boolean) => void } | null>(null);
  const pendingAccept = useRef<{ resolve: (ok: boolean) => void } | null>(null);

  useEffect(() => {
    // Get local IP from network info
    import('react-native').then(({ NativeModules }) => {
      // Use a best-effort IP placeholder; mDNS resolves the real one
      setIp('(mDNS)');
    });

    startAdvertising(deviceName);

    serverRef.current = startReceiver({
      confirmCode: code => {
        return new Promise(resolve => {
          pendingCode.current = { resolve };
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
      stopAdvertising(deviceName);
      serverRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const qrData = JSON.stringify({ ip, port: PORT, name: deviceName });

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Receive Mode</Text>
      <Text style={styles.label}>{deviceName}</Text>
      <Text style={styles.sub}>Port {PORT}</Text>
      <View style={styles.qr}>
        <QRCode value={qrData} size={200} backgroundColor="#1e293b" color="#f8fafc" />
      </View>
      <Text style={styles.waiting}>Waiting for sender...</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', padding: 24 },
  title: { fontSize: 24, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
  label: { fontSize: 18, color: '#818cf8', fontWeight: '600', marginBottom: 4 },
  sub: { fontSize: 13, color: '#64748b', marginBottom: 32 },
  qr: { backgroundColor: '#1e293b', padding: 16, borderRadius: 16, marginBottom: 32 },
  waiting: { fontSize: 14, color: '#94a3b8', fontStyle: 'italic' },
});
