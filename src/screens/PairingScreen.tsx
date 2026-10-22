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

const C = {
  bg: '#0F1117',
  surface: '#1A1C24',
  surface2: '#22242E',
  primary: '#4ADE80',
  primaryBg: '#052E16',
  accent: '#818CF8',
  text: '#E2E4EE',
  textSub: '#888BA0',
  textDim: '#4E5068',
  border: '#252830',
  red: '#F87171',
};

export default function PairingScreen({ navigation, route }: Props) {
  const { code, onConfirm } = route.params;

  function confirm() {
    onConfirm(true);
    if (route.params.transferParams) {
      // Sender side: replace Pairing with Transfer so back button won't re-open pairing
      navigation.replace('Transfer', route.params.transferParams);
    } else {
      // Receiver side: replace Pairing with Transfer waiting for data
      navigation.replace('Transfer', { total: 0, received: 0 });
    }
  }

  function cancel() {
    onConfirm(false);
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Shield icon badge */}
      <View style={styles.shieldBadge}>
        <Text style={styles.shieldEmoji}>🛡️</Text>
      </View>

      <Text style={styles.title}>Verify Connection</Text>
      <Text style={styles.sub}>Do both devices show the same code?</Text>

      <View style={styles.spacer} />

      {/* Individual character boxes for the code */}
      <View style={styles.codeRow}>
        {code.split('').map((char: string, index: number) => (
          <View key={index} style={styles.codeCharBox}>
            <Text style={styles.codeChar}>{char}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.hint}>Compare this code on both phones before confirming</Text>

      <View style={styles.spacer} />

      <TouchableOpacity style={styles.confirmBtn} onPress={confirm} activeOpacity={0.85}>
        <Text style={styles.confirmText}>Codes Match — Confirm</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={cancel} activeOpacity={0.85}>
        <Text style={styles.cancelText}>Codes Don't Match — Cancel</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
    padding: 24,
  },
  shieldBadge: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  shieldEmoji: {
    fontSize: 36,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: C.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    color: C.textSub,
    textAlign: 'center',
    maxWidth: 280,
  },
  spacer: {
    height: 40,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  codeCharBox: {
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
  },
  codeChar: {
    fontSize: 36,
    fontWeight: '900',
    color: C.accent,
    letterSpacing: 4,
  },
  hint: {
    fontSize: 13,
    color: C.textDim,
    textAlign: 'center',
    maxWidth: 280,
  },
  confirmBtn: {
    width: '100%',
    backgroundColor: C.primary,
    borderRadius: 100,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmText: {
    color: '#052E16',
    fontWeight: '700',
    fontSize: 15,
  },
  cancelBtn: {
    width: '100%',
    backgroundColor: C.surface2,
    borderRadius: 100,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.red,
  },
  cancelText: {
    color: C.red,
    fontWeight: '600',
    fontSize: 15,
  },
});
