import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useKeepAwake } from 'expo-keep-awake';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { cancelActiveTransfer } from '../net/activeTransfer';

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

const RADIUS = 86;
const CIRC = 2 * Math.PI * RADIUS;

type Props = NativeStackScreenProps<RootStackParamList, 'Transfer'>;

export default function TransferScreen({ navigation, route }: Props) {
  useKeepAwake(); // prevent screen from sleeping during transfer
  const total = route.params.total ?? 0;
  const received = route.params.received ?? 0;
  const startTime = useRef<number | null>(null);

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
      {/* File info header */}
      {route.params.fileTotal && route.params.fileTotal > 1 && (
        <Text style={styles.fileInfo}>
          File {route.params.fileIndex ?? 1} of {route.params.fileTotal}
          {route.params.fileName ? `  ·  ${route.params.fileName}` : ''}
        </Text>
      )}
      {route.params.fileName && (!route.params.fileTotal || route.params.fileTotal <= 1) && (
        <Text style={styles.fileInfo}>{route.params.fileName}</Text>
      )}

      {/* Circular progress ring */}
      <View style={styles.ringWrap}>
        <Svg width={200} height={200} viewBox="0 0 200 200">
          <Circle
            cx={100}
            cy={100}
            r={RADIUS}
            stroke={C.surface2}
            strokeWidth={14}
            fill="none"
          />
          <Circle
            cx={100}
            cy={100}
            r={RADIUS}
            stroke={C.primary}
            strokeWidth={14}
            fill="none"
            strokeDasharray={`${strokeDash} ${CIRC - strokeDash}`}
            strokeLinecap="round"
            rotation={-90}
            origin="100, 100"
          />
        </Svg>
        <View style={styles.ringCenter}>
          <Text style={styles.pctText}>{pct}%</Text>
          <Text style={styles.speedText}>{speed.toFixed(1)} MB/s</Text>
        </View>
      </View>

      {/* Received / total */}
      <Text style={styles.sizeText}>
        {received > 0 ? (received / 1024 / 1024).toFixed(1) : '0.0'}
        {' / '}
        {total > 0 ? (total / 1024 / 1024).toFixed(1) : '—'} MB
      </Text>

      {/* ETA */}
      {remaining > 0 && (
        <Text style={styles.etaText}>ETA {Math.ceil(remaining)}s</Text>
      )}

      {/* Cancel button */}
      <TouchableOpacity
        style={styles.cancelBtn}
        onPress={() => {
          cancelActiveTransfer();
          navigation.goBack();
        }}>
        <Text style={styles.cancelText}>Cancel</Text>
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
  fileInfo: {
    fontSize: 13,
    color: C.textSub,
    marginBottom: 32,
    textAlign: 'center',
    maxWidth: '90%' as any,
  },
  ringWrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  pctText: {
    fontSize: 36,
    fontWeight: '900',
    color: C.text,
  },
  speedText: {
    fontSize: 13,
    color: C.textSub,
    marginTop: 2,
  },
  sizeText: {
    fontSize: 15,
    color: C.textSub,
    marginBottom: 8,
  },
  etaText: {
    fontSize: 13,
    color: C.textDim,
    marginBottom: 40,
  },
  cancelBtn: {
    marginTop: 16,
    borderRadius: 50,
    paddingVertical: 14,
    paddingHorizontal: 44,
    borderWidth: 1.5,
    borderColor: C.red,
    backgroundColor: 'transparent',
  },
  cancelText: {
    color: C.red,
    fontWeight: '600',
    fontSize: 15,
  },
});
