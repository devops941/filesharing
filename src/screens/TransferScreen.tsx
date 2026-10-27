import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useKeepAwake } from 'expo-keep-awake';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { cancelActiveTransfer } from '../net/activeTransfer';

// Quick Share Light Theme Palette
const C = {
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  surface2: '#E2E8F0',
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

const RADIUS = 88;
const CIRC = 2 * Math.PI * RADIUS;

type Props = NativeStackScreenProps<RootStackParamList, 'Transfer'>;

export default function TransferScreen({ navigation, route }: Props) {
  useKeepAwake();
  const total = route.params.total ?? 0;
  const received = route.params.received ?? 0;
  const startTime = useRef<number | null>(null);
  const prevFileIdx = useRef<number | undefined>(undefined);

  useEffect(() => {
    const fi = route.params.fileIndex;
    if (fi !== undefined && fi !== prevFileIdx.current) {
      prevFileIdx.current = fi;
      startTime.current = null;
    }
  }, [route.params.fileIndex]);

  if (received > 0 && !startTime.current) {
    startTime.current = Date.now();
  }

  const pct = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
  const elapsed = startTime.current ? (Date.now() - startTime.current) / 1000 : 0;
  const speed = elapsed > 0.5 ? received / elapsed / 1024 / 1024 : 0;
  const remaining = speed > 0 && total > 0 ? (total - received) / 1024 / 1024 / speed : 0;

  const strokeDash = (pct / 100) * CIRC;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Top section: Transfer status and file metadata */}
      <View style={styles.topInfoSection}>
        <Text style={styles.screenTitle}>Quick Share</Text>
        <Text style={styles.screenSub}>Transferring data securely...</Text>

        <View style={styles.fileCard}>
          <Text style={styles.fileIconText}>📄</Text>
          <View style={styles.fileMetaWrap}>
            {route.params.fileTotal && route.params.fileTotal > 1 ? (
              <Text style={styles.fileCountBadge}>
                File {route.params.fileIndex ?? 1} of {route.params.fileTotal}
              </Text>
            ) : null}
            <Text style={styles.fileNameText} numberOfLines={1}>
              {route.params.fileName || 'File Transfer'}
            </Text>
          </View>
        </View>
      </View>

      {/* Circular progress ring */}
      <View style={styles.ringContainer}>
        <View style={styles.ringWrap}>
          <Svg width={210} height={210} viewBox="0 0 210 210">
            <Circle
              cx={105}
              cy={105}
              r={RADIUS}
              stroke={C.surface2}
              strokeWidth={14}
              fill="none"
            />
            <Circle
              cx={105}
              cy={105}
              r={RADIUS}
              stroke={C.primary}
              strokeWidth={14}
              fill="none"
              strokeDasharray={`${strokeDash} ${CIRC - strokeDash}`}
              strokeLinecap="round"
              rotation={-90}
              origin="105, 105"
            />
          </Svg>
          <View style={styles.ringCenter}>
            <Text style={styles.pctText}>{pct}%</Text>
            <View style={styles.speedPill}>
              <Text style={styles.speedText}>{speed > 0 ? `${speed.toFixed(1)} MB/s` : 'Connecting...'}</Text>
            </View>
          </View>
        </View>

        {/* Transferred size info */}
        <Text style={styles.sizeText}>
          {received > 0 ? (received / 1024 / 1024).toFixed(1) : '0.0'}
          {' / '}
          {total > 0 ? (total / 1024 / 1024).toFixed(1) : '—'} MB
        </Text>

        {/* ETA */}
        {remaining > 0 && (
          <Text style={styles.etaText}>About {Math.ceil(remaining)}s left</Text>
        )}
      </View>

      {/* Cancel button */}
      <TouchableOpacity
        style={styles.cancelBtn}
        onPress={() => {
          cancelActiveTransfer();
          navigation.goBack();
        }}
        activeOpacity={0.8}>
        <Text style={styles.cancelText}>Cancel Transfer</Text>
      </TouchableOpacity>
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
    alignItems: 'center',
  },
  topInfoSection: {
    alignItems: 'center',
    width: '100%',
    paddingTop: 16,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: C.text,
    marginBottom: 4,
  },
  screenSub: {
    fontSize: 13,
    color: C.textSub,
    marginBottom: 20,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    padding: 14,
    width: '100%',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  fileIconText: {
    fontSize: 26,
  },
  fileMetaWrap: {
    flex: 1,
  },
  fileCountBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: C.primary,
    marginBottom: 2,
  },
  fileNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },
  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWrap: {
    width: 210,
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pctText: {
    fontSize: 44,
    fontWeight: '900',
    color: C.text,
    letterSpacing: -1,
  },
  speedPill: {
    backgroundColor: '#E0F2FE',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  speedText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.primary,
  },
  sizeText: {
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
    marginBottom: 6,
  },
  etaText: {
    fontSize: 13,
    color: C.textSub,
  },
  cancelBtn: {
    width: '100%',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  cancelText: {
    color: C.red,
    fontWeight: '700',
    fontSize: 15,
  },
});
