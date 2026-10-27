import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

// Quick Share Light Theme Palette
const C = {
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  surface2: '#F1F5F9',
  surfaceCard: '#FFFFFF',
  primary: '#0284C7', // Quick Share Sky Blue
  primaryGlow: 'rgba(2, 132, 199, 0.12)',
  text: '#0F172A',
  textSub: '#475569',
  textDim: '#94A3B8',
  border: '#E2E8F0',
};

type Props = NativeStackScreenProps<RootStackParamList, 'Help'>;

const ITEMS = [
  {
    q: 'How does Quick Share work?',
    a: 'Quick Share connects two nearby devices directly using peer-to-peer Wi-Fi Direct or local Wi-Fi. It streams files directly without using mobile data or uploading to any cloud server.',
  },
  {
    q: 'Devices not showing up?',
    a: '1. Turn ON Wi-Fi and Location on both phones.\n2. Open the Receive screen on the receiving device.\n3. Keep both devices close to each other.',
  },
  {
    q: 'What is the 6-digit verification code?',
    a: 'It is a cryptographic Short Authentication String (SAS) derived from X25519 key exchange. When the codes match on both screens, it guarantees your connection is 100% secure with no third party eavesdropping.',
  },
  {
    q: 'Where are received files saved?',
    a: 'On Android, files are saved to your Downloads/SecureShare folder and are accessible through any file manager.',
  },
  {
    q: 'How fast is Quick Share?',
    a: 'Quick Share establishes a direct Wi-Fi socket capable of transfer speeds up to 30–50 MB/s, transferring gigabytes of photos or videos in seconds.',
  },
];

export default function HelpScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & FAQ</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {ITEMS.map((item, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.q}>{item.q}</Text>
            <Text style={styles.a}>{item.a}</Text>
          </View>
        ))}

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.doneBtn}
          activeOpacity={0.8}>
          <Text style={styles.doneText}>Back to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
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
    fontSize: 18,
    fontWeight: '800',
    color: C.text,
  },
  placeholder: {
    width: 44,
  },
  scroll: {
    padding: 20,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  q: {
    color: C.primary,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 8,
  },
  a: {
    color: C.textSub,
    fontSize: 13,
    lineHeight: 20,
  },
  doneBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  doneText: {
    color: C.text,
    fontWeight: '700',
    fontSize: 15,
  },
});
