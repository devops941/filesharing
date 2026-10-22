import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { requestPermissions } from '../permissions';
import { getDeviceName } from '../utils/deviceName';
import { setupNotifications } from '../notifications';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

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
      <StatusBar barStyle="light-content" />

      {/* Top section: icon badge + title + subtitle */}
      <View style={styles.topSection}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconEmoji}>🔒</Text>
        </View>
        <Text style={styles.title}>SecureShare</Text>
        <Text style={styles.subtitle}>
          {deviceName ? `${deviceName} · End-to-end encrypted` : 'End-to-end encrypted'}
        </Text>
      </View>

      {/* Middle section: Send + Receive cards */}
      <View style={styles.cardsSection}>
        <TouchableOpacity style={styles.sendCard} onPress={goSend} activeOpacity={0.85}>
          <View style={styles.sendIconCircle}>
            <Text style={styles.sendIconText}>↑</Text>
          </View>
          <View style={styles.cardTextBlock}>
            <Text style={styles.sendCardTitle}>Send</Text>
            <Text style={styles.sendCardSub}>Share files to a nearby device</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.receiveCard} onPress={goReceive} activeOpacity={0.85}>
          <View style={styles.receiveIconCircle}>
            <Text style={styles.receiveIconText}>↓</Text>
          </View>
          <View style={styles.cardTextBlock}>
            <Text style={styles.receiveCardTitle}>Receive</Text>
            <Text style={styles.receiveCardSub}>Accept files from a nearby device</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Bottom: help link */}
      <TouchableOpacity onPress={() => navigation.navigate('Help')} style={styles.helpContainer}>
        <Text style={styles.help}>Help</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
  },
  topSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadge: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: C.primaryBg,
    borderWidth: 1,
    borderColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconEmoji: {
    fontSize: 36,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: C.text,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: C.textSub,
    letterSpacing: 0.2,
  },
  cardsSection: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },
  sendCard: {
    backgroundColor: C.primary,
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sendIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIconText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#052E16',
  },
  cardTextBlock: {
    flex: 1,
  },
  sendCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#052E16',
    marginBottom: 2,
  },
  sendCardSub: {
    fontSize: 13,
    color: '#1A5C32',
    fontWeight: '500',
  },
  receiveCard: {
    backgroundColor: C.surface,
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  receiveIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiveIconText: {
    fontSize: 20,
    fontWeight: '800',
    color: C.text,
  },
  receiveCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
    marginBottom: 2,
  },
  receiveCardSub: {
    fontSize: 13,
    color: C.textSub,
    fontWeight: '500',
  },
  helpContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  help: {
    color: C.textDim,
    fontSize: 13,
    fontWeight: '500',
  },
});
