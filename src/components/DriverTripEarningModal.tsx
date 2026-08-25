import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { DriverTripEarning } from '@/types';
import { paymentMockService } from '@/services/paymentMockService';

interface DriverTripEarningModalProps {
  visible: boolean;
  onClose: () => void;
  missionId?: string | number | null;
  requestId?: string | number | null;
  distanceKm?: number;
  onConfirmed?: (earning: DriverTripEarning) => void;
}

export default function DriverTripEarningModal({
  visible,
  onClose,
  missionId,
  requestId,
  distanceKm,
  onConfirmed,
}: DriverTripEarningModalProps) {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  if (!missionId) return null;

  const earning = paymentMockService.getDriverTripEarning(missionId, {
    requestId: requestId || undefined,
    distanceKm: distanceKm || undefined,
  });

  const isCollected = earning.collectionStatus !== 'PENDING';

  const handleConfirmCash = async () => {
    try {
      setIsProcessing(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      const updated = await paymentMockService.confirmDriverCashCollection(missionId, earning.totalTripFare);
      setIsProcessing(false);
      Alert.alert(
        'Đã Xác Nhận Thu Tiền Mặt',
        `Đã ghi nhận thu tiền mặt ${paymentMockService.formatCurrency(earning.totalTripFare)} từ người nhà cho cuốc xe #${missionId}.`
      );
      if (onConfirmed) {
        onConfirmed(updated);
      }
    } catch (e) {
      setIsProcessing(false);
      Alert.alert('Lỗi', 'Không thể xác nhận lúc này, vui lòng thử lại');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="cash-multiple" size={20} color="#10B981" />
              </View>
              <View>
                <Text style={styles.modalTitle}>THÙ LAO & THU NHẬP THEO CUỐC</Text>
                <Text style={styles.subCodeText}>
                  Cuốc xe #{earning.missionId} • Yêu cầu #{earning.requestId || '20'}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Total Earning Hero Box */}
            <View style={styles.heroEarningBox}>
              <Text style={styles.heroEarningLabel}>THÙ LAO TÀI XẾ NHẬN ĐƯỢC</Text>
              <Text style={styles.heroEarningValue}>
                +{paymentMockService.formatCurrency(earning.driverTotalEarned)}
              </Text>
              <View style={styles.heroBadgeRow}>
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                <Text style={styles.heroBadgeText}>Đã cộng vào ví thu nhập tài xế</Text>
              </View>
            </View>

            {/* Compensation Breakdown */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>CHI TIẾT THÙ LAO LÁI XE CẤP CỨU</Text>

              <View style={styles.itemRow}>
                <Text style={styles.itemLabel}>Thù lao mở cuốc cố định:</Text>
                <Text style={styles.itemValue}>{paymentMockService.formatCurrency(earning.baseEarning)}</Text>
              </View>

              <View style={styles.itemRow}>
                <Text style={styles.itemLabel}>Cước theo km ({earning.distanceKm} km x 15k):</Text>
                <Text style={styles.itemValue}>{paymentMockService.formatCurrency(earning.distanceEarning)}</Text>
              </View>

              <View style={styles.itemRow}>
                <Text style={styles.itemLabel}>Phụ cấp kíp trực / khẩn cấp:</Text>
                <Text style={[styles.itemValue, { color: '#34D399' }]}>
                  +{paymentMockService.formatCurrency(earning.emergencyAllowance)}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.itemRow}>
                <Text style={styles.totalLabel}>TỔNG THỰC NHẬN CUỐC NÀY:</Text>
                <Text style={styles.totalValue}>{paymentMockService.formatCurrency(earning.driverTotalEarned)}</Text>
              </View>
            </View>

            {/* Fare Collection Section from Patient */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>THU CƯỚC TỪ NGƯỜI NHÀ / BỆNH NHÂN</Text>

              <View style={styles.itemRow}>
                <Text style={styles.itemLabel}>Tổng cước chuyến xe 115:</Text>
                <Text style={[styles.itemValue, { fontWeight: '800' }]}>
                  {paymentMockService.formatCurrency(earning.totalTripFare)}
                </Text>
              </View>

              <View style={styles.itemRow}>
                <Text style={styles.itemLabel}>Hình thức thu:</Text>
                <Text style={styles.itemValue}>
                  {earning.collectionStatus === 'PAID_DIGITAL' ? 'Chuyển khoản VietQR' : 'Tiền mặt'}
                </Text>
              </View>

              {/* Status Banner */}
              <View style={[styles.collectionBanner, isCollected ? styles.bannerPaid : styles.bannerPending]}>
                <Ionicons
                  name={isCollected ? 'checkmark-circle' : 'alert-circle'}
                  size={16}
                  color={isCollected ? '#10B981' : '#F59E0B'}
                />
                <Text style={[styles.bannerText, { color: isCollected ? '#34D399' : '#FBBF24' }]}>
                  {earning.collectionStatus === 'PAID_DIGITAL'
                    ? 'Người nhà đã chuyển khoản VietQR thành công'
                    : earning.collectionStatus === 'COLLECTED_CASH'
                    ? 'Tài xế đã xác nhận thu tiền mặt đầy đủ'
                    : 'Chưa thu tiền cước cuốc xe'}
                </Text>
              </View>

              {/* Cash Collection Button if needed */}
              {earning.collectionStatus === 'PENDING' && (
                <TouchableOpacity
                  style={styles.confirmCashBtn}
                  onPress={handleConfirmCash}
                  disabled={isProcessing}
                  activeOpacity={0.85}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#022C22" />
                  ) : (
                    <>
                      <FontAwesome5 name="money-bill-wave" size={15} color="#022C22" style={{ marginRight: 8 }} />
                      <Text style={styles.confirmCashBtnText}>
                        XÁC NHẬN ĐÃ THU TIỀN MẶT ({paymentMockService.formatCurrency(earning.totalTripFare)})
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subCodeText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollArea: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  heroEarningBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  heroEarningLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroEarningValue: {
    color: '#10B981',
    fontSize: 26,
    fontWeight: '900',
    marginVertical: 4,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  heroBadgeText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  itemLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  itemValue: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 10,
  },
  totalLabel: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  totalValue: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '900',
  },
  collectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  bannerPaid: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  bannerPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  bannerText: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  confirmCashBtn: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  confirmCashBtnText: {
    color: '#022C22',
    fontSize: 12,
    fontWeight: '900',
  },
});
