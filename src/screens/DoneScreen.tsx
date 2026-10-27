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
  success: '#059669', // Mint Green
  successGlow: 'rgba(5, 150, 105, 0.12)',
  text: '#0F172A',
  textSub: '#475569',
  textDim: '#94A3B8',
  border: '#E2E8F0',
  borderHighlight: 'rgba(5, 150, 105, 0.35)',
  red: '#DC2626',
};

type Props = NativeStackScreenProps<RootStackParamList, 'Done'>;

export default function DoneScreen({ navigation, route }: Props) {
  const { filePath, verified } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.contentWrap}>
        {/* Status circle checkmark */}
        <View style={styles.statusGlow}>
          <View style={[styles.statusCircle, verified ? styles.statusCircleVerified : styles.statusCircleUnverified]}>
            <Text style={[styles.statusIcon, verified ? styles.statusIconVerified : styles.statusIconUnverified]}>
              {verified ? '✓' : '!'}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {verified ? 'Transfer Complete' : 'Transfer Finished'}
        </Text>
        <Text style={styles.subtitle}>
          Files shared successfully via Quick Share
        </Text>

        {/* File count chip */}
        {(route.params.fileCount ?? 1) > 1 && (
          <View style={styles.fileCountChip}>
            <Text style={styles.fileCountText}>
              {route.params.fileCount} files transferred
            </Text>
          </View>
        )}

        {/* Saved location card */}
        {filePath ? (
          <View style={styles.pathCard}>
            <Text style={styles.pathLabel}>Saved Location</Text>
            <Text style={styles.pathText} numberOfLines={2}>
              {filePath}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Action buttons */}
      <View style={styles.btnBlock}>
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.85}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sendAnotherBtn}
          onPress={() => navigation.navigate('Send')}
          activeOpacity={0.85}>
          <Text style={styles.sendAnotherText}>Send More Files</Text>
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
    alignItems: 'center',
  },
  contentWrap: {
    alignItems: 'center',
    paddingTop: 36,
    width: '100%',
  },
  statusGlow: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: C.successGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  statusCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  statusCircleVerified: {
    backgroundColor: '#ECFDF5',
    borderColor: C.success,
  },
  statusCircleUnverified: {
    backgroundColor: '#FEF2F2',
    borderColor: C.red,
  },
  statusIcon: {
    fontSize: 40,
    fontWeight: '900',
  },
  statusIconVerified: {
    color: C.success,
  },
  statusIconUnverified: {
    color: C.red,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: C.text,
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    color: C.textSub,
    textAlign: 'center',
    marginBottom: 20,
  },
  fileCountChip: {
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.25)',
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 20,
  },
  fileCountText: {
    color: C.success,
    fontSize: 13,
    fontWeight: '700',
  },
  pathCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  pathLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textDim,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  pathText: {
    fontSize: 13,
    color: C.textSub,
    lineHeight: 18,
  },
  btnBlock: {
    width: '100%',
    gap: 12,
    paddingBottom: 8,
  },
  doneBtn: {
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
  doneBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  sendAnotherBtn: {
    width: '100%',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  sendAnotherText: {
    color: C.textSub,
    fontWeight: '700',
    fontSize: 15,
  },
});
