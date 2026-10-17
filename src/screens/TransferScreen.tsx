import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Transfer'>;

export default function TransferScreen({ navigation, route }: Props) {
  useKeepAwake(); // prevent screen from sleeping during transfer
  const { total, received: initialReceived } = route.params;
  const [received, setReceived] = useState(initialReceived);
  const startTime = useRef(Date.now());

  useEffect(() => {
    setReceived(route.params.received);
  }, [route.params.received]);

  const pct = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
  const elapsed = (Date.now() - startTime.current) / 1000;
  const speed = elapsed > 0 ? received / elapsed / 1024 / 1024 : 0;
  const remaining = speed > 0 && total > 0 ? (total - received) / 1024 / 1024 / speed : 0;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Transferring...</Text>
      <Text style={styles.pct}>{pct}%</Text>

      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${pct}%` as any }]} />
      </View>

      <View style={styles.statsRow}>
        <Text style={styles.stat}>{speed.toFixed(1)} MB/s</Text>
        <Text style={styles.stat}>
          {received > 0 ? `${(received / 1024 / 1024).toFixed(1)} MB` : '—'}
          {total > 0 ? ` / ${(total / 1024 / 1024).toFixed(1)} MB` : ''}
        </Text>
        <Text style={styles.stat}>ETA {remaining > 0 ? `${Math.ceil(remaining)}s` : '—'}</Text>
      </View>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', color: '#f8fafc', marginBottom: 16 },
  pct: { fontSize: 56, fontWeight: '900', color: '#818cf8', marginBottom: 24 },
  barBg: { width: '100%', height: 12, backgroundColor: '#1e293b', borderRadius: 6, overflow: 'hidden', marginBottom: 20 },
  barFill: { height: '100%', backgroundColor: '#6366f1', borderRadius: 6 },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 48 },
  stat: { color: '#94a3b8', fontSize: 13 },
  cancelBtn: { backgroundColor: '#1e293b', borderRadius: 14, padding: 16, paddingHorizontal: 40, borderWidth: 1, borderColor: '#ef4444' },
  cancelText: { color: '#ef4444', fontWeight: '600', fontSize: 15 },
});
