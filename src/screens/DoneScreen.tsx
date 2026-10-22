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

export default function DoneScreen({ navigation, route }: Props) {
  const { filePath, verified } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      {/* Status circle */}
      <View style={[styles.statusCircle, verified ? styles.statusCircleVerified : styles.statusCircleUnverified]}>
        <Text style={[styles.statusIcon, verified ? styles.statusIconVerified : styles.statusIconUnverified]}>
          {verified ? '✓' : '!'}
        </Text>
      </View>

      {/* Title */}
      <Text style={styles.title}>
        {verified ? 'Transfer Complete' : 'Transfer Done'}
      </Text>

      {/* File count chip */}
      {(route.params.fileCount ?? 1) > 1 && (
        <View style={styles.fileCountChip}>
          <Text style={styles.fileCountText}>{route.params.fileCount} files transferred</Text>
        </View>
      )}

      {/* Verified badge */}
      {verified && (
        <Text style={styles.verifiedBadge}>End-to-end verified ✓</Text>
      )}

      {/* File path */}
      {filePath ? (
        <Text style={styles.path} numberOfLines={3}>
          Saved to: {filePath}
        </Text>
      ) : null}

      <View style={styles.spacer} />

      {/* Done button */}
      <TouchableOpacity
        style={styles.doneBtn}
        onPress={() => navigation.navigate('Home')}
        activeOpacity={0.85}>
        <Text style={styles.doneBtnText}>Done</Text>
      </TouchableOpacity>

      {/* Send Another button */}
      <TouchableOpacity
        style={styles.sendAnotherBtn}
        onPress={() => navigation.navigate('Send')}
        activeOpacity={0.85}>
        <Text style={styles.sendAnotherText}>Send Another</Text>
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
  statusCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  statusCircleVerified: {
    backgroundColor: C.primaryBg,
    borderColor: C.primary,
  },
  statusCircleUnverified: {
    backgroundColor: C.surface2,
    borderColor: C.red,
  },
  statusIcon: {
    fontSize: 48,
    fontWeight: '800',
  },
  statusIconVerified: {
    color: C.primary,
  },
  statusIconUnverified: {
    color: C.red,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: C.text,
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  fileCountChip: {
    backgroundColor: C.primaryBg,
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 10,
  },
  fileCountText: {
    color: C.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  verifiedBadge: {
    color: C.primary,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 10,
  },
  path: {
    color: C.textDim,
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 300,
    marginTop: 4,
  },
  spacer: {
    height: 40,
  },
  doneBtn: {
    width: '100%',
    backgroundColor: C.primary,
    borderRadius: 100,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  doneBtnText: {
    color: '#052E16',
    fontWeight: '700',
    fontSize: 16,
  },
  sendAnotherBtn: {
    width: '100%',
    backgroundColor: C.surface2,
    borderRadius: 100,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  sendAnotherText: {
    color: C.text,
    fontWeight: '600',
    fontSize: 16,
  },
});
