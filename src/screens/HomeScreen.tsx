import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Modal,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { requestPermissions } from '../permissions';
import { getDeviceName, saveDeviceName } from '../utils/deviceName';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const [deviceName, setDeviceName] = useState('');
  const [showRename, setShowRename] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    getDeviceName().then(setDeviceName);
  }, []);

  async function goSend() {
    const ok = await requestPermissions();
    if (ok) navigation.navigate('Send');
  }

  async function goReceive() {
    const ok = await requestPermissions();
    if (ok) navigation.navigate('Receive');
  }

  async function handleRename() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await saveDeviceName(trimmed);
    setDeviceName(trimmed);
    setShowRename(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>SecureShare</Text>
      <Text style={styles.sub}>Encrypted local file transfer</Text>

      <TouchableOpacity
        style={styles.nameTag}
        onPress={() => { setNewName(deviceName); setShowRename(true); }}>
        <Text style={styles.nameTagLabel}>YOUR DEVICE NAME</Text>
        <Text style={styles.nameTagValue}>{deviceName || '...'}</Text>
        <Text style={styles.nameTagEdit}>Tap to change ✏️</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btn} onPress={goSend}>
        <Text style={styles.btnText}>Send Files</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={goReceive}>
        <Text style={styles.btnText}>Receive Files</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Help')}>
        <Text style={styles.help}>Help</Text>
      </TouchableOpacity>

      <Modal visible={showRename} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Set Your Device Name</Text>
            <Text style={styles.modalSub}>This name shows to nearby devices</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. John's Phone"
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
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a', padding: 24 },
  title: { fontSize: 32, fontWeight: '800', color: '#f8fafc', marginBottom: 8 },
  sub: { fontSize: 14, color: '#94a3b8', marginBottom: 24 },
  nameTag: { backgroundColor: '#1e293b', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center', marginBottom: 32, borderWidth: 1, borderColor: '#334155', width: '100%' },
  nameTagLabel: { color: '#64748b', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  nameTagValue: { color: '#818cf8', fontSize: 20, fontWeight: '700', marginBottom: 2 },
  nameTagEdit: { color: '#475569', fontSize: 11 },
  btn: { width: '100%', backgroundColor: '#6366f1', borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 16 },
  btnSecondary: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  btnText: { color: '#f8fafc', fontWeight: '700', fontSize: 16 },
  help: { marginTop: 24, color: '#64748b', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#1e293b', borderRadius: 16, padding: 24, width: '85%', borderWidth: 1, borderColor: '#334155' },
  modalTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  modalSub: { color: '#64748b', fontSize: 12, marginBottom: 16 },
  modalInput: { backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: '#4f46e5' },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, backgroundColor: '#0f172a', borderRadius: 10, padding: 12, alignItems: 'center' },
  modalCancelText: { color: '#94a3b8', fontWeight: '600' },
  modalSave: { flex: 1, backgroundColor: '#6366f1', borderRadius: 10, padding: 12, alignItems: 'center' },
  modalSaveText: { color: '#fff', fontWeight: '700' },
});
