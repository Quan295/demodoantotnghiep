import { api } from '@/services/api';
import { EmergencyCase, Review, User, Vehicle } from '@/types';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ProviderData {
    provider?: User;
    vehicles?: Vehicle[];
    cases?: EmergencyCase[];
    transactions?: any[];
    reviews?: Review[];
}

const DashboardScreen = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'vehicles' | 'finance' | 'reviews'>('overview');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProviderData>({});
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      router.replace('/');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const getVehicleTypeLabel = (type: string) => {
    switch (type) {
      case 'ambulance': return 'Cấp cứu cơ bản';
      case 'emergency-car': return 'Cấp cứu nâng cao';
      default: return 'Khác';
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Load current user
        const currentUser = await api.getCurrentUser();
        
        // Load dispatch resources (vehicles)
        const vehicles = await api.getDispatchResources();
        
        // Load provider specific data based on API availability
        // For now, we'll load what's available
        setData({
          provider: currentUser,
          vehicles: vehicles,
        });
      } catch (error: any) {
        console.error(error);
        setError(error.message || 'Không thể tải dữ liệu');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={{ color: '#EF4444', textAlign: 'center', marginBottom: 20 }}>{error}</Text>
        <TouchableOpacity
          style={{ paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#059669', borderRadius: 12 }}
          onPress={() => window.location.reload()}
        >
          <Text style={{ color: '#FFF', fontWeight: '600' }}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="#059669" />
      <LinearGradient colors={['#059669', '#047857']} style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <View style={{ width: 24 }} />
            <Text style={styles.headerTitle}>Cổng Nhà Cung Cấp</Text>
            <TouchableOpacity onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          {data.provider && (
            <View style={styles.walletCard}>
              <Text style={styles.walletLabel}>Số dư hiện tại</Text>
              <Text style={styles.walletAmount}>
                {formatCurrency(data.provider.balance || 0)}
              </Text>
              <View style={styles.walletActions}>
                <TouchableOpacity style={styles.walletBtn}>
                  <Ionicons name="add-circle-outline" size={20} color="#10B981" />
                  <Text style={styles.walletBtnText}>Nạp tiền</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.walletBtn}>
                  <Ionicons name="arrow-down-circle-outline" size={20} color="#059669" />
                  <Text style={styles.walletBtnText}>Rút tiền</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
                <LinearGradient colors={['#10B981', '#059669']} style={styles.statIcon}>
                  <FontAwesome5 name="clipboard-list" size={20} color="#FFF" />
                </LinearGradient>
                <Text style={styles.statValue}>{data.vehicles?.length || 0}</Text>
                <Text style={styles.statLabel}>Số xe</Text>
              </View>
              <View style={styles.statCard}>
                <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.statIcon}>
                  <FontAwesome5 name="star" size={20} color="#FFF" />
                </LinearGradient>
                <Text style={styles.statValue}>{data.provider?.avgRating?.toFixed(1) || '5.0'}</Text>
                <Text style={styles.statLabel}>Đánh giá</Text>
              </View>
              <View style={styles.statCard}>
                <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.statIcon}>
                  <FontAwesome5 name="coins" size={20} color="#FFF" />
                </LinearGradient>
                <Text style={styles.statValue}>{formatCurrency(data.provider?.totalRevenue || 0).replace('₫', '')}đ</Text>
                <Text style={styles.statLabel}>Doanh thu</Text>
              </View>
              <View style={styles.statCard}>
                <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.statIcon}>
                  <MaterialCommunityIcons name="clock-fast" size={20} color="#FFF" />
                </LinearGradient>
                <Text style={styles.statValue}>{data.provider?.totalCases || 0}</Text>
                <Text style={styles.statLabel}>Tổng ca</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Xe cứu hộ</Text>
            {data.vehicles?.map((vehicle) => (
              <View key={vehicle.id} style={styles.vehicleCard}>
                <LinearGradient colors={['#10B981', '#059669']} style={styles.vehicleIcon}>
                  <MaterialCommunityIcons name="truck-plus" size={24} color="#FFF" />
                </LinearGradient>
                <View style={styles.vehicleInfo}>
                  <Text style={styles.vehiclePlate}>{vehicle.licensePlate}</Text>
                  <Text style={styles.vehicleType}>{getVehicleTypeLabel(vehicle.type)}</Text>
                </View>
                <View style={[
                  styles.vehicleStatus,
                  { backgroundColor: vehicle.status === 'available' ? '#10B98120' : vehicle.status === 'busy' ? '#EF444420' : '#6B728020' }
                ]}>
                  <Text style={[
                    styles.vehicleStatusText,
                    { color: vehicle.status === 'available' ? '#10B981' : vehicle.status === 'busy' ? '#EF4444' : '#6B7280' }
                  ]}>
                    {vehicle.status === 'available' ? 'Sẵn sàng' : vehicle.status === 'busy' ? 'Bận' : vehicle.status}
                  </Text>
                </View>
              </View>
            ))}

            {(!data.vehicles || data.vehicles.length === 0) && (
              <Text style={styles.emptyText}>Chưa có xe cứu hộ nào</Text>
            )}
          </View>
        )}

        {activeTab === 'vehicles' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Danh sách xe</Text>
            {data.vehicles?.map((vehicle) => (
              <View key={vehicle.id} style={styles.vehicleCard}>
                <LinearGradient colors={['#10B981', '#059669']} style={styles.vehicleIcon}>
                  <MaterialCommunityIcons name="truck-plus" size={24} color="#FFF" />
                </LinearGradient>
                <View style={styles.vehicleInfo}>
                  <Text style={styles.vehiclePlate}>{vehicle.licensePlate}</Text>
                  <Text style={styles.vehicleType}>{getVehicleTypeLabel(vehicle.type)}</Text>
                </View>
                <View style={[
                  styles.vehicleStatus,
                  { backgroundColor: vehicle.status === 'available' ? '#10B98120' : vehicle.status === 'busy' ? '#EF444420' : '#6B728020' }
                ]}>
                  <Text style={[
                    styles.vehicleStatusText,
                    { color: vehicle.status === 'available' ? '#10B981' : vehicle.status === 'busy' ? '#EF4444' : '#6B7280' }
                  ]}>
                    {vehicle.status === 'available' ? 'Sẵn sàng' : vehicle.status === 'busy' ? 'Bận' : vehicle.status}
                  </Text>
                </View>
              </View>
            ))}

            {(!data.vehicles || data.vehicles.length === 0) && (
              <Text style={styles.emptyText}>Chưa có xe cứu hộ nào</Text>
            )}
          </View>
        )}

        {activeTab === 'finance' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lịch sử giao dịch</Text>
            <Text style={styles.emptyText}>Dữ liệu sẽ được hiển thị khi API khả dụng</Text>
          </View>
        )}

        {activeTab === 'reviews' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Đánh giá từ khách hàng</Text>
            <Text style={styles.emptyText}>Dữ liệu sẽ được hiển thị khi API khả dụng</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
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
  walletCard: {
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
  walletLabel: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  walletAmount: {
    color: '#111827',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4,
  },
  walletActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  walletBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
  },
  walletBtnText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '600',
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
    borderBottomColor: '#059669',
  },
  tabText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#059669',
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
    color: '#059669',
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
    backgroundColor: '#F0FDF4',
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
