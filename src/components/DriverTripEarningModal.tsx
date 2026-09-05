import React, { useState, useEffect } from 'react';
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
import { DriverTripEarning, DriverEarningDetailResponse } from '@/types';
import { api } from '@/services/api';

interface DriverTripEarningModalProps {
  visible: boolean;
  onClose: () => void;
  missionId?: string | number | null;
  requestId?: string | number | null;
  distanceKm?: number;
  onConfirmed?: (earning: any) => void;
}

export default function DriverTripEarningModal({
  visible,
  onClose,
  missionId,
  requestId,
  distanceKm,
  onConfirmed,
}: DriverTripEarningModalProps) {
  const [realEarning, setRealEarning] = useState<DriverEarningDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const formatVND = (num?: number | null) => {
    if (num == null || isNaN(num)) return '0 đ';
    return new Intl.NumberFormat('vi-VN').format(Math.round(num)) + ' đ';
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (visible && missionId) {
      setLoading(true);
      setRealEarning(null);
      (async () => {
        try {
          const res = await api.getMyEarningByMission(missionId);
          if (isMounted) {
            setRealEarning(res);
            setLoading(false);
          }
        } catch (err) {
          console.warn('[DriverTripEarningModal] Load real earning error:', err);
          if (isMounted) {
            setLoading(false);
          }
        }
      })();
    }
    return () => {
      isMounted = false;
    };
  }, [visible, missionId]);

  if (!missionId) return null;

  const isPaid = realEarning?.paymentStatus === 'SUCCESS' || realEarning?.paymentStatus === 'PAID';
  const driverEarned = realEarning?.driverAmount ?? 0;
  const grossFare = realEarning?.grossFare ?? 0;
  const platformFee = realEarning?.platformCommission ?? 0;
  const providerEarned = realEarning?.providerAmount ?? 0;
  const billableDist = realEarning?.distanceKm ?? distanceKm ?? 0;

  const handleConfirmCash = async () => {
    Alert.alert(
      'Xác Nhận Thu Tiền Mặt 💵',
      `Bạn xác nhận đã nhận đủ ${formatVND(grossFare)} bằng tiền mặt từ người nhà bệnh nhân cho cuốc xe #${missionId}?`,
      [
        { text: 'Hủy bỏ', style: 'cancel' },
        {
          text: 'XÁC NHẬN ĐÃ THU',
          onPress: async () => {
            try {
              setIsProcessing(true);
              const updated = await api.collectCash(missionId);
              setRealEarning(updated);
              setIsProcessing(false);

              Alert.alert(
                'Thành Công! 🎉',
                `Đã xác nhận thu tiền mặt ${formatVND(grossFare)} từ người nhà cho cuốc xe #${missionId}. Thù lao tài xế đã được cộng vào ví!`
              );
              if (onConfirmed) {
                onConfirmed(updated);
              }
            } catch (e: any) {
              setIsProcessing(false);
              Alert.alert('Lỗi', e?.message || 'Không thể xác nhận thu tiền mặt. Vui lòng thử lại sau.');
            }
          },
        },
      ]
    );
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
                  Cuốc xe #{missionId} {realEarning?.requestId || requestId ? `• Yêu cầu #${realEarning?.requestId || requestId}` : ''}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={{ color: '#94A3B8', marginTop: 10, fontSize: 12 }}>
                Đang tải dữ liệu thù lao tài xế...
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
              {/* Total Earning Hero Box */}
              <View style={styles.heroEarningBox}>
                <Text style={styles.heroEarningLabel}>THÙ LAO TÀI XẾ NHẬN ĐƯỢC</Text>
                <Text style={styles.heroEarningValue}>
                  +{formatVND(driverEarned)}
                </Text>
                <View style={styles.heroBadgeRow}>
                  <Ionicons
                    name={isPaid ? 'checkmark-circle' : 'time'}
                    size={14}
                    color={isPaid ? '#10B981' : '#F59E0B'}
                  />
                  <Text style={[styles.heroBadgeText, { color: isPaid ? '#10B981' : '#F59E0B' }]}>
                    {isPaid ? 'Đã cộng vào ví thu nhập tài xế' : 'Chờ hoàn tất thanh toán / thu tiền mặt'}
                  </Text>
                </View>
              </View>

              {/* Compensation Breakdown */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>CHI TIẾT THÙ LAO LÁI XE CẤP CỨU</Text>

                <View style={styles.itemRow}>
                  <Text style={styles.itemLabel}>Cự ly vận chuyển tính phí:</Text>
                  <Text style={[styles.itemValue, { color: '#38BDF8' }]}>
                    {billableDist ? `${billableDist.toFixed(1)} km` : 'Chưa tính'}
                  </Text>
                </View>

                <View style={styles.itemRow}>
                  <Text style={styles.itemLabel}>Tổng cước chuyến xe:</Text>
                  <Text style={styles.itemValue}>{formatVND(grossFare)}</Text>
                </View>

                <View style={styles.itemRow}>
                  <Text style={styles.itemLabel}>Chiết khấu hệ thống:</Text>
                  <Text style={[styles.itemValue, { color: '#F87171' }]}>
                    -{formatVND(platformFee)}
                  </Text>
                </View>

                {providerEarned > 0 && (
                  <View style={styles.itemRow}>
                    <Text style={styles.itemLabel}>Phần nhà xe / đơn vị quản lý:</Text>
                    <Text style={styles.itemValue}>{formatVND(providerEarned)}</Text>
                  </View>
                )}

                <View style={styles.divider} />

                <View style={styles.itemRow}>
                  <Text style={styles.totalLabel}>THÙ LAO TÀI XẾ THỰC NHẬN:</Text>
                  <Text style={styles.totalValue}>+{formatVND(driverEarned)}</Text>
                </View>
              </View>

              {/* Fare Collection Section from Patient */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>THU CƯỚC TỪ NGƯỜI NHÀ / BỆNH NHÂN</Text>

                <View style={styles.itemRow}>
                  <Text style={styles.itemLabel}>Tổng cước chuyến xe 115:</Text>
                  <Text style={[styles.itemValue, { fontWeight: '800' }]}>
                    {formatVND(grossFare)}
                  </Text>
                </View>

                <View style={styles.itemRow}>
                  <Text style={styles.itemLabel}>Hình thức thanh toán:</Text>
                  <Text style={styles.itemValue}>
                    {realEarning?.paymentMethod || (isPaid ? 'ĐIỆN TỬ / VIETQR' : 'Chưa thu')}
                  </Text>
                </View>

                {/* Status Banner */}
                <View style={[styles.collectionBanner, isPaid ? styles.bannerPaid : styles.bannerPending]}>
                  <Ionicons
                    name={isPaid ? 'checkmark-circle' : 'alert-circle'}
                    size={16}
                    color={isPaid ? '#10B981' : '#F59E0B'}
                  />
                  <Text style={[styles.bannerText, { color: isPaid ? '#34D399' : '#FBBF24' }]}>
                    {isPaid
                      ? `Đã thanh toán qua ${realEarning?.paymentMethod || 'VIETQR'} ${formatDate(realEarning?.paidAt)}`
                      : 'Chưa thu tiền cước cuốc xe. Có thể thu tiền mặt trực tiếp.'}
                  </Text>
                </View>

                {/* Cash Collection Button if needed */}
                {!isPaid && (
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
                          XÁC NHẬN ĐÃ THU TIỀN MẶT ({formatVND(grossFare)})
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          )}
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
    paddingBottom: 30,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subCodeText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollArea: {
    padding: 16,
  },
  heroEarningBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 16,
  },
  heroEarningLabel: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroEarningValue: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '900',
    marginVertical: 4,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  heroBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 14,
    gap: 8,
  },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  itemValue: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 4,
  },
  totalLabel: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '900',
  },
  totalValue: {
    color: '#34D399',
    fontSize: 15,
    fontWeight: '900',
  },
  collectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    marginTop: 4,
  },
  bannerPaid: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  bannerPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  bannerText: {
    fontSize: 10,
    fontWeight: '700',
    flex: 1,
  },
  confirmCashBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  confirmCashBtnText: {
    color: '#022C22',
    fontSize: 11,
    fontWeight: '900',
  },
});
