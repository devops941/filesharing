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

type Props = NativeStackScreenProps<RootStackParamList, 'Done'>;

export default function DoneScreen({ navigation, route }: Props) {
  const { filePath, verified } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.icon}>{verified ? '✓' : '!'}</Text>
      <Text style={styles.title}>
        {verified ? 'Transfer Complete' : 'Transfer Done (unverified)'}
      </Text>
      {(route.params.fileCount ?? 1) > 1 && (
        <Text style={styles.fileCount}>{route.params.fileCount} files transferred</Text>
      )}
      {verified && (
        <Text style={styles.badge}>Verified — file integrity confirmed</Text>
      )}
      {filePath ? (
        <Text style={styles.path} numberOfLines={3}>
          Saved to: {filePath}
        </Text>
      ) : null}

      <TouchableOpacity
        style={styles.btn}
        onPress={() => navigation.navigate('Home')}>
        <Text style={styles.btnText}>Back to Home</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.btnSecondary]}
        onPress={() => navigation.navigate('Send')}>
        <Text style={styles.btnText}>Send Another</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', padding: 24 },
  icon: { fontSize: 64, color: '#22c55e', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
  badge: { color: '#22c55e', fontSize: 13, marginBottom: 24, backgroundColor: '#052e16', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  fileCount: { color: '#818cf8', fontSize: 15, fontWeight: '600', marginBottom: 8 },
  path: { color: '#64748b', fontSize: 12, textAlign: 'center', marginBottom: 40, maxWidth: 300 },
  btn: { width: '100%', backgroundColor: '#6366f1', borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 12 },
  btnSecondary: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  btnText: { color: '#f8fafc', fontWeight: '700', fontSize: 15 },
});
