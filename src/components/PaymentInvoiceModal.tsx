import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { PaymentInvoice, PaymentMethod, PaymentDetailResponse } from '@/types';
import { paymentMockService } from '@/services/paymentMockService';
import { api } from '@/services/api';

interface PaymentInvoiceModalProps {
  visible: boolean;
  onClose: () => void;
  callId?: string | number | null;
  onPaymentSuccess?: (invoice: PaymentInvoice) => void;
}

export default function PaymentInvoiceModal({
  visible,
  onClose,
  callId,
  onPaymentSuccess,
}: PaymentInvoiceModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('VIETQR');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLoadingPayment, setIsLoadingPayment] = useState<boolean>(false);
  const [realPayment, setRealPayment] = useState<PaymentDetailResponse | null>(null);

  // Fetch real payment from backend when opened (No silent mock fallback)
  useEffect(() => {
    if (!visible || !callId) {
      setRealPayment(null);
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        setIsLoadingPayment(true);
        const res = await api.getReporterPaymentByCallId(callId);
        if (isMounted) {
          setRealPayment(res && res.paymentId ? res : null);
          setIsLoadingPayment(false);
        }
      } catch (err) {
        console.warn('[PaymentModal] Load payment error:', err);
        if (isMounted) {
          setRealPayment(null);
          setIsLoadingPayment(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [visible, callId]);

  if (!callId) return null;

  // BE Payment contract: SUCCESS (hoặc PAID cho tương thích ngược)
  const isPaid = realPayment?.status === 'SUCCESS' || realPayment?.status === 'PAID';
  const isBLS = realPayment?.serviceTypeCode === 'BLS';
  const serviceTypeCode = isBLS ? 'BLS' : 'ALS';
  const serviceTypeName = isBLS ? 'Xe Cấp Cứu Tiêu Chuẩn (BLS)' : 'Xe Cấp Cứu Hồi Sức Nâng Cao (ALS)';

  const baseFare = realPayment?.baseFare ?? (isBLS ? 200000 : 300000);
  const pricePerKm = realPayment?.pricePerKm ?? (isBLS ? 40000 : 45000);
  const distanceKm = realPayment?.billableDistanceKm ?? 0;
  const distanceFare = realPayment?.distanceFare ?? Math.round(distanceKm * pricePerKm);
  const totalAmount = realPayment?.totalAmount ?? (baseFare + distanceFare);
  const invoiceCode = realPayment ? `HĐ-${realPayment.paymentId}` : `HĐ-CALL-${callId}`;

  const formatVND = (num?: number | null) => {
    if (num == null || isNaN(num)) return '0 đ';
    return new Intl.NumberFormat('vi-VN').format(Math.round(num)) + ' đ';
  };

  const handlePayNow = async () => {
    if (!realPayment || !realPayment.paymentId) {
      Alert.alert(
        'Ca Chưa Quyết Toán',
        `Ca cấp cứu #${callId} chưa chốt dữ liệu cước từ điều phối viên. Vui lòng thử lại sau khi hoàn tất ca cấp cứu.`
      );
      return;
    }

    try {
      setIsProcessing(true);

      // Gọi API thật lên Backend
      const updated = await api.payReporterPayment(realPayment.paymentId, {
        paymentMethod: selectedMethod as 'VIETQR' | 'VNPAY' | 'MOMO',
      });

      setRealPayment(updated);
      setIsProcessing(false);

      Alert.alert(
        'Thanh Toán Thành Công! 🎉',
        `Hóa đơn ${invoiceCode} trị giá ${formatVND(totalAmount)} đã được ghi nhận thanh toán thành công qua ${selectedMethod}.`
      );

      if (onPaymentSuccess) {
        onPaymentSuccess({
          id: `inv-${updated.paymentId}`,
          invoiceCode: `HĐ-${updated.paymentId}`,
          callId: updated.callId,
          requestId: updated.requestId || updated.callId,
          missionId: updated.missionId || 0,
          patientName: updated.patientName || 'Bệnh nhân',
          patientPhone: updated.patientPhone || '',
          pickupAddress: updated.pickupAddress || '',
          hospitalAddress: updated.hospitalAddress || '',
          distanceKm: updated.billableDistanceKm || distanceKm,
          vehicleType: serviceTypeName,
          licensePlate: updated.licensePlate || '',
          items: [
            {
              name: `Phí khởi động xe cấp cứu ${serviceTypeCode}`,
              quantity: 1,
              unitPrice: updated.baseFare || baseFare,
              totalPrice: updated.baseFare || baseFare,
            },
            {
              name: `Cước di chuyển (${(updated.billableDistanceKm || distanceKm).toFixed(1)} km × ${formatVND(updated.pricePerKm || pricePerKm)}/km)`,
              quantity: updated.billableDistanceKm || distanceKm,
              unitPrice: updated.pricePerKm || pricePerKm,
              totalPrice: updated.distanceFare || distanceFare,
            },
          ],
          subtotal: updated.totalAmount,
          discountAmount: 0,
          totalAmount: updated.totalAmount,
          paymentStatus: (updated.status === 'SUCCESS' || updated.status === 'PAID') ? 'PAID' : 'UNPAID',
          paymentMethod: selectedMethod,
          transactionRef: updated.externalTransactionId || null,
          createdAt: updated.createdAt || new Date().toISOString(),
          paidAt: updated.paidAt || new Date().toISOString(),
          notes: 'Thanh toán trực tuyến thành công',
        });
      }
    } catch (e: any) {
      setIsProcessing(false);
      Alert.alert('Lỗi Thanh Toán', e?.message || 'Không thể thực hiện thanh toán. Vui lòng thử lại sau.');
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
                <MaterialCommunityIcons name="receipt-text-outline" size={20} color="#10B981" />
              </View>
              <View>
                <Text style={styles.modalTitle}>HÓA ĐƠN & CHI PHÍ CẤP CỨU</Text>
                <Text style={styles.invoiceCodeText}>{invoiceCode}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {isLoadingPayment ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#EF4444" />
                <Text style={{ color: '#94A3B8', marginTop: 12, fontSize: 13, fontWeight: '600' }}>
                  Đang tải thông tin cước viện phí từ hệ thống...
                </Text>
              </View>
            ) : !realPayment ? (
              /* Chưa có Payment: Ca chưa được quyết toán */
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <View style={[styles.statusBanner, styles.statusEstimate, { width: '100%', marginBottom: 20 }]}>
                  <Ionicons name="time-outline" size={18} color="#38BDF8" />
                  <Text style={[styles.statusBannerText, { color: '#38BDF8' }]}>
                    CA CẤP CỨU CHƯA ĐƯỢC QUYẾT TOÁN
                  </Text>
                </View>

                <MaterialCommunityIcons name="receipt-text-clock" size={48} color="#64748B" style={{ marginBottom: 16 }} />
                <Text style={{ color: '#F1F5F9', fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
                  Chưa phát sinh hóa đơn cước phí
                </Text>
                <Text style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16, marginBottom: 24 }}>
                  Yêu cầu cấp cứu #{callId} đang trong quá trình xử lý hoặc chưa được điều phối viên chốt quyết toán chuyến đi.{'\n\n'}
                  Hóa đơn cước phí chính thức sẽ tự động xuất hiện sau khi xe cứu thương đưa bệnh nhân đến bệnh viện an toàn và hoàn tất nhiệm vụ.
                </Text>

                <TouchableOpacity
                  style={[styles.payNowBtn, { backgroundColor: '#334155', width: '100%' }]}
                  onPress={onClose}
                >
                  <Text style={[styles.payNowBtnText, { color: '#FFF' }]}>ĐÓNG</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Đã có Payment từ Backend */
              <>
                {/* Status Banner */}
                <View style={[styles.statusBanner, isPaid ? styles.statusPaid : styles.statusUnpaid]}>
                  <Ionicons
                    name={isPaid ? 'checkmark-circle' : 'time-outline'}
                    size={18}
                    color={isPaid ? '#10B981' : '#F59E0B'}
                  />
                  <Text style={[styles.statusBannerText, { color: isPaid ? '#34D399' : '#FBBF24' }]}>
                    {isPaid ? 'ĐÃ THANH TOÁN THÀNH CÔNG (SUCCESS)' : 'CHỜ THANH TOÁN (HÓA ĐƠN ĐIỆN TỬ)'}
                  </Text>
                </View>

                {/* General Trip Info */}
                <View style={styles.infoSection}>
                  <Text style={styles.sectionHeader}>THÔNG TIN CHUYẾN CẤP CỨU</Text>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Bệnh nhân / Người gọi:</Text>
                    <Text style={styles.infoValue}>
                      {realPayment.patientName || 'Phan Văn Nam'}{realPayment.patientPhone ? ` (${realPayment.patientPhone})` : ''}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Mã cuộc gọi / Yêu cầu:</Text>
                    <Text style={styles.infoValue}>
                      #{realPayment.callId || callId}{realPayment.requestId ? ` • Yêu cầu #${realPayment.requestId}` : ''}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Xe cấp cứu tiếp nhận:</Text>
                    <Text style={[styles.infoValue, { color: '#34D399', fontWeight: '700' }]}>
                      {realPayment.licensePlate || 'Xe 115'} • {serviceTypeName}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Điểm đón (Hiện trường):</Text>
                    <Text style={styles.infoValue} numberOfLines={2}>
                      {realPayment.pickupAddress || 'Hiện trường sơ cấp cứu 115'}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Bệnh viện tiếp nhận:</Text>
                    <Text style={styles.infoValue} numberOfLines={2}>
                      {realPayment.hospitalAddress || 'Bệnh viện Cấp Cứu 115'}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Quãng đường vận chuyển:</Text>
                    <Text style={styles.infoValue}>{(realPayment.billableDistanceKm || distanceKm).toFixed(1)} km</Text>
                  </View>
                </View>

                {/* Itemized Billing Breakdown */}
                <View style={styles.itemsSection}>
                  <Text style={styles.sectionHeader}>CHI TIẾT DỊCH VỤ & VIỆN PHÍ</Text>

                  <View style={styles.billItemRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.billItemName}>
                        Phí khởi động xe cấp cứu {serviceTypeCode}
                      </Text>
                      <Text style={styles.billItemSub}>
                        {isBLS ? 'Cấp cứu tiêu chuẩn (BLS)' : 'Hồi sức cấp cứu nâng cao (ALS)'}
                      </Text>
                    </View>
                    <Text style={styles.billItemPrice}>{formatVND(baseFare)}</Text>
                  </View>

                  <View style={styles.billItemRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.billItemName}>Cước di chuyển theo quãng đường</Text>
                      <Text style={styles.billItemSub}>
                        {(realPayment.billableDistanceKm || distanceKm).toFixed(1)} km × {formatVND(pricePerKm)}/km
                      </Text>
                    </View>
                    <Text style={styles.billItemPrice}>{formatVND(distanceFare)}</Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={[styles.summaryRow, styles.totalRow]}>
                    <Text style={styles.totalLabel}>TỔNG CẦN THANH TOÁN:</Text>
                    <Text style={styles.totalValue}>{formatVND(totalAmount)}</Text>
                  </View>
                </View>

                {/* Payment Details if Paid */}
                {isPaid ? (
                  <View style={styles.paidDetailCard}>
                    <View style={styles.paidHeaderRow}>
                      <MaterialCommunityIcons name="shield-check" size={20} color="#10B981" />
                      <Text style={styles.paidHeaderText}>HÓA ĐƠN ĐÃ ĐƯỢC XÁC THỰC</Text>
                    </View>
                    <Text style={styles.paidSubText}>Phương thức: {realPayment.paymentMethod || 'VIETQR'}</Text>
                    {realPayment.externalTransactionId && (
                      <Text style={styles.paidSubText}>Mã giao dịch: {realPayment.externalTransactionId}</Text>
                    )}
                    {realPayment.paidAt && (
                      <Text style={styles.paidSubText}>
                        Thời gian: {new Date(realPayment.paidAt).toLocaleString('vi-VN')}
                      </Text>
                    )}
                  </View>
                ) : (
                  /* Payment Methods Selection & VietQR if Unpaid */
                  <View style={styles.paymentMethodSection}>
                    <Text style={styles.sectionHeader}>PHƯƠNG THỨC THANH TOÁN</Text>

                    <View style={styles.methodList}>
                      <TouchableOpacity
                        style={[styles.methodBtn, selectedMethod === 'VIETQR' && styles.methodBtnActive]}
                        onPress={() => setSelectedMethod('VIETQR')}
                      >
                        <MaterialCommunityIcons
                          name="qrcode-scan"
                          size={18}
                          color={selectedMethod === 'VIETQR' ? '#10B981' : '#94A3B8'}
                        />
                        <Text style={[styles.methodBtnText, selectedMethod === 'VIETQR' && styles.methodBtnTextActive]}>
                          VietQR Ngân hàng
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.methodBtn, selectedMethod === 'VNPAY' && styles.methodBtnActive]}
                        onPress={() => setSelectedMethod('VNPAY')}
                      >
                        <Ionicons
                          name="card-outline"
                          size={18}
                          color={selectedMethod === 'VNPAY' ? '#10B981' : '#94A3B8'}
                        />
                        <Text style={[styles.methodBtnText, selectedMethod === 'VNPAY' && styles.methodBtnTextActive]}>
                          VNPAY-QR
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.methodBtn, selectedMethod === 'MOMO' && styles.methodBtnActive]}
                        onPress={() => setSelectedMethod('MOMO')}
                      >
                        <Ionicons
                          name="wallet-outline"
                          size={18}
                          color={selectedMethod === 'MOMO' ? '#10B981' : '#94A3B8'}
                        />
                        <Text style={[styles.methodBtnText, selectedMethod === 'MOMO' && styles.methodBtnTextActive]}>
                          Ví MoMo
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* QR Code display for VietQR */}
                    {selectedMethod === 'VIETQR' && (
                      <View style={styles.qrCard}>
                        <Text style={styles.qrTitle}>QUÉT MÃ VIETQR ĐỂ THANH TOÁN</Text>
                        <Image
                          source={{
                            uri: paymentMockService.getVietQRUrl(
                              totalAmount,
                              `Thanh toan cuoc cap cuu ${invoiceCode}`
                            ),
                          }}
                          style={styles.qrImage}
                          resizeMode="contain"
                        />
                        <Text style={styles.qrNote}>
                          Sử dụng ứng dụng ngân hàng bất kỳ để quét mã chuyển khoản tự động.
                        </Text>
                      </View>
                    )}

                    {/* Pay Button */}
                    <TouchableOpacity
                      style={styles.payNowBtn}
                      onPress={handlePayNow}
                      disabled={isProcessing}
                      activeOpacity={0.85}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size="small" color="#022C22" />
                      ) : (
                        <>
                          <FontAwesome5 name="check-circle" size={16} color="#022C22" style={{ marginRight: 8 }} />
                          <Text style={styles.payNowBtnText}>
                            XÁC NHẬN THANH TOÁN ({formatVND(totalAmount)})
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
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
    maxHeight: '90%',
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
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  invoiceCodeText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
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
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  statusPaid: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusUnpaid: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statusEstimate: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  statusBannerText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  sectionHeader: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  infoSection: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  infoLabel: {
    color: '#94A3B8',
    fontSize: 12,
    flex: 1,
  },
  infoValue: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '600',
    flex: 1.2,
    textAlign: 'right',
  },
  itemsSection: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  billItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  billItemName: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  billItemSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  billItemPrice: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  discountText: {
    color: '#34D399',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  summaryValue: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  totalLabel: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  totalValue: {
    color: '#10B981',
    fontSize: 17,
    fontWeight: '900',
  },
  paidDetailCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  paidHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  paidHeaderText: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '800',
  },
  paidSubText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  paymentMethodSection: {
    marginBottom: 20,
  },
  methodList: {
    gap: 8,
    marginBottom: 14,
  },
  methodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  methodBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981',
  },
  methodBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  methodBtnTextActive: {
    color: '#34D399',
    fontWeight: '800',
  },
  qrCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  qrTitle: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  qrImage: {
    width: 220,
    height: 220,
    marginBottom: 8,
  },
  qrNote: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
  },
  payNowBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  payNowBtnText: {
    color: '#022C22',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
