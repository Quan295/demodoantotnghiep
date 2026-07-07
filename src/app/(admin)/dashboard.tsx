import { mockCases, mockProvider, mockSystemStats } from '@/data/mockData';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'providers' | 'reports'>('overview');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="#D97706" />
      <LinearGradient colors={['#D97706', '#B45309']} style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Cổng Quản Trị</Text>
            <TouchableOpacity onPress={() => {}}>
              <Ionicons name="notifications-outline" size={24} color="#FFF" />
            </TouchableOpacity>
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
          style={[styles.tab, activeTab === 'providers' && styles.activeTab]}
          onPress={() => setActiveTab('providers')}
        >
          <Text style={[styles.tabText, activeTab === 'providers' && styles.activeTabText]}>Nhà cung cấp</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reports' && styles.activeTab]}
          onPress={() => setActiveTab('reports')}
        >
          <Text style={[styles.tabText, activeTab === 'reports' && styles.activeTabText]}>Báo cáo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'overview' && (
          <View style={styles.section}>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <LinearGradient colors={['#D97706', '#B45309']} style={styles.statIcon}>
                  <FontAwesome5 name="ambulance" size={20} color="#FFF" />
                </LinearGradient>
                <Text style={styles.statValue}>{mockSystemStats.totalCases}</Text>
                <Text style={styles.statLabel}>Tổng ca</Text>
              </View>
              <View style={styles.statCard}>
                <LinearGradient colors={['#10B981', '#059669']} style={styles.statIcon}>
                  <FontAwesome5 name="building" size={20} color="#FFF" />
                </LinearGradient>
                <Text style={styles.statValue}>{mockSystemStats.totalProviders + mockSystemStats.totalHospitals}</Text>
                <Text style={styles.statLabel}>Đối tác</Text>
              </View>
              <View style={styles.statCard}>
                <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.statIcon}>
                  <FontAwesome5 name="coins" size={20} color="#FFF" />
                </LinearGradient>
                <Text style={styles.statValue}>{formatCurrency(mockSystemStats.totalRevenue).replace('₫', '')}đ</Text>
                <Text style={styles.statLabel}>Doanh thu</Text>
              </View>
              <View style={styles.statCard}>
                <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.statIcon}>
                  <FontAwesome5 name="star" size={20} color="#FFF" />
                </LinearGradient>
                <Text style={styles.statValue}>{mockSystemStats.avgRating.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Đánh giá TB</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>⚠️ Cảnh báo</Text>
            {mockSystemStats.flaggedProviders.map((fp, i) => (
              <View key={i} style={styles.alertCard}>
                <LinearGradient colors={['#FEF3C7', '#FDE68A']} style={styles.alertContent}>
                  <MaterialCommunityIcons name="alert-outline" size={24} color="#92400E" />
                  <View style={styles.alertMeta}>
                    <Text style={styles.alertTitle}>{fp.providerName}</Text>
                    <Text style={styles.alertDesc}>Tỷ lệ khiếu nại: {fp.complaintRate}%</Text>
                  </View>
                </LinearGradient>
              </View>
            ))}

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

        {activeTab === 'providers' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Nhà cung cấp</Text>
            <View key={mockProvider.id} style={styles.providerCard}>
              <LinearGradient colors={['#10B981', '#059669']} style={styles.providerIcon}>
                <FontAwesome5 name="truckMedical" size={24} color="#FFF" />
              </LinearGradient>
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>{mockProvider.companyName}</Text>
                <Text style={styles.providerMeta}>{mockProvider.totalCases} ca • {mockProvider.avgRating.toFixed(1)}⭐</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </View>
          </View>
        )}

        {activeTab === 'reports' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Báo cáo thống kê</Text>
            <TouchableOpacity style={styles.reportCard}>
              <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.reportIcon}>
                <Ionicons name="document-text" size={28} color="#FFF" />
              </LinearGradient>
              <View style={styles.reportInfo}>
                <Text style={styles.reportTitle}>Báo cáo doanh thu tháng</Text>
                <Text style={styles.reportDesc}>Xem chi tiết doanh thu, phí dịch vụ</Text>
              </View>
              <Ionicons name="download-outline" size={24} color="#9CA3AF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.reportCard}>
              <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.reportIcon}>
                <Ionicons name="bar-chart" size={28} color="#FFF" />
              </LinearGradient>
              <View style={styles.reportInfo}>
                <Text style={styles.reportTitle}>Báo cáo hiệu suất</Text>
                <Text style={styles.reportDesc}>Thống kê hiệu suất các nhà cung cấp</Text>
              </View>
              <Ionicons name="download-outline" size={24} color="#9CA3AF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.reportCard}>
              <LinearGradient colors={['#10B981', '#059669']} style={styles.reportIcon}>
                <Ionicons name="chatbubbles" size={28} color="#FFF" />
              </LinearGradient>
              <View style={styles.reportInfo}>
                <Text style={styles.reportTitle}>Báo cáo đánh giá</Text>
                <Text style={styles.reportDesc}>Tổng hợp đánh giá, feedback</Text>
              </View>
              <Ionicons name="download-outline" size={24} color="#9CA3AF" />
            </TouchableOpacity>
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
    paddingBottom: 20,
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
    borderBottomColor: '#D97706',
  },
  tabText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#D97706',
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
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
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
  alertCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  alertContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  alertMeta: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  alertDesc: {
    fontSize: 13,
    color: '#B45309',
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
    color: '#D97706',
    fontSize: 16,
    fontWeight: '700',
  },
  providerCard: {
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
  providerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  providerMeta: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 4,
  },
  reportCard: {
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
  reportIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  reportInfo: {
    flex: 1,
  },
  reportTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  reportDesc: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 4,
  },
});

export default DashboardScreen;
