import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  Ionicons,
  FontAwesome5,
  MaterialCommunityIcons,
  Feather,
} from '@expo/vector-icons';
import { api } from '@/services/api';
import {
  DriverEarningResponse,
  DriverEarningDetailResponse,
  DriverEarningSummaryResponse,
} from '@/types';

const { width } = Dimensions.get('window');

type EarningFilterTab = 'ALL' | 'PENDING' | 'SUCCESS';

export default function DriverEarningsScreen() {
  const router = useRouter();

  // State
  const [earningsList, setEarningsList] = useState<DriverEarningResponse[]>([]);
  const [summary, setSummary] = useState<DriverEarningSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<EarningFilterTab>('ALL');

  // Detail Modal State
  const [selectedMissionId, setSelectedMissionId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<DriverEarningDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);

  // Cash Collection Action State
  const [isCollecting, setIsCollecting] = useState<boolean>(false);

  // Format currency helper
  const formatVND = (num?: number | null) => {
    if (num == null || isNaN(num)) return '0 đ';
    return new Intl.NumberFormat('vi-VN').format(Math.round(num)) + ' đ';
  };

  // Format date helper
  const formatDate = (iso?: string | null) => {
    if (!iso) return 'Chưa cập nhật';
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

  // Fetch all driver earnings data
  const fetchData = useCallback(async (isPull = false) => {
    try {
      if (isPull) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [earningsRes, summaryRes] = await Promise.allSettled([
        api.getMyEarnings(),
        api.getMyEarningSummary(),
      ]);

      if (earningsRes.status === 'fulfilled' && Array.isArray(earningsRes.value)) {
        setEarningsList(earningsRes.value);
      } else {
        setEarningsList([]);
      }

      if (summaryRes.status === 'fulfilled' && summaryRes.value) {
        setSummary(summaryRes.value);
      } else {
        // Fallback computation from list if summary endpoint is empty
        if (earningsRes.status === 'fulfilled' && Array.isArray(earningsRes.value)) {
          const list = earningsRes.value;
          let paid = 0;
          let pending = 0;
          list.forEach(item => {
            const isPaid = item.paymentStatus === 'SUCCESS' || item.paymentStatus === 'PAID';
            if (isPaid) {
              paid += item.driverAmount || 0;
            } else {
              pending += item.driverAmount || 0;
            }
          });
          setSummary({
            paidEarnings: paid,
            pendingEarnings: pending,
            missionCount: list.length,
            averagePerMission: list.length > 0 ? Math.round((paid + pending) / list.length) : 0,
          });
        }
      }
    } catch (err) {
      console.warn('[DriverEarnings] Load data error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open detail modal
  const handleOpenDetail = async (missionId: number) => {
    try {
      setSelectedMissionId(missionId);
      setShowDetailModal(true);
      setLoadingDetail(true);
      setDetailData(null);

      const res = await api.getMyEarningByMission(missionId);
      setDetailData(res);
    } catch (err: any) {
      console.warn('[DriverEarnings] Load mission detail error:', err);
      Alert.alert(
        'Lỗi Tải Chi Tiết',
        err?.message || 'Không thể lấy thông tin chi tiết thu nhập nhiệm vụ này.'
      );
    } finally {
      setLoadingDetail(false);
    }
  };

  // Confirm Collect Cash Action
  const handleCollectCash = async (missionId: number, grossFare?: number) => {
    Alert.alert(
      'Xác Nhận Thu Tiền Mặt 💵',
      `Bạn xác nhận đã nhận đủ số tiền ${grossFare ? formatVND(grossFare) : 'cước ca cấp cứu'} bằng tiền mặt từ người nhà bệnh nhân cho nhiệm vụ #${missionId}?\n\nKhoản tiền này sẽ được ghi nhận đã thanh toán trên toàn hệ thống.`,
      [
        { text: 'Hủy bỏ', style: 'cancel' },
        {
          text: 'XÁC NHẬN ĐÃ THU',
          style: 'default',
          onPress: async () => {
            try {
              setIsCollecting(true);
              const result = await api.collectCash(missionId);
              setIsCollecting(false);

              // Cập nhật modal nếu đang mở
              if (selectedMissionId === missionId) {
                setDetailData(result);
              }

              Alert.alert(
                'Thành Công! 🎉',
                `Đã xác nhận thu tiền mặt cho nhiệm vụ #${missionId}. Thu nhập tài xế đã được cộng vào ví thành công!`
              );

              // Refresh toàn bộ danh sách & summary
              fetchData();
            } catch (err: any) {
              setIsCollecting(false);
              Alert.alert(
                'Thao Tác Thất Bại',
                err?.message || 'Không thể xác nhận thu tiền mặt. Vui lòng kiểm tra lại kết nối.'
              );
            }
          },
        },
      ]
    );
  };

  // Filtered earnings list
  const filteredList = useMemo(() => {
    if (activeFilter === 'ALL') return earningsList;
    return earningsList.filter(item => {
      const isPaid = item.paymentStatus === 'SUCCESS' || item.paymentStatus === 'PAID';
      return activeFilter === 'SUCCESS' ? isPaid : !isPaid;
    });
  }, [earningsList, activeFilter]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#070A10', '#0F172A', '#0B0F19']} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={22} color="#F8FAFC" />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>VÍ & THU NHẬP TÀI XẾ</Text>
              <Text style={styles.headerSubtitle}>
                Báo cáo thù lao kíp trực & Xác nhận thu tiền mặt
              </Text>
            </View>

            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => fetchData()}
              activeOpacity={0.7}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <Ionicons name="refresh" size={18} color="#10B981" />
              )}
            </TouchableOpacity>
          </View>

          {/* SUMMARY CARDS (HERO) */}
          <View style={styles.summarySection}>
            <View style={styles.heroCardRow}>
              {/* Card 1: Thu nhập thực nhận */}
              <LinearGradient
                colors={['rgba(16, 185, 129, 0.25)', 'rgba(5, 150, 105, 0.1)']}
                style={[styles.heroCard, { borderColor: 'rgba(16, 185, 129, 0.35)' }]}
              >
                <View style={styles.heroCardHeader}>
                  <Text style={styles.heroCardLabel}>ĐÃ THỰC NHẬN</Text>
                  <View style={styles.badgePaid}>
                    <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                    <Text style={styles.badgePaidText}>Đã về ví</Text>
                  </View>
                </View>
                <Text style={styles.heroPaidValue}>
                  {formatVND(summary?.paidEarnings || 0)}
                </Text>
                <Text style={styles.heroCardSub}>Thu nhập các cuốc đã hoàn tất quyết toán</Text>
              </LinearGradient>

              {/* Card 2: Chờ quyết toán / thu tiền */}
              <LinearGradient
                colors={['rgba(245, 158, 11, 0.22)', 'rgba(217, 119, 6, 0.08)']}
                style={[styles.heroCard, { borderColor: 'rgba(245, 158, 11, 0.35)' }]}
              >
                <View style={styles.heroCardHeader}>
                  <Text style={[styles.heroCardLabel, { color: '#F59E0B' }]}>CHỜ QUYẾT TOÁN</Text>
                  <View style={styles.badgePending}>
                    <Ionicons name="time" size={12} color="#F59E0B" />
                    <Text style={styles.badgePendingText}>Chờ thu</Text>
                  </View>
                </View>
                <Text style={styles.heroPendingValue}>
                  {formatVND(summary?.pendingEarnings || 0)}
                </Text>
                <Text style={styles.heroCardSub}>Chờ người nhà trả QR hoặc thu tiền mặt</Text>
              </LinearGradient>
            </View>

            {/* Sub Stats Bar */}
            <View style={styles.statsBar}>
              <View style={styles.statsBarItem}>
                <MaterialCommunityIcons name="ambulance" size={15} color="#38BDF8" />
                <Text style={styles.statsBarLabel}>Tổng cuốc xe:</Text>
                <Text style={styles.statsBarVal}>{summary?.missionCount || earningsList.length} ca</Text>
              </View>

              <View style={styles.statsDivider} />

              <View style={styles.statsBarItem}>
                <Ionicons name="trending-up" size={15} color="#10B981" />
                <Text style={styles.statsBarLabel}>Bình quân/ca:</Text>
                <Text style={styles.statsBarVal}>
                  {formatVND(
                    summary?.averagePerMission ||
                      (earningsList.length > 0
                        ? Math.round(
                            ((summary?.paidEarnings || 0) + (summary?.pendingEarnings || 0)) /
                              earningsList.length
                          )
                        : 0)
                  )}
                </Text>
              </View>
            </View>
          </View>

          {/* FILTER TABS */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterTab, activeFilter === 'ALL' && styles.filterTabActive]}
              onPress={() => setActiveFilter('ALL')}
            >
              <Text style={[styles.filterTabText, activeFilter === 'ALL' && styles.filterTabTextActive]}>
                Tất cả ({earningsList.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterTab, activeFilter === 'PENDING' && styles.filterTabActive]}
              onPress={() => setActiveFilter('PENDING')}
            >
              <Text
                style={[
                  styles.filterTabText,
                  activeFilter === 'PENDING' && styles.filterTabTextActive,
                  { color: activeFilter === 'PENDING' ? '#F59E0B' : '#94A3B8' },
                ]}
              >
                Chờ thu tiền (
                {
                  earningsList.filter(
                    e => e.paymentStatus !== 'SUCCESS' && e.paymentStatus !== 'PAID'
                  ).length
                }
                )
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterTab, activeFilter === 'SUCCESS' && styles.filterTabActive]}
              onPress={() => setActiveFilter('SUCCESS')}
            >
              <Text
                style={[
                  styles.filterTabText,
                  activeFilter === 'SUCCESS' && styles.filterTabTextActive,
                ]}
              >
                Đã thanh toán (
                {
                  earningsList.filter(
                    e => e.paymentStatus === 'SUCCESS' || e.paymentStatus === 'PAID'
                  ).length
                }
                )
              </Text>
            </TouchableOpacity>
          </View>

          {/* EARNINGS LIST */}
          {loading && !refreshing ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={styles.loadingText}>Đang tải dữ liệu thu nhập tài xế...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredList}
              keyExtractor={item => `earning-${item.missionId}`}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => fetchData(true)}
                  tintColor="#10B981"
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons name="cash-remove" size={54} color="#475569" />
                  <Text style={styles.emptyTitle}>Chưa có bản ghi thu nhập nào</Text>
                  <Text style={styles.emptySubtitle}>
                    {activeFilter === 'PENDING'
                      ? 'Không có nhiệm vụ nào đang chờ thu tiền mặt hoặc chờ quyết toán.'
                      : 'Các cuốc xe hoàn thành sẽ xuất hiện tại đây sau khi hệ thống kết thúc chuyến đi.'}
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isPaid = item.paymentStatus === 'SUCCESS' || item.paymentStatus === 'PAID';
                const isBLS = item.serviceTypeCode === 'BLS';

                return (
                  <View style={[styles.earningCard, isPaid ? styles.cardPaidBorder : styles.cardPendingBorder]}>
                    {/* Card Header */}
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <View style={styles.missionPill}>
                          <FontAwesome5 name="ambulance" size={12} color="#10B981" />
                          <Text style={styles.missionPillText}>Nhiệm vụ #{item.missionId}</Text>
                        </View>
                        <View style={[styles.serviceTypeBadge, isBLS ? styles.badgeBLS : styles.badgeALS]}>
                          <Text style={[styles.serviceTypeText, isBLS ? styles.textBLS : styles.textALS]}>
                            {item.serviceTypeCode || 'BLS'}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.statusTag, isPaid ? styles.statusTagPaid : styles.statusTagPending]}>
                        <View style={[styles.statusDot, isPaid ? styles.statusDotPaid : styles.statusDotPending]} />
                        <Text style={[styles.statusTagText, isPaid ? styles.statusTagTextPaid : styles.statusTagTextPending]}>
                          {isPaid ? 'ĐÃ THANH TOÁN' : 'CHỜ THU TIỀN'}
                        </Text>
                      </View>
                    </View>

                    {/* Driver Compensation Hero Row */}
                    <View style={styles.driverIncomeRow}>
                      <View>
                        <Text style={styles.incomeLabel}>THÙ LAO TÀI XẾ NHẬN:</Text>
                        <Text style={styles.incomeSub}>Đã khấu trừ phí nền tảng & tỷ lệ chia</Text>
                      </View>
                      <Text style={[styles.incomeAmount, isPaid ? styles.incomePaid : styles.incomePending]}>
                        +{formatVND(item.driverAmount)}
                      </Text>
                    </View>

                    {/* Financial Breakdown Grid */}
                    <View style={styles.breakdownGrid}>
                      <View style={styles.breakdownItem}>
                        <Text style={styles.breakdownLabel}>Tổng cước ca:</Text>
                        <Text style={styles.breakdownVal}>{formatVND(item.grossFare)}</Text>
                      </View>
                      <View style={styles.breakdownItem}>
                        <Text style={styles.breakdownLabel}>Phí nền tảng:</Text>
                        <Text style={[styles.breakdownVal, { color: '#F87171' }]}>
                          -{formatVND(item.platformCommission)}
                        </Text>
                      </View>
                      {item.providerAmount != null && item.providerAmount > 0 && (
                        <View style={styles.breakdownItem}>
                          <Text style={styles.breakdownLabel}>Phần nhà xe:</Text>
                          <Text style={styles.breakdownVal}>{formatVND(item.providerAmount)}</Text>
                        </View>
                      )}
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.btnDetail}
                        onPress={() => handleOpenDetail(item.missionId)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="information-circle-outline" size={16} color="#38BDF8" />
                        <Text style={styles.btnDetailText}>CHI TIẾT THÙ LAO</Text>
                      </TouchableOpacity>

                      {!isPaid && (
                        <TouchableOpacity
                          style={styles.btnCollectCash}
                          onPress={() => handleCollectCash(item.missionId, item.grossFare)}
                          activeOpacity={0.85}
                          disabled={isCollecting}
                        >
                          <LinearGradient
                            colors={['#10B981', '#059669']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.btnCollectGradient}
                          >
                            <MaterialCommunityIcons name="cash-fast" size={16} color="#FFF" />
                            <Text style={styles.btnCollectText}>XÁC NHẬN THU TIỀN MẶT</Text>
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

      {/* DETAIL MODAL */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIconWrap}>
                <MaterialCommunityIcons name="receipt-text-outline" size={22} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalHeaderTitle}>Chi Tiết Thù Lao Cuốc Xe</Text>
                <Text style={styles.modalHeaderSubtitle}>
                  Nhiệm vụ #{selectedMissionId} • Yêu cầu #{detailData?.requestId || selectedMissionId}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowDetailModal(false)}
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {loadingDetail ? (
              <View style={{ paddingVertical: 50, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={{ color: '#94A3B8', marginTop: 12, fontSize: 13, fontWeight: '600' }}>
                  Đang lấy chi tiết thu nhập nhiệm vụ từ máy chủ...
                </Text>
              </View>
            ) : detailData ? (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Status Banner */}
                {(() => {
                  const isPaid = detailData.paymentStatus === 'SUCCESS' || detailData.paymentStatus === 'PAID';
                  return (
                    <View style={[styles.modalBanner, isPaid ? styles.modalBannerPaid : styles.modalBannerPending]}>
                      <Ionicons
                        name={isPaid ? 'checkmark-circle' : 'alert-circle'}
                        size={20}
                        color={isPaid ? '#10B981' : '#F59E0B'}
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.modalBannerTitle, { color: isPaid ? '#10B981' : '#F59E0B' }]}>
                          {isPaid ? 'ĐÃ QUYẾT TOÁN THÀNH CÔNG' : 'ĐANG CHỜ THU TIỀN HOẶC QR'}
                        </Text>
                        <Text style={styles.modalBannerDesc}>
                          {isPaid
                            ? `Phương thức: ${detailData.paymentMethod || 'CASH/VIETQR'} • Lúc ${formatDate(detailData.paidAt)}`
                            : 'Bệnh nhân chưa thanh toán trực tuyến. Tài xế có thể thu tiền mặt trực tiếp.'}
                        </Text>
                      </View>
                    </View>
                  );
                })()}

                {/* Hero Driver Compensation */}
                <View style={styles.modalHeroCompensation}>
                  <Text style={styles.modalHeroCompLabel}>THÙ LAO THỰC NHẬN CỦA TÀI XẾ</Text>
                  <Text style={styles.modalHeroCompAmount}>
                    +{formatVND(detailData.driverAmount)}
                  </Text>
                  <View style={styles.modalHeroBadge}>
                    <MaterialCommunityIcons name="wallet-outline" size={13} color="#10B981" />
                    <Text style={styles.modalHeroBadgeText}>Tự động đồng bộ vào tài khoản ví</Text>
                  </View>
                </View>

                {/* Trip Info Card */}
                <View style={styles.modalSectionCard}>
                  <Text style={styles.modalSectionTitle}>THÔNG TIN CUỐC CẤP CỨU</Text>

                  <View style={styles.modalDetailRow}>
                    <Text style={styles.detailLabel}>Mã nhiệm vụ (Mission ID):</Text>
                    <Text style={styles.detailVal}>#{detailData.missionId}</Text>
                  </View>

                  {detailData.requestId && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.detailLabel}>Mã yêu cầu điều phối (Request ID):</Text>
                      <Text style={styles.detailVal}>#{detailData.requestId}</Text>
                    </View>
                  )}

                  {detailData.callId && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.detailLabel}>Mã cuộc gọi cấp cứu (Call ID):</Text>
                      <Text style={styles.detailVal}>#{detailData.callId}</Text>
                    </View>
                  )}

                  <View style={styles.modalDetailRow}>
                    <Text style={styles.detailLabel}>Cự ly tính cước (OSRM):</Text>
                    <Text style={[styles.detailVal, { color: '#F59E0B' }]}>
                      {detailData.distanceKm != null ? `${detailData.distanceKm.toFixed(1)} km` : 'Chưa tính'}
                    </Text>
                  </View>
                </View>

                {/* Financial Ledger Card */}
                <View style={styles.modalSectionCard}>
                  <Text style={styles.modalSectionTitle}>BẢNG KÊ PHÂN PHỐI DOANH THU</Text>

                  <View style={styles.modalDetailRow}>
                    <Text style={styles.detailLabel}>1. Tổng cước vận chuyển:</Text>
                    <Text style={[styles.detailVal, { fontWeight: '700' }]}>{formatVND(detailData.grossFare)}</Text>
                  </View>

                  <View style={styles.modalDetailRow}>
                    <Text style={styles.detailLabel}>2. Phí dịch vụ nền tảng:</Text>
                    <Text style={[styles.detailVal, { color: '#F87171' }]}>
                      -{formatVND(detailData.platformCommission)}
                    </Text>
                  </View>

                  <View style={styles.modalDetailRow}>
                    <Text style={styles.detailLabel}>3. Doanh thu sau phí nền tảng:</Text>
                    <Text style={styles.detailVal}>{formatVND(detailData.afterCommission)}</Text>
                  </View>

                  <View style={styles.priceDivider} />

                  <View style={styles.modalDetailRow}>
                    <Text style={[styles.detailLabel, { color: '#34D399', fontWeight: '800' }]}>
                      4. Thù lao tài xế nhận được:
                    </Text>
                    <Text style={[styles.detailVal, { color: '#34D399', fontSize: 15, fontWeight: '900' }]}>
                      +{formatVND(detailData.driverAmount)}
                    </Text>
                  </View>

                  {detailData.providerAmount != null && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.detailLabel}>5. Phần đơn vị nhà xe/bệnh viện:</Text>
                      <Text style={styles.detailVal}>{formatVND(detailData.providerAmount)}</Text>
                    </View>
                  )}
                </View>

                {/* Bottom Action inside modal */}
                {detailData.paymentStatus !== 'SUCCESS' && detailData.paymentStatus !== 'PAID' && (
                  <TouchableOpacity
                    style={styles.modalCollectBtn}
                    onPress={() => handleCollectCash(detailData.missionId, detailData.grossFare)}
                    disabled={isCollecting}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['#10B981', '#059669']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.modalCollectGradient}
                    >
                      {isCollecting ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="cash-check" size={20} color="#FFF" />
                          <Text style={styles.modalCollectText}>XÁC NHẬN ĐÃ THU TIỀN MẶT ({formatVND(detailData.grossFare)})</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </ScrollView>
            ) : null}

            {/* Modal Bottom Close */}
            <View style={styles.modalBottomBar}>
              <TouchableOpacity
                style={styles.modalCloseFullBtn}
                onPress={() => setShowDetailModal(false)}
              >
                <Text style={styles.modalCloseFullText}>ĐÓNG CỬA SỔ</Text>
              </TouchableOpacity>
            </View>
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
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  summarySection: {
    padding: 16,
    gap: 10,
  },
  heroCardRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  heroCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroCardLabel: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badgePaid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePaidText: {
    color: '#10B981',
    fontSize: 9,
    fontWeight: '800',
  },
  badgePending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePendingText: {
    color: '#F59E0B',
    fontSize: 9,
    fontWeight: '800',
  },
  heroPaidValue: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  heroPendingValue: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  heroCardSub: {
    color: '#94A3B8',
    fontSize: 9,
    lineHeight: 13,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  statsBarItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statsBarLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  statsBarVal: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
  },
  statsDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 8,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterTabActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  filterTabText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  filterTabTextActive: {
    color: '#34D399',
    fontWeight: '900',
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 16,
  },
  earningCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  cardPaidBorder: {
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  cardPendingBorder: {
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  missionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  missionPillText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '800',
  },
  serviceTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeBLS: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  badgeALS: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  serviceTypeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  textBLS: {
    color: '#38BDF8',
  },
  textALS: {
    color: '#F87171',
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTagPaid: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusTagPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotPaid: {
    backgroundColor: '#10B981',
  },
  statusDotPending: {
    backgroundColor: '#F59E0B',
  },
  statusTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  statusTagTextPaid: {
    color: '#10B981',
  },
  statusTagTextPending: {
    color: '#F59E0B',
  },
  driverIncomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  incomeLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
  },
  incomeSub: {
    color: '#64748B',
    fontSize: 9,
    marginTop: 2,
  },
  incomeAmount: {
    fontSize: 18,
    fontWeight: '900',
  },
  incomePaid: {
    color: '#34D399',
  },
  incomePending: {
    color: '#F59E0B',
  },
  breakdownGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  breakdownItem: {
    gap: 2,
  },
  breakdownLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '600',
  },
  breakdownVal: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
  },
  btnDetail: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  btnDetailText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
  },
  btnCollectCash: {
    flex: 1.3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  btnCollectGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  btnCollectText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  modalHeaderIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  modalHeaderSubtitle: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    padding: 16,
  },
  modalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  modalBannerPaid: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  modalBannerPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  modalBannerTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalBannerDesc: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  modalHeroCompensation: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 14,
  },
  modalHeroCompLabel: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  modalHeroCompAmount: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  modalHeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  modalHeroBadgeText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '700',
  },
  modalSectionCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 14,
    gap: 8,
  },
  modalSectionTitle: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  detailVal: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  priceDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 4,
  },
  modalCollectBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
  },
  modalCollectGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  modalCollectText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalBottomBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalCloseFullBtn: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseFullText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
  },
});
