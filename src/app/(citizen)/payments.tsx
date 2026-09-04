import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  Image,
  Alert,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '@/services/api';
import { PaymentDetailResponse, PayPaymentRequest } from '@/types';

const { width } = Dimensions.get('window');

type TabFilter = 'ALL' | 'PENDING' | 'PAID';

export default function ReporterPaymentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const highlightCallId = params.callId ? Number(params.callId) : null;

  const [payments, setPayments] = useState<PaymentDetailResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<TabFilter>('ALL');

  // Detail & Pay Modal State
  const [selectedPayment, setSelectedPayment] = useState<PaymentDetailResponse | null>(null);
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [selectedMethod, setSelectedMethod] = useState<'VIETQR' | 'VNPAY' | 'MOMO'>('VIETQR');
  const [isPaying, setIsPaying] = useState<boolean>(false);

  // Fetch payments list
  const fetchPayments = useCallback(async (isPullRefresh = false) => {
    try {
      if (isPullRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const data = await api.getMyReporterPayments();
      if (Array.isArray(data)) {
        setPayments(data);

        // Auto open modal if navigated with specific callId
        if (highlightCallId) {
          const matched = data.find(p => p.callId === highlightCallId);
          if (matched) {
            setSelectedPayment(matched);
            setShowPayModal(true);
          }
        }
      } else if (data && typeof data === 'object') {
        setPayments([data]);
      } else {
        setPayments([]);
      }
    } catch (error: any) {
      console.warn('[ReporterPayments] Failed to fetch payments:', error);
      // Giữ nguyên danh sách cũ nếu lỗi
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [highlightCallId]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const isPaymentSuccess = useCallback((p?: PaymentDetailResponse | null) => {
    return p?.status === 'SUCCESS' || p?.status === 'PAID';
  }, []);

  // Filtered payments
  const filteredPayments = useMemo(() => {
    if (activeFilter === 'ALL') return payments;
    return payments.filter(p => {
      const isPaid = isPaymentSuccess(p);
      return activeFilter === 'PAID' ? isPaid : !isPaid;
    });
  }, [payments, activeFilter, isPaymentSuccess]);

  // Stats
  const stats = useMemo(() => {
    const totalCount = payments.length;
    let pendingCount = 0;
    let paidTotal = 0;
    let pendingTotal = 0;

    payments.forEach(p => {
      const isPaid = isPaymentSuccess(p);
      const amount = p.totalAmount || 0;
      if (isPaid) {
        paidTotal += amount;
      } else {
        pendingCount += 1;
        pendingTotal += amount;
      }
    });

    return { totalCount, pendingCount, paidTotal, pendingTotal };
  }, [payments, isPaymentSuccess]);

  // Format currency
  const formatVND = (num?: number | null) => {
    if (num == null || isNaN(num)) return '0 đ';
    return new Intl.NumberFormat('vi-VN').format(Math.round(num)) + ' đ';
  };

  // Format date
  const formatDate = (iso?: string | null) => {
    if (!iso) return 'Vừa xong';
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

  // Handle Pay Action
  const handlePayPayment = async () => {
    if (!selectedPayment) return;

    try {
      setIsPaying(true);
      const req: PayPaymentRequest = {
        paymentMethod: selectedMethod,
      };

      const result = await api.payReporterPayment(selectedPayment.paymentId, req);

      setIsPaying(false);
      setShowPayModal(false);

      Alert.alert(
        'Thanh Toán Thành Công! 🎉',
        `Chi phí cấp cứu ca #${selectedPayment.callId} trị giá ${formatVND(selectedPayment.totalAmount)} đã được thanh toán qua ${selectedMethod}. Cảm ơn bạn!`,
        [{ text: 'Đóng', onPress: () => fetchPayments() }]
      );

      // Cập nhật trạng thái ngay trong state
      setPayments(prev =>
        prev.map(p =>
          p.paymentId === selectedPayment.paymentId
            ? {
                ...p,
                status: 'SUCCESS',
                paymentMethod: selectedMethod,
                paidAt: new Date().toISOString(),
                externalTransactionId: result?.externalTransactionId || 'TXN_' + Date.now(),
              }
            : p
        )
      );
    } catch (err: any) {
      setIsPaying(false);
      Alert.alert(
        'Lỗi Thanh Toán',
        err?.message || 'Không thể hoàn tất thanh toán. Vui lòng thử lại sau.'
      );
    }
  };

  // VietQR URL generator
  const getVietQRUrl = (amount: number, paymentId: number | string) => {
    const bank = 'MB'; // MB Bank
    const acc = '0388115115';
    const name = 'TRUNG TAM CAP CUU 115';
    const memo = `CAPCUU ${paymentId}`;
    return `https://img.vietqr.io/image/${bank}-${acc}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent(name)}`;
  };

  const isModalPaid = isPaymentSuccess(selectedPayment);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#070A10', '#0F172A', '#0B0F19']} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.headerTitleBox}>
              <View style={styles.headerBadge}>
                <MaterialCommunityIcons name="shield-check" size={13} color="#10B981" />
                <Text style={styles.headerBadgeText}>CỔNG THANH TOÁN VIỆN PHÍ 115</Text>
              </View>
              <Text style={styles.headerTitle}>Hóa Đơn & Chi Phí Cấp Cứu</Text>
            </View>

            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => fetchPayments(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={20} color="#38BDF8" />
            </TouchableOpacity>
          </View>

          {/* OVERVIEW STATS CARDS */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, styles.statCardPending]}>
              <View style={styles.statIconWrapPending}>
                <MaterialCommunityIcons name="clock-alert-outline" size={18} color="#F59E0B" />
              </View>
              <View>
                <Text style={styles.statLabel}>CHƯA THANH TOÁN</Text>
                <Text style={[styles.statValue, { color: '#F59E0B' }]}>
                  {stats.pendingCount} hóa đơn ({formatVND(stats.pendingTotal)})
                </Text>
              </View>
            </View>

            <View style={[styles.statCard, styles.statCardPaid]}>
              <View style={styles.statIconWrapPaid}>
                <MaterialCommunityIcons name="check-decagram" size={18} color="#10B981" />
              </View>
              <View>
                <Text style={styles.statLabel}>ĐÃ HOÀN TẤT</Text>
                <Text style={[styles.statValue, { color: '#10B981' }]}>
                  {formatVND(stats.paidTotal)}
                </Text>
              </View>
            </View>
          </View>

          {/* TAB FILTER */}
          <View style={styles.tabFilterBar}>
            <TouchableOpacity
              style={[styles.tabFilterBtn, activeFilter === 'ALL' && styles.tabFilterBtnActive]}
              onPress={() => setActiveFilter('ALL')}
            >
              <Text
                style={[
                  styles.tabFilterText,
                  activeFilter === 'ALL' && styles.tabFilterTextActive,
                ]}
              >
                Tất cả ({stats.totalCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabFilterBtn, activeFilter === 'PENDING' && styles.tabFilterBtnActive]}
              onPress={() => setActiveFilter('PENDING')}
            >
              <Text
                style={[
                  styles.tabFilterText,
                  activeFilter === 'PENDING' && styles.tabFilterTextActive,
                ]}
              >
                Chờ thanh toán ({stats.pendingCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabFilterBtn, activeFilter === 'PAID' && styles.tabFilterBtnActive]}
              onPress={() => setActiveFilter('PAID')}
            >
              <Text
                style={[
                  styles.tabFilterText,
                  activeFilter === 'PAID' && styles.tabFilterTextActive,
                ]}
              >
                Đã thanh toán ({stats.totalCount - stats.pendingCount})
              </Text>
            </TouchableOpacity>
          </View>

          {/* LIST OF PAYMENTS */}
          {loading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color="#EF4444" />
              <Text style={styles.loadingText}>Đang tải danh sách hóa đơn từ máy chủ...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredPayments}
              keyExtractor={(item, index) =>
                item.paymentId ? `payment-${item.paymentId}` : `pay-idx-${index}`
              }
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => fetchPayments(true)}
                  tintColor="#EF4444"
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons name="receipt-text-remove" size={60} color="#334155" />
                  <Text style={styles.emptyTitle}>Chưa có hóa đơn viện phí nào</Text>
                  <Text style={styles.emptySubtitle}>
                    {activeFilter === 'PENDING'
                      ? 'Bạn không có khoản chi phí cấp cứu nào cần thanh toán.'
                      : 'Lịch sử hóa đơn các ca cứu hộ bạn đã gọi sẽ hiển thị tại đây.'}
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isPaid = isPaymentSuccess(item);
                return (
                  <View style={[styles.card, isPaid ? styles.cardPaidBorder : styles.cardPendingBorder]}>
                    {/* Card Header */}
                    <View style={styles.cardHeader}>
                      <View style={styles.cardCodeWrap}>
                        <MaterialCommunityIcons name="file-document-outline" size={16} color="#94A3B8" />
                        <Text style={styles.cardCode}>#HĐ-{item.paymentId || '00'}</Text>
                        <Text style={styles.cardCallBadge}>• Ca #{item.callId}</Text>
                      </View>

                      <View style={[styles.statusTag, isPaid ? styles.statusTagPaid : styles.statusTagPending]}>
                        <View style={[styles.statusDot, isPaid ? styles.statusDotPaid : styles.statusDotPending]} />
                        <Text style={[styles.statusTagText, isPaid ? styles.statusTagTextPaid : styles.statusTagTextPending]}>
                          {isPaid ? 'ĐÃ THANH TOÁN' : 'CHỜ THANH TOÁN'}
                        </Text>
                      </View>
                    </View>

                    {/* Time & Patient */}
                    <View style={styles.cardMetaRow}>
                      <Ionicons name="time-outline" size={13} color="#64748B" />
                      <Text style={styles.cardMetaText}>{formatDate(item.createdAt || item.completedAt)}</Text>
                      {item.patientName && (
                        <>
                          <Text style={styles.metaDivider}>|</Text>
                          <Ionicons name="person-outline" size={13} color="#64748B" />
                          <Text style={styles.cardMetaText}>{item.patientName}</Text>
                        </>
                      )}
                    </View>

                    {/* Locations */}
                    <View style={styles.locationBox}>
                      <View style={styles.locRow}>
                        <View style={styles.locDotGreen} />
                        <Text style={styles.locLabel}>Điểm đón:</Text>
                        <Text style={styles.locValue} numberOfLines={1}>
                          {item.pickupAddress || 'Hiện trường cấp cứu'}
                        </Text>
                      </View>

                      <View style={styles.locConnector} />

                      <View style={styles.locRow}>
                        <View style={styles.locDotRed} />
                        <Text style={styles.locLabel}>Bệnh viện:</Text>
                        <Text style={[styles.locValue, { color: '#38BDF8' }]} numberOfLines={1}>
                          {item.hospitalAddress || 'Bệnh viện Đa Khoa tiếp nhận'}
                        </Text>
                      </View>
                    </View>

                    {/* Vehicle & Distance Stats */}
                    <View style={styles.transportMeta}>
                      <View style={styles.transportItem}>
                        <FontAwesome5 name="ambulance" size={12} color="#10B981" />
                        <Text style={styles.transportText}>
                          {item.licensePlate || 'Xe cấp cứu 115'}
                        </Text>
                      </View>
                      {item.driverName && (
                        <View style={styles.transportItem}>
                          <Ionicons name="person" size={12} color="#94A3B8" />
                          <Text style={styles.transportText}>{item.driverName}</Text>
                        </View>
                      )}
                      {item.billableDistanceKm != null && item.billableDistanceKm > 0 && (
                        <View style={styles.transportItem}>
                          <MaterialCommunityIcons name="map-marker-distance" size={13} color="#F59E0B" />
                          <Text style={styles.transportText}>{item.billableDistanceKm.toFixed(1)} km</Text>
                        </View>
                      )}
                    </View>

                    {/* Cost Breakdown Preview */}
                    <View style={styles.priceRow}>
                      <View>
                        <Text style={styles.priceLabel}>TỔNG CHI PHÍ CẤP CỨU</Text>
                        {item.distanceFare != null && item.baseFare != null && (
                          <Text style={styles.priceSub}>
                            Cước gốc {formatVND(item.baseFare)} + Cự ly {formatVND(item.distanceFare)}
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.priceValue, isPaid ? styles.priceValuePaid : styles.priceValuePending]}>
                        {formatVND(item.totalAmount)}
                      </Text>
                    </View>

                    {/* Action Button */}
                    <View style={styles.actionWrap}>
                      {isPaid ? (
                        <TouchableOpacity
                          style={styles.btnReceipt}
                          onPress={() => {
                            setSelectedPayment(item);
                            setShowPayModal(true);
                          }}
                          activeOpacity={0.8}
                        >
                          <MaterialCommunityIcons name="receipt" size={16} color="#34D399" />
                          <Text style={styles.btnReceiptText}>XEM BIÊN LAI ĐIỆN TỬ</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.btnPayNow}
                          onPress={() => {
                            setSelectedPayment(item);
                            setShowPayModal(true);
                          }}
                          activeOpacity={0.85}
                        >
                          <LinearGradient
                            colors={['#EF4444', '#DC2626']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.btnPayGradient}
                          >
                            <MaterialCommunityIcons name="qrcode-scan" size={16} color="#FFF" />
                            <Text style={styles.btnPayNowText}>
                              THANH TOÁN NGAY ({formatVND(item.totalAmount)})
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              }}
            />
          )}
        </SafeAreaView>
      </LinearGradient>

      {/* DETAIL & PAYMENT MODAL */}
      <Modal
        visible={showPayModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPayModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedPayment && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderIconWrap}>
                    <MaterialCommunityIcons
                      name={isModalPaid ? 'check-decagram' : 'credit-card-fast'}
                      size={22}
                      color={isModalPaid ? '#10B981' : '#EF4444'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalHeaderTitle}>
                      {isModalPaid
                        ? 'Biên Lai Cấp Cứu Điện Tử'
                        : 'Thanh Toán Chi Phí Ca Cấp Cứu'}
                    </Text>
                    <Text style={styles.modalHeaderSubtitle}>
                      Mã hóa đơn: #HĐ-{selectedPayment.paymentId} • Ca #{selectedPayment.callId}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setShowPayModal(false)}
                  >
                    <Ionicons name="close" size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                  {/* Status Banner */}
                  <View
                    style={[
                      styles.modalStatusBanner,
                      isModalPaid
                        ? styles.modalBannerPaid
                        : styles.modalBannerPending,
                    ]}
                  >
                    <Ionicons
                      name={isModalPaid ? 'checkmark-circle' : 'alert-circle'}
                      size={20}
                      color={isModalPaid ? '#10B981' : '#F59E0B'}
                    />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text
                        style={[
                          styles.bannerTitle,
                          { color: isModalPaid ? '#10B981' : '#F59E0B' },
                        ]}
                      >
                        {isModalPaid
                          ? 'HÓA ĐƠN ĐÃ ĐƯỢC THANH TOÁN'
                          : 'HÓA ĐƠN ĐANG CHỜ THANH TOÁN'}
                      </Text>
                      <Text style={styles.bannerSubtitle}>
                        {isModalPaid
                          ? `Thanh toán qua ${selectedPayment.paymentMethod || 'VIETQR'} lúc ${formatDate(selectedPayment.paidAt)}`
                          : 'Vui lòng chọn cổng thanh toán điện tử để hoàn tất chi phí dịch vụ'}
                      </Text>
                    </View>
                  </View>

                  {/* Trip Details Card */}
                  <View style={styles.modalSectionCard}>
                    <Text style={styles.modalSectionTitle}>THÔNG TIN CA CẤP CỨU</Text>

                    <View style={styles.modalDetailRow}>
                      <Text style={styles.detailLabel}>Bệnh nhân:</Text>
                      <Text style={styles.detailVal}>{selectedPayment.patientName || 'Chưa cập nhật'}</Text>
                    </View>

                    {selectedPayment.patientPhone && (
                      <View style={styles.modalDetailRow}>
                        <Text style={styles.detailLabel}>Số điện thoại:</Text>
                        <Text style={styles.detailVal}>{selectedPayment.patientPhone}</Text>
                      </View>
                    )}

                    <View style={styles.modalDetailRow}>
                      <Text style={styles.detailLabel}>Điểm đón:</Text>
                      <Text style={[styles.detailVal, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                        {selectedPayment.pickupAddress || 'Hiện trường sự cố'}
                      </Text>
                    </View>

                    <View style={styles.modalDetailRow}>
                      <Text style={styles.detailLabel}>Bệnh viện đến:</Text>
                      <Text style={[styles.detailVal, { color: '#38BDF8', flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                        {selectedPayment.hospitalAddress || 'Bệnh viện tiếp nhận'}
                      </Text>
                    </View>

                    <View style={styles.modalDetailRow}>
                      <Text style={styles.detailLabel}>Đội xe & Tài xế:</Text>
                      <Text style={styles.detailVal}>
                        {selectedPayment.licensePlate || 'Xe 115'} ({selectedPayment.driverName || 'Tài xế'})
                      </Text>
                    </View>

                    {selectedPayment.billableDistanceKm != null && (
                      <View style={styles.modalDetailRow}>
                        <Text style={styles.detailLabel}>Cự ly tính phí:</Text>
                        <Text style={[styles.detailVal, { color: '#F59E0B' }]}>
                          {selectedPayment.billableDistanceKm.toFixed(1)} km
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Pricing Breakdown */}
                  <View style={styles.modalSectionCard}>
                    <Text style={styles.modalSectionTitle}>BẢNG KÊ CHI PHÍ VẬN CHUYỂN</Text>

                    <View style={styles.modalDetailRow}>
                      <Text style={styles.detailLabel}>
                        Phí khởi động ({selectedPayment.serviceTypeCode === 'BLS' ? 'BLS Tiêu chuẩn' : 'ALS Hồi sức nâng cao'}):
                      </Text>
                      <Text style={styles.detailVal}>
                        {formatVND(selectedPayment.baseFare ?? (selectedPayment.serviceTypeCode === 'BLS' ? 200000 : 300000))}
                      </Text>
                    </View>

                    <View style={styles.modalDetailRow}>
                      <Text style={styles.detailLabel}>
                        Cước cự ly ({selectedPayment.billableDistanceKm?.toFixed(1) || '0'} km × {formatVND(selectedPayment.pricePerKm ?? (selectedPayment.serviceTypeCode === 'BLS' ? 40000 : 45000))}/km):
                      </Text>
                      <Text style={styles.detailVal}>
                        {formatVND(
                          selectedPayment.distanceFare ??
                            Math.round(
                              (selectedPayment.billableDistanceKm || 0) *
                                (selectedPayment.pricePerKm ??
                                  (selectedPayment.serviceTypeCode === 'BLS' ? 40000 : 45000))
                            )
                        )}
                      </Text>
                    </View>

                    <View style={styles.priceDivider} />

                    <View style={styles.modalTotalRow}>
                      <Text style={styles.totalLabel}>TỔNG THANH TOÁN:</Text>
                      <Text style={styles.totalAmountVal}>{formatVND(selectedPayment.totalAmount)}</Text>
                    </View>

                    {isModalPaid && selectedPayment.externalTransactionId && (
                      <View style={styles.transactionBox}>
                        <MaterialCommunityIcons name="barcode-scan" size={16} color="#10B981" />
                        <Text style={styles.transactionText}>
                          Mã giao dịch: {selectedPayment.externalTransactionId}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Payment Gateway Selection (If Pending) */}
                  {!isModalPaid && (
                    <View style={styles.modalSectionCard}>
                      <Text style={styles.modalSectionTitle}>CHỌN PHƯƠNG THỨC THANH TOÁN ĐIỆN TỬ</Text>

                      {/* Methods Tab */}
                      <View style={styles.methodsRow}>
                        <TouchableOpacity
                          style={[
                            styles.methodBtn,
                            selectedMethod === 'VIETQR' && styles.methodBtnActive,
                          ]}
                          onPress={() => setSelectedMethod('VIETQR')}
                        >
                          <MaterialCommunityIcons
                            name="qrcode"
                            size={20}
                            color={selectedMethod === 'VIETQR' ? '#10B981' : '#94A3B8'}
                          />
                          <Text
                            style={[
                              styles.methodText,
                              selectedMethod === 'VIETQR' && styles.methodTextActive,
                            ]}
                          >
                            VietQR (Chuyển khoản)
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.methodBtn,
                            selectedMethod === 'VNPAY' && styles.methodBtnActive,
                          ]}
                          onPress={() => setSelectedMethod('VNPAY')}
                        >
                          <Ionicons
                            name="card"
                            size={18}
                            color={selectedMethod === 'VNPAY' ? '#0284C7' : '#94A3B8'}
                          />
                          <Text
                            style={[
                              styles.methodText,
                              selectedMethod === 'VNPAY' && styles.methodTextActive,
                            ]}
                          >
                            VNPAY QR
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.methodBtn,
                            selectedMethod === 'MOMO' && styles.methodBtnActive,
                          ]}
                          onPress={() => setSelectedMethod('MOMO')}
                        >
                          <Ionicons
                            name="wallet"
                            size={18}
                            color={selectedMethod === 'MOMO' ? '#EC4899' : '#94A3B8'}
                          />
                          <Text
                            style={[
                              styles.methodText,
                              selectedMethod === 'MOMO' && styles.methodTextActive,
                            ]}
                          >
                            Ví MoMo
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* VietQR Display */}
                      {selectedMethod === 'VIETQR' && (
                        <View style={styles.qrContainer}>
                          <Text style={styles.qrNote}>
                            Quét mã QR bằng bất kỳ ứng dụng Ngân hàng nào để thanh toán tự động:
                          </Text>

                          <View style={styles.qrImageFrame}>
                            <Image
                              source={{
                                uri: getVietQRUrl(
                                  selectedPayment.totalAmount,
                                  selectedPayment.paymentId
                                ),
                              }}
                              style={styles.qrImage}
                              resizeMode="contain"
                            />
                          </View>

                          <View style={styles.bankInfoBox}>
                            <Text style={styles.bankInfoText}>
                              Ngân hàng: <Text style={styles.boldWhite}>MB Bank (Quân Đội)</Text>
                            </Text>
                            <Text style={styles.bankInfoText}>
                              Số TK: <Text style={styles.boldWhite}>0388115115</Text>
                            </Text>
                            <Text style={styles.bankInfoText}>
                              Nội dung CK: <Text style={[styles.boldWhite, { color: '#F59E0B' }]}>CAPCUU {selectedPayment.paymentId}</Text>
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* VNPay / MoMo info banner */}
                      {selectedMethod !== 'VIETQR' && (
                        <View style={styles.gatewayBanner}>
                          <MaterialCommunityIcons
                            name={selectedMethod === 'VNPAY' ? 'credit-card-wireless' : 'wallet'}
                            size={28}
                            color={selectedMethod === 'VNPAY' ? '#0284C7' : '#EC4899'}
                          />
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.gatewayTitle}>
                              Cổng thanh toán {selectedMethod} Sandbox
                            </Text>
                            <Text style={styles.gatewayDesc}>
                              Hệ thống sẽ chuyển tiếp và xác nhận thanh toán trực tuyến số tiền{' '}
                              {formatVND(selectedPayment.totalAmount)}.
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </ScrollView>

                {/* Modal Bottom Action Button */}
                <View style={styles.modalBottomBar}>
                  {isModalPaid ? (
                    <TouchableOpacity
                      style={styles.modalCloseFullBtn}
                      onPress={() => setShowPayModal(false)}
                    >
                      <Text style={styles.modalCloseFullText}>ĐÓNG BIÊN LAI</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.btnConfirmPay}
                      onPress={handlePayPayment}
                      disabled={isPaying}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={['#10B981', '#059669']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.btnConfirmGradient}
                      >
                        {isPaying ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                            <Text style={styles.btnConfirmText}>
                              XÁC NHẬN ĐÃ THANH TOÁN QUA {selectedMethod}
                            </Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070A10',
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitleBox: {
    flex: 1,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerBadgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
  },
  statCardPending: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statCardPaid: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statIconWrapPending: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statIconWrapPaid: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  tabFilterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    gap: 8,
  },
  tabFilterBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabFilterBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
  },
  tabFilterText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  tabFilterTextActive: {
    color: '#EF4444',
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14,
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  cardPendingBorder: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  cardPaidBorder: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardCodeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardCode: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cardCallBadge: {
    color: '#94A3B8',
    fontSize: 12,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 5,
  },
  statusTagPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  statusTagPaid: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotPending: {
    backgroundColor: '#F59E0B',
  },
  statusDotPaid: {
    backgroundColor: '#10B981',
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statusTagTextPending: {
    color: '#F59E0B',
  },
  statusTagTextPaid: {
    color: '#10B981',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
  },
  cardMetaText: {
    color: '#64748B',
    fontSize: 11,
  },
  metaDivider: {
    color: '#334155',
    fontSize: 11,
    marginHorizontal: 4,
  },
  locationBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locDotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  locDotRed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  locConnector: {
    width: 2,
    height: 10,
    backgroundColor: '#334155',
    marginLeft: 3,
    marginVertical: 2,
  },
  locLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  locValue: {
    color: '#E2E8F0',
    fontSize: 12,
    flex: 1,
  },
  transportMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },
  transportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  transportText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  priceLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  priceSub: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  priceValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  priceValuePending: {
    color: '#F59E0B',
  },
  priceValuePaid: {
    color: '#10B981',
  },
  actionWrap: {
    marginTop: 4,
  },
  btnReceipt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    gap: 6,
  },
  btnReceiptText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },
  btnPayNow: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  btnPayGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    gap: 8,
  },
  btnPayNowText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalHeaderIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalHeaderTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalHeaderSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  modalStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  modalBannerPaid: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  modalBannerPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  bannerTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  bannerSubtitle: {
    color: '#CBD5E1',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  modalSectionCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  modalSectionTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  detailVal: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  priceDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 10,
  },
  modalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  totalAmountVal: {
    color: '#F59E0B',
    fontSize: 20,
    fontWeight: '800',
  },
  transactionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    padding: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
  },
  transactionText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '600',
  },
  methodsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  methodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 6,
  },
  methodBtnActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  methodText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  methodTextActive: {
    color: '#FFF',
  },
  qrContainer: {
    alignItems: 'center',
    paddingTop: 4,
  },
  qrNote: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 10,
  },
  qrImageFrame: {
    width: 220,
    height: 220,
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 12,
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  bankInfoBox: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  bankInfoText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  boldWhite: {
    color: '#FFF',
    fontWeight: '700',
  },
  gatewayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 12,
  },
  gatewayTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  gatewayDesc: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 3,
    lineHeight: 15,
  },
  modalBottomBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  btnConfirmPay: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  btnConfirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  btnConfirmText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  modalCloseFullBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  modalCloseFullText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
