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
  const [realPayment, setRealPayment] = useState<PaymentDetailResponse | null>(null);

  // Fetch real payment from backend when opened
  useEffect(() => {
    if (!visible || !callId) return;

    let isMounted = true;
    (async () => {
      try {
        const res = await api.getReporterPaymentByCallId(callId);
        if (isMounted && res && res.paymentId) {
          setRealPayment(res);
        }
      } catch (err) {
        // Im silent fallback to mock
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [visible, callId]);

  if (!callId) return null;

  const mockInvoice = paymentMockService.getInvoiceByCallId(callId);
  
  // Xác định gói dịch vụ: ALS (300k base, 45k/km) vs BLS (200k base, 40k/km)
  const isBLS = (realPayment?.serviceTypeCode === 'BLS') || 
                (mockInvoice.vehicleType?.toUpperCase().includes('BLS')) || 
                (!realPayment && Number(callId) % 2 === 1);
  const serviceTypeCode = isBLS ? 'BLS' : 'ALS';
  const serviceTypeName = isBLS ? 'Xe Cấp Cứu Tiêu Chuẩn (BLS)' : 'Xe Cấp Cứu Hồi Sức Nâng Cao (ALS)';

  const defaultBaseFare = isBLS ? 200000 : 300000;
  const defaultPricePerKm = isBLS ? 40000 : 45000;

  const baseFare = realPayment?.baseFare ?? defaultBaseFare;
  const pricePerKm = realPayment?.pricePerKm ?? defaultPricePerKm;
  const distanceKm = realPayment?.billableDistanceKm ?? mockInvoice.distanceKm;
  const distanceFare = realPayment?.distanceFare ?? Math.round(distanceKm * pricePerKm);
  const totalAmount = realPayment?.totalAmount ?? (baseFare + distanceFare);

  // Use real backend payment if available, else mock
  const isPaid = realPayment ? (realPayment.status === 'PAID' || !!realPayment.paidAt) : mockInvoice.paymentStatus === 'PAID';
  const invoiceCode = realPayment ? `HĐ-${realPayment.paymentId}` : mockInvoice.invoiceCode;
  const pickupAddress = realPayment?.pickupAddress || mockInvoice.pickupAddress;
  const hospitalAddress = realPayment?.hospitalAddress || mockInvoice.hospitalAddress;
  const licensePlate = realPayment?.licensePlate || mockInvoice.licensePlate;

  const invoice = {
    ...mockInvoice,
    invoiceCode,
    totalAmount,
    paymentStatus: (isPaid ? 'PAID' : 'UNPAID') as any,
    distanceKm,
    pickupAddress,
    hospitalAddress,
    licensePlate,
    vehicleType: realPayment?.serviceTypeCode ? serviceTypeName : mockInvoice.vehicleType,
    patientName: realPayment?.patientName || mockInvoice.patientName,
    patientPhone: realPayment?.patientPhone || mockInvoice.patientPhone,
    paymentMethod: (realPayment?.paymentMethod as any) || mockInvoice.paymentMethod,
    paidAt: realPayment?.paidAt || mockInvoice.paidAt,
  };

  const handlePayNow = async () => {
    try {
      if (!realPayment) {
        Alert.alert(
          'Dự Tính Chi Phí Cấp Cứu',
          `Ca cấp cứu #${callId} đang được thực hiện. Sau khi xe cứu thương đưa bệnh nhân đến bệnh viện an toàn và hoàn thành nhiệm vụ, hệ thống sẽ chốt cự ly thực tế và xuất hóa đơn điện tử chính thức để bạn thanh toán.`
        );
        return;
      }

      setIsProcessing(true);

      if (realPayment.paymentId && selectedMethod !== 'CASH') {
        const updated = await api.payReporterPayment(realPayment.paymentId, {
          paymentMethod: selectedMethod as 'VIETQR' | 'VNPAY' | 'MOMO',
        });
        setRealPayment(updated);
      }

      const updatedMock = await paymentMockService.processPayment(callId, selectedMethod);
      setIsProcessing(false);

      Alert.alert(
        'Thanh Toán Thành Công! 🎉',
        `Hóa đơn ${invoiceCode} trị giá ${paymentMockService.formatCurrency(totalAmount)} đã được thanh toán thành công qua ${selectedMethod}.`
      );
      if (onPaymentSuccess) {
        onPaymentSuccess(updatedMock);
      }
    } catch (e: any) {
      setIsProcessing(false);
      Alert.alert('Lỗi', e?.message || 'Thanh toán không thành công, vui lòng thử lại');
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
                <Text style={styles.invoiceCodeText}>{invoice.invoiceCode}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Status Banner */}
            <View style={[styles.statusBanner, isPaid ? styles.statusPaid : !realPayment ? styles.statusEstimate : styles.statusUnpaid]}>
              <Ionicons
                name={isPaid ? 'checkmark-circle' : !realPayment ? 'information-circle' : 'time-outline'}
                size={18}
                color={isPaid ? '#10B981' : !realPayment ? '#38BDF8' : '#F59E0B'}
              />
              <Text style={[styles.statusBannerText, { color: isPaid ? '#34D399' : !realPayment ? '#38BDF8' : '#FBBF24' }]}>
                {isPaid
                  ? 'ĐÃ THANH TOÁN HOÀN TẤT'
                  : !realPayment
                  ? 'BẢNG DỰ TÍNH CHI PHÍ (TẠM TÍNH)'
                  : 'CHỜ THANH TOÁN (HÓA ĐƠN ĐIỆN TỬ)'}
              </Text>
            </View>

            {/* General Trip Info */}
            <View style={styles.infoSection}>
              <Text style={styles.sectionHeader}>THÔNG TIN CHUYẾN CẤP CỨU</Text>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Bệnh nhân / Người gọi:</Text>
                <Text style={styles.infoValue}>{invoice.patientName} ({invoice.patientPhone})</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Mã cuộc gọi / Yêu cầu:</Text>
                <Text style={styles.infoValue}>#{invoice.callId} • Yêu cầu #{invoice.requestId}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Xe cấp cứu tiếp nhận:</Text>
                <Text style={[styles.infoValue, { color: '#34D399', fontWeight: '700' }]}>
                  {invoice.licensePlate} • {invoice.vehicleType}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Điểm đón (Hiện trường):</Text>
                <Text style={styles.infoValue} numberOfLines={2}>{invoice.pickupAddress}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Bệnh viện tiếp nhận:</Text>
                <Text style={styles.infoValue} numberOfLines={2}>{invoice.hospitalAddress}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Quãng đường vận chuyển:</Text>
                <Text style={styles.infoValue}>{invoice.distanceKm} km</Text>
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
                <Text style={styles.billItemPrice}>
                  {paymentMockService.formatCurrency(baseFare)}
                </Text>
              </View>

              <View style={styles.billItemRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.billItemName}>
                    Cước di chuyển theo quãng đường
                  </Text>
                  <Text style={styles.billItemSub}>
                    {distanceKm.toFixed(1)} km × {paymentMockService.formatCurrency(pricePerKm)}/km
                  </Text>
                </View>
                <Text style={styles.billItemPrice}>
                  {paymentMockService.formatCurrency(distanceFare)}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>TỔNG CẦN THANH TOÁN:</Text>
                <Text style={styles.totalValue}>{paymentMockService.formatCurrency(totalAmount)}</Text>
              </View>
            </View>

            {/* Payment Details if Paid */}
            {isPaid ? (
              <View style={styles.paidDetailCard}>
                <View style={styles.paidHeaderRow}>
                  <MaterialCommunityIcons name="shield-check" size={20} color="#10B981" />
                  <Text style={styles.paidHeaderText}>HÓA ĐƠN ĐÃ ĐƯỢC XÁC THỰC</Text>
                </View>
                <Text style={styles.paidSubText}>Phương thức: {invoice.paymentMethod || 'VIETQR'}</Text>
                <Text style={styles.paidSubText}>Mã giao dịch: {invoice.transactionRef || 'VQR987216'}</Text>
                {invoice.paidAt && (
                  <Text style={styles.paidSubText}>
                    Thời gian: {new Date(invoice.paidAt).toLocaleString('vi-VN')}
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
                    <MaterialCommunityIcons name="qrcode-scan" size={18} color={selectedMethod === 'VIETQR' ? '#10B981' : '#94A3B8'} />
                    <Text style={[styles.methodBtnText, selectedMethod === 'VIETQR' && styles.methodBtnTextActive]}>
                      VietQR Ngân hàng
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.methodBtn, selectedMethod === 'VNPAY' && styles.methodBtnActive]}
                    onPress={() => setSelectedMethod('VNPAY')}
                  >
                    <Ionicons name="card-outline" size={18} color={selectedMethod === 'VNPAY' ? '#10B981' : '#94A3B8'} />
                    <Text style={[styles.methodBtnText, selectedMethod === 'VNPAY' && styles.methodBtnTextActive]}>
                      VNPAY-QR
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.methodBtn, selectedMethod === 'MOMO' && styles.methodBtnActive]}
                    onPress={() => setSelectedMethod('MOMO')}
                  >
                    <Ionicons name="wallet-outline" size={18} color={selectedMethod === 'MOMO' ? '#10B981' : '#94A3B8'} />
                    <Text style={[styles.methodBtnText, selectedMethod === 'MOMO' && styles.methodBtnTextActive]}>
                      Ví MoMo
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.methodBtn, selectedMethod === 'CASH' && styles.methodBtnActive]}
                    onPress={() => setSelectedMethod('CASH')}
                  >
                    <Ionicons name="cash-outline" size={18} color={selectedMethod === 'CASH' ? '#10B981' : '#94A3B8'} />
                    <Text style={[styles.methodBtnText, selectedMethod === 'CASH' && styles.methodBtnTextActive]}>
                      Tiền mặt trực tiếp
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
                          invoice.totalAmount,
                          `Thanh toan cuoc cap cuu ${invoice.invoiceCode}`
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
                        XÁC NHẬN THANH TOÁN ({paymentMockService.formatCurrency(invoice.totalAmount)})
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
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
