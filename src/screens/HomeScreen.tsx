import React, { useEffect, useState } from 'react';
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
import { requestPermissions } from '../permissions';
import { getDeviceName } from '../utils/deviceName';
import { setupNotifications } from '../notifications';

// Quick Share Light Theme Palette
const C = {
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  surface2: '#F1F5F9',
  surfaceCard: '#FFFFFF',
  primary: '#0284C7', // Quick Share Sky Blue
  primaryGlow: 'rgba(2, 132, 199, 0.12)',
  accent: '#6366F1', // Electric Indigo
  success: '#059669',
  text: '#0F172A',
  textSub: '#475569',
  textDim: '#94A3B8',
  border: '#E2E8F0',
  borderHighlight: 'rgba(2, 132, 199, 0.35)',
};

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const [deviceName, setDeviceName] = useState('');

  useEffect(() => {
    getDeviceName().then(setDeviceName);
    setupNotifications();
  }, []);

  async function goSend() {
    await requestPermissions('send');
    navigation.navigate('Send');
  }

  async function goReceive() {
    await requestPermissions('receive');
    navigation.navigate('Receive');
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Top identity bar */}
      <View style={styles.topIdentity}>
        <View style={styles.deviceChip}>
          <View style={styles.activeDot} />
          <Text style={styles.deviceNameText} numberOfLines={1}>
            {deviceName || 'My Device'}
          </Text>
        </View>
      </View>

      {/* Hero section */}
      <View style={styles.heroSection}>
        <View style={styles.brandIconGlow}>
          <View style={styles.brandIconCircle}>
            <Text style={styles.brandIconEmoji}>⚡</Text>
          </View>
        </View>
        <Text style={styles.title}>Quick Share</Text>
        <Text style={styles.subtitle}>
          Fast, direct peer-to-peer file sharing
        </Text>
      </View>

      {/* Middle action cards */}
      <View style={styles.cardsSection}>
        <TouchableOpacity
          style={styles.actionCardPrimary}
          onPress={goSend}
          activeOpacity={0.85}>
          <View style={styles.actionIconWrapPrimary}>
            <Text style={styles.actionIconPrimary}>↑</Text>
          </View>
          <View style={styles.cardTextBlock}>
            <Text style={styles.cardTitlePrimary}>Send</Text>
            <Text style={styles.cardSubPrimary}>
              Share files with a nearby device
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCardSecondary}
          onPress={goReceive}
          activeOpacity={0.85}>
          <View style={styles.actionIconWrapSecondary}>
            <Text style={styles.actionIconSecondary}>↓</Text>
          </View>
          <View style={styles.cardTextBlock}>
            <Text style={styles.cardTitleSecondary}>Receive</Text>
            <Text style={styles.cardSubSecondary}>
              Accept files from a nearby device
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Bottom security footer */}
      <View style={styles.footer}>
        <View style={styles.encryptionBadge}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.encryptionText}>End-to-end encrypted · Direct P2P</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Help')}
          activeOpacity={0.7}
          style={styles.helpLink}>
          <Text style={styles.helpText}>Help & Info</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 22,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  topIdentity: {
    alignItems: 'center',
    paddingTop: 8,
  },
  deviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 100,
    paddingVertical: 7,
    paddingHorizontal: 16,
    gap: 8,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.success,
  },
  deviceNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
    maxWidth: 220,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  brandIconGlow: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: C.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  brandIconCircle: {
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
  brandIconEmoji: {
    fontSize: 34,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: C.text,
    marginBottom: 6,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 14,
    color: C.textSub,
    textAlign: 'center',
  },
  cardsSection: {
    gap: 14,
  },
  actionCardPrimary: {
    backgroundColor: C.primary,
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  actionIconWrapPrimary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconPrimary: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardTextBlock: {
    flex: 1,
  },
  cardTitlePrimary: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  cardSubPrimary: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  actionCardSecondary: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIconWrapSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconSecondary: {
    fontSize: 22,
    fontWeight: '800',
    color: C.primary,
  },
  cardTitleSecondary: {
    fontSize: 18,
    fontWeight: '800',
    color: C.text,
    marginBottom: 2,
  },
  cardSubSecondary: {
    fontSize: 13,
    color: C.textSub,
  },
  footer: {
    alignItems: 'center',
    gap: 12,
    paddingBottom: 8,
  },
  encryptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lockIcon: {
    fontSize: 13,
  },
  encryptionText: {
    fontSize: 12,
    color: C.textDim,
    fontWeight: '500',
  },
  helpLink: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  helpText: {
    fontSize: 13,
    color: C.textSub,
    fontWeight: '600',
  },
});
