import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { confirmDelivery } from '../../api/tms';
import { DeliveryStop } from '../../types';
import { COLORS } from '../../constants';

export function DeliverScreen() {
  const navigation = useNavigation<any>();
  const navRoute = useRoute<any>();
  const { stop, isLastStop } = navRoute.params as { stop: DeliveryStop; isLastStop: boolean };
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const callRecipient = () => {
    if (stop.recipient_phone) {
      Linking.openURL(`tel:${stop.recipient_phone}`);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera permission required');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.6,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleConfirm = async (outcome: 'delivered' | 'failed') => {
    if (outcome === 'failed' && !notes.trim()) {
      Alert.alert('Required', 'Please enter a reason for failed delivery');
      return;
    }
    setSubmitting(true);
    try {
      await confirmDelivery(stop.id, notes || undefined, photoUri || undefined);
      if (isLastStop) {
        Alert.alert(
          '🎉 Route Complete!',
          'All stops have been delivered. Great work!',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        navigation.goBack();
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error?.message ?? 'Failed to confirm delivery');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Stop Header */}
      <View style={styles.headerCard}>
        <Text style={styles.stopLabel}>Stop {stop.stop_sequence}</Text>
        <Text style={styles.recipient}>{stop.recipient_name ?? 'Unknown Recipient'}</Text>
        <Text style={styles.address}>{stop.address}</Text>
        {stop.recipient_phone && (
          <TouchableOpacity style={styles.callBtn} onPress={callRecipient}>
            <Text style={styles.callBtnText}>📞 {stop.recipient_phone}</Text>
          </TouchableOpacity>
        )}
        {stop.so_number && (
          <Text style={styles.soNum}>SO: {stop.so_number}</Text>
        )}
      </View>

      {/* Notes */}
      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={styles.notesInput}
        placeholder="Add delivery notes..."
        placeholderTextColor={COLORS.textMuted}
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
      />

      {/* POD Photo */}
      <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
        <Text style={styles.photoBtnText}>
          {photoUri ? '✅ Photo Taken — Retake' : '📷 Take POD Photo'}
        </Text>
      </TouchableOpacity>

      {/* Action Buttons */}
      <TouchableOpacity
        style={[styles.deliverBtn, submitting && styles.btnDisabled]}
        onPress={() => handleConfirm('delivered')}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.deliverBtnText}>✓ Mark as Delivered</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.failBtn, submitting && styles.btnDisabled]}
        onPress={() => handleConfirm('failed')}
        disabled={submitting}
      >
        <Text style={styles.failBtnText}>✗ Mark as Failed</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 40 },
  headerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  stopLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
    letterSpacing: 1,
    marginBottom: 6,
  },
  recipient: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  address: { fontSize: 14, color: COLORS.textMuted, marginBottom: 10 },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  callBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
  soNum: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  notesInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: 14,
  },
  photoBtn: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  photoBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
  deliverBtn: {
    backgroundColor: COLORS.success,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  deliverBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  failBtn: {
    borderWidth: 2,
    borderColor: COLORS.danger,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  failBtnText: { color: COLORS.danger, fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
});
