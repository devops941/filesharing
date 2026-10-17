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

type Props = NativeStackScreenProps<RootStackParamList, 'Pairing'>;

export default function PairingScreen({ navigation, route }: Props) {
  const { code, onConfirm } = route.params;

  function confirm() {
    onConfirm(true);
    navigation.goBack();
  }

  function cancel() {
    onConfirm(false);
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Verify Pairing</Text>
      <Text style={styles.sub}>Both devices must show the same code</Text>
      <View style={styles.codeBox}>
        <Text style={styles.code}>{code}</Text>
      </View>
      <Text style={styles.hint}>Compare this code on both phones before confirming</Text>
      <TouchableOpacity style={styles.confirmBtn} onPress={confirm}>
        <Text style={styles.confirmText}>Codes Match — Confirm</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancelBtn} onPress={cancel}>
        <Text style={styles.cancelText}>Codes Don't Match — Cancel</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', padding: 24 },
  title: { fontSize: 24, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
  sub: { fontSize: 14, color: '#94a3b8', marginBottom: 40, textAlign: 'center' },
  codeBox: { backgroundColor: '#1e293b', borderRadius: 20, paddingHorizontal: 40, paddingVertical: 24, marginBottom: 24, borderWidth: 2, borderColor: '#6366f1' },
  code: { fontSize: 48, fontWeight: '900', color: '#818cf8', letterSpacing: 8 },
  hint: { fontSize: 13, color: '#64748b', marginBottom: 40, textAlign: 'center', maxWidth: 280 },
  confirmBtn: { width: '100%', backgroundColor: '#22c55e', borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 12 },
  confirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: { width: '100%', backgroundColor: '#1e293b', borderRadius: 14, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: '#ef4444' },
  cancelText: { color: '#ef4444', fontWeight: '600', fontSize: 15 },
});
