import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
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
  accent: '#6366F1',
  success: '#059669',
  text: '#0F172A',
  textSub: '#475569',
  textDim: '#94A3B8',
  border: '#E2E8F0',
  borderHighlight: 'rgba(2, 132, 199, 0.35)',
  red: '#DC2626',
};

type Props = NativeStackScreenProps<RootStackParamList, 'Pairing'>;

export default function PairingScreen({ navigation, route }: Props) {
  const { code, onConfirm } = route.params;

  function confirm() {
    onConfirm(true);
    if (route.params.transferParams) {
      // Sender side: replace Pairing with Transfer
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
      <StatusBar barStyle="dark-content" />

      <View style={styles.contentWrap}>
        {/* Shield icon badge */}
        <View style={styles.shieldGlow}>
          <View style={styles.shieldBadge}>
            <Text style={styles.shieldEmoji}>🛡️</Text>
          </View>
        </View>

        <Text style={styles.title}>Quick Share</Text>
        <Text style={styles.sub}>
          Make sure this code matches the code on the other phone
        </Text>

        {/* 6-Digit code card */}
        <View style={styles.codeCard}>
          <View style={styles.codeRow}>
            {code.split('').map((char: string, index: number) => (
              <View key={index} style={styles.codeCharBox}>
                <Text style={styles.codeChar}>{char}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.hint}>6-digit cryptographic PIN</Text>
        </View>
      </View>

      {/* Confirmation buttons */}
      <View style={styles.buttonBlock}>
        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={confirm}
          activeOpacity={0.85}>
          <Text style={styles.confirmText}>Codes Match — Accept</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={cancel}
          activeOpacity={0.85}>
          <Text style={styles.cancelText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 24,
    paddingVertical: 20,
    justifyContent: 'space-between',
  },
  contentWrap: {
    alignItems: 'center',
    paddingTop: 32,
  },
  shieldGlow: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: C.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  shieldBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#E0F2FE',
    borderWidth: 2,
    borderColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  shieldEmoji: {
    fontSize: 34,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: C.text,
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  sub: {
    fontSize: 14,
    color: C.textSub,
    textAlign: 'center',
    maxWidth: 290,
    lineHeight: 20,
    marginBottom: 32,
  },
  codeCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    justifyContent: 'center',
  },
  codeCharBox: {
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 42,
  },
  codeChar: {
    fontSize: 28,
    fontWeight: '900',
    color: C.primary,
  },
  hint: {
    fontSize: 12,
    color: C.textDim,
    textAlign: 'center',
  },
  buttonBlock: {
    gap: 12,
    paddingBottom: 8,
  },
  confirmBtn: {
    width: '100%',
    backgroundColor: C.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  confirmText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  cancelBtn: {
    width: '100%',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelText: {
    color: C.textSub,
    fontWeight: '700',
    fontSize: 15,
  },
});
