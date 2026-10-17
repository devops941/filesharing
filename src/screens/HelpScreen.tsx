import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Help'>;

const ITEMS = [
  { q: 'Devices not showing up?', a: 'Both phones must be on the same Wi-Fi or one phone\'s hotspot. Check that the Receive screen is open.' },
  { q: 'Pairing code mismatch?', a: 'Tap Cancel and retry. A mismatch means someone else may be connecting.' },
  { q: 'Transfer slow?', a: 'Wi-Fi direct / hotspot is fastest. Avoid router-heavy setups. Expected: 5–15 MB/s via JS bridge.' },
  { q: 'iOS not discovering Android?', a: 'Ensure NSBonjourServices is set in Info.plist and the app has Local Network permission.' },
  { q: 'Where are received files?', a: 'Android: Downloads/SecureShare. iOS: Files app → On My iPhone → SecureShare.' },
  { q: 'Is the transfer encrypted?', a: 'Yes — end-to-end with XChaCha20-Poly1305 (libsodium). The 6-digit code confirms key exchange.' },
];

export default function HelpScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Help & FAQ</Text>
        {ITEMS.map((item, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.q}>{item.q}</Text>
            <Text style={styles.a}>{item.a}</Text>
          </View>
        ))}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 24 },
  title: { fontSize: 24, fontWeight: '700', color: '#f8fafc', marginBottom: 24 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 12 },
  q: { color: '#818cf8', fontWeight: '700', fontSize: 14, marginBottom: 6 },
  a: { color: '#94a3b8', fontSize: 13, lineHeight: 20 },
  backBtn: { marginTop: 24, alignItems: 'center', padding: 16, backgroundColor: '#1e293b', borderRadius: 12 },
  backText: { color: '#f8fafc', fontWeight: '600' },
});
