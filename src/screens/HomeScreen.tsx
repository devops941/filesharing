import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { requestPermissions } from '../permissions';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  async function goSend() {
    const ok = await requestPermissions();
    if (ok) navigation.navigate('Send');
  }

  async function goReceive() {
    const ok = await requestPermissions();
    if (ok) navigation.navigate('Receive');
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>SecureShare</Text>
      <Text style={styles.sub}>Encrypted local file transfer</Text>
      <TouchableOpacity style={styles.btn} onPress={goSend}>
        <Text style={styles.btnText}>Send File</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={goReceive}>
        <Text style={styles.btnText}>Receive File</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Help')}>
        <Text style={styles.help}>Help</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a', padding: 24 },
  title: { fontSize: 32, fontWeight: '800', color: '#f8fafc', marginBottom: 8 },
  sub: { fontSize: 14, color: '#94a3b8', marginBottom: 48 },
  btn: { width: '100%', backgroundColor: '#6366f1', borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 16 },
  btnSecondary: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  btnText: { color: '#f8fafc', fontWeight: '700', fontSize: 16 },
  help: { marginTop: 24, color: '#64748b', fontSize: 13 },
});
