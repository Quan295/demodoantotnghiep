import { mockCases, mockHospital, mockReviews, mockTransactions } from '@/data/mockData';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const DashboardScreen = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'vehicles' | 'finance' | 'reviews'>('overview');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="#2563EB" />
      <LinearGradient colors={['#2563EB', '#1D4ED8']} style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Cổng Bệnh Viện</Text>
            <TouchableOpacity onPress={() => {}}>
              <Ionicons name="settings-outline" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.hospitalName}>{mockHospital.name}</Text>
            <Text style={styles.hospitalContact}>{mockHospital.address}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>Tổng quan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'vehicles' && styles.activeTab]}
          onPress={() => setActiveTab('vehicles')}
        >
          <Text style={[styles.tabText, activeTab === 'vehicles' && styles.activeTabText]}>Xe cứu hộ</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'finance' && styles.activeTab]}
          onPress={() => setActiveTab('finance')}
        >
          <Text style={[styles.tabText, activeTab === 'finance' && styles.activeTabText]}>Tài chính</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reviews' && styles.activeTab]}
          onPress={() => setActiveTab('reviews')}
        >
          <Text style={[styles.tabText, activeTab === 'reviews' && styles.activeTabText]}>Đánh giá</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'overview' && (
          <View style={styles.section}>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.statIcon}>
                  <FontAwesome5 name="clipboardList" size={20} color="#FFF" />
                </LinearGradient>
                <Text style={styles.statValue}>{mockHospital.totalCases}</Text>
                <Text style={styles.statLabel}>Tổng ca</Text>
              </View>
              <View style={styles.statCard}>
                <LinearGradient colors={['#10B981', '#059669']} style={styles.statIcon}>
                  <FontAwesome5 name="star" size={20} color="#FFF" />
                </LinearGradient>
                <Text style={styles.statValue}>{mockHospital.avgRating.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Đánh giá</Text>
              </View>
              <View style={styles.statCard}>
                <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.statIcon}>
                  <FontAwesome5 name="coins" size={20} color="#FFF" />
                </LinearGradient>
                <Text style={styles.statValue}>{formatCurrency(mockHospital.totalRevenue).replace('₫', '')}đ</Text>
                <Text style={styles.statLabel}>Doanh thu</Text>
              </View>
              <View style={styles.statCard}>
                <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.statIcon}>
                  <MaterialCommunityIcons name="car-emergency" size={20} color="#FFF" />
                </LinearGradient>
                <Text style={styles.statValue}>{mockHospital.vehicles.length}</Text>
                <Text style={styles.statLabel}>Số xe</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Ca gần đây</Text>
            {mockCases.map((c) => (
              <View key={c.id} style={styles.caseCard}>
                <View style={styles.caseHeader}>
                  <Text style={styles.caseId}>{c.id}</Text>
                  <View style={[
                    styles.caseStatus,
                    { backgroundColor: c.status === 'completed' ? '#10B98120' : c.status === 'in-progress' ? '#F59E0B20' : '#6B728020' }
                  ]}>
                    <Text style={[
                      styles.caseStatusText,
                      { color: c.status === 'completed' ? '#10B981' : c.status === 'in-progress' ? '#F59E0B' : '#6B7280' }
                    ]}>
                      {c.status === 'completed' ? 'Hoàn thành' : c.status === 'in-progress' ? 'Đang xử lý' : 'Chờ'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.caseDesc}>{c.description}</Text>
                <Text style={styles.caseAmount}>{formatCurrency(c.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'vehicles' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Danh sách xe</Text>
            {mockHospital.vehicles.map((v) => (
              <View key={v.id} style={styles.vehicleCard}>
                <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.vehicleIcon}>
                  <FontAwesome5 name="truckMedical" size={24} color="#FFF" />
                </LinearGradient>
                <View style={styles.vehicleInfo}>
                  <Text style={styles.vehiclePlate}>{v.licensePlate}</Text>
                  <Text style={styles.vehicleType}>{v.type === 'ambulance' ? 'Xe cứu thương' : 'Xe cấp cứu'}</Text>
                </View>
                <View style={[
                  styles.vehicleStatus,
                  { backgroundColor: v.status === 'available' ? '#10B98120' : v.status === 'busy' ? '#EF444420' : '#6B728020' }
                ]}>
                  <Text style={[
                    styles.vehicleStatusText,
                    { color: v.status === 'available' ? '#10B981' : v.status === 'busy' ? '#EF4444' : '#6B7280' }
                  ]}>
                    {v.status === 'available' ? 'Sẵn sàng' : v.status === 'busy' ? 'Bận' : 'Bảo trì'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'finance' && (
          <View style={styles.section}>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Số dư</Text>
              <Text style={styles.balanceAmount}>{formatCurrency(mockHospital.balance)}</Text>
            </View>
            <Text style={styles.sectionTitle}>Lịch sử giao dịch</Text>
            {mockTransactions.map((t) => (
              <View key={t.id} style={styles.transactionCard}>
                <LinearGradient
                  colors={t.type === 'deposit' || t.type === 'earning' ? ['#10B981', '#059669'] : ['#EF4444', '#DC2626']}
                  style={styles.transactionIcon}
                >
                  <Ionicons
                    name={t.type === 'deposit' ? 'add' : t.type === 'withdraw' ? 'remove' : t.type === 'earning' ? 'cash' : 'receipt'}
                    size={20}
                    color="#FFF"
                  />
                </LinearGradient>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionDesc}>{t.description}</Text>
                  <Text style={styles.transactionDate}>{t.createdAt.toLocaleDateString('vi-VN')}</Text>
                </View>
                <Text style={[
                  styles.transactionAmount,
                  { color: t.type === 'deposit' || t.type === 'earning' ? '#10B981' : '#EF4444' }
                ]}>
                  {t.type === 'deposit' || t.type === 'earning' ? '+' : '-'}{formatCurrency(t.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'reviews' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Đánh giá từ khách hàng</Text>
            {mockReviews.map((r) => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.avatar}>
                    <FontAwesome5 name="user" size={16} color="#2563EB" />
                  </View>
                  <View style={styles.reviewMeta}>
                    <Text style={styles.reviewUser}>Khách hàng</Text>
                    <View style={styles.stars}>
                      {[...Array(5)].map((_, i) => (
                        <Ionicons
                          key={i}
                          name={i < r.rating ? 'star' : 'star-outline'}
                          size={14}
                          color="#F59E0B"
                        />
                      ))}
                    </View>
                  </View>
                </View>
                <Text style={styles.reviewComment}>{r.comment}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingBottom: 30,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  infoCard: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  hospitalName: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '800',
  },
  hospitalContact: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 6,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2563EB',
  },
  tabText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#2563EB',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '500',
  },
  caseCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  caseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  caseId: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
  },
  caseStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  caseStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  caseDesc: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  caseAmount: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '700',
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  vehicleIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehiclePlate: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  vehicleType: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 4,
  },
  vehicleStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  vehicleStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  balanceCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  balanceLabel: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  balanceAmount: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDesc: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
  },
  transactionDate: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 4,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  reviewCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reviewMeta: {
    flex: 1,
  },
  reviewUser: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  stars: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 2,
  },
  reviewComment: {
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default DashboardScreen;
