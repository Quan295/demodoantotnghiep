import { api } from '@/services/api';
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

const DashboardScreen = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'providers' | 'reports'>('overview');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [dispatchResources, setDispatchResources] = useState<any[]>([]);
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [operationZones, setOperationZones] = useState<any[]>([]);
  const [dispatchRequests, setDispatchRequests] = useState<any[]>([]);

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

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [usersData, providersData, resourcesData, serviceTypesData, zonesData, requestsData] = await Promise.all([
          api.getUsers(),
          api.getProviders(),
          api.getDispatchResources(),
          api.getServiceTypes(),
          api.getOperationZones(),
          api.getDispatchRequests(),
        ]);
        setUsers(usersData);
        setProviders(providersData);
        setDispatchResources(resourcesData);
        setServiceTypes(serviceTypesData);
        setOperationZones(zonesData);
        setDispatchRequests(requestsData);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#D97706" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="#D97706" />
      <LinearGradient colors={['#D97706', '#B45309']} style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <View style={{ width: 24 }} />
            <Text style={styles.headerTitle}>Cổng Quản Trị</Text>
            <TouchableOpacity onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color="#FFF" />
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
            <Text style={styles.sectionTitle}>Tổng quan</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <LinearGradient colors={['#F04438', '#D92D20']} style={styles.statIcon}>
                  <FontAwesome5 name="users" size={20} color="#FFF" />
                </LinearGradient>
                <Text style={styles.statValue}>{users.length}</Text>
                <Text style={styles.statLabel}>Người dùng</Text>
              </View>
              <View style={styles.statCard}>
                <LinearGradient colors={['#10B981', '#059669']} style={styles.statIcon}>
                  <MaterialCommunityIcons name="truck-plus" size={20} color="#FFF" />
                </LinearGradient>
                <Text style={styles.statValue}>{providers.length}</Text>
                <Text style={styles.statLabel}>Nhà cung cấp</Text>
              </View>
              <View style={styles.statCard}>
                <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.statIcon}>
                  <FontAwesome5 name="ambulance" size={20} color="#FFF" />
                </LinearGradient>
                <Text style={styles.statValue}>{dispatchResources.length}</Text>
                <Text style={styles.statLabel}>Xe cứu thương</Text>
              </View>
              <View style={styles.statCard}>
                <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.statIcon}>
                  <FontAwesome5 name="headset" size={20} color="#FFF" />
                </LinearGradient>
                <Text style={styles.statValue}>{dispatchRequests.length}</Text>
                <Text style={styles.statLabel}>Yêu cầu</Text>
              </View>
            </View>
            
            <Text style={styles.sectionTitle}>Yêu cầu gần đây</Text>
            {dispatchRequests.slice(0, 5).map((req) => (
              <View key={req.id} style={styles.caseCard}>
                <View style={styles.caseHeader}>
                  <Text style={styles.caseId}>#{req.id}</Text>
                  <View style={[styles.caseStatus, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                    <Text style={[styles.caseStatusText, { color: '#F59E0B' }]}>
                      {req.status || 'Mới'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.caseDesc}>
                  {req.description || 'Yêu cầu cấp cứu'}
                </Text>
              </View>
            ))}
            {dispatchRequests.length === 0 && (
              <Text style={styles.emptyText}>Chưa có yêu cầu nào</Text>
            )}
          </View>
        )}

        {activeTab === 'providers' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nhà cung cấp</Text>
            {providers.map((provider) => (
              <View key={provider.id} style={styles.providerCard}>
                <LinearGradient colors={['#10B981', '#059669']} style={styles.providerIcon}>
                  <FontAwesome5 name="clinic-medical" size={20} color="#FFF" />
                </LinearGradient>
                <View style={styles.providerInfo}>
                  <Text style={styles.providerName}>{provider.name || 'Nhà cung cấp'}</Text>
                  <Text style={styles.providerMeta}>
                    {provider.phoneNumber || provider.email || 'Chưa có thông tin'}
                  </Text>
                </View>
              </View>
            ))}
            {providers.length === 0 && (
              <Text style={styles.emptyText}>Chưa có nhà cung cấp nào</Text>
            )}
          </View>
        )}

        {activeTab === 'reports' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Báo cáo</Text>
            <View style={styles.reportCard}>
              <LinearGradient colors={['#F04438', '#D92D20']} style={styles.reportIcon}>
                <MaterialCommunityIcons name="chart-bar" size={28} color="#FFF" />
              </LinearGradient>
              <View style={styles.reportInfo}>
                <Text style={styles.reportTitle}>Tổng số ca cấp cứu</Text>
                <Text style={styles.reportDesc}>{dispatchRequests.length} ca</Text>
              </View>
            </View>
            <View style={styles.reportCard}>
              <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.reportIcon}>
                <MaterialCommunityIcons name="map-marker-radius" size={28} color="#FFF" />
              </LinearGradient>
              <View style={styles.reportInfo}>
                <Text style={styles.reportTitle}>Vùng hoạt động</Text>
                <Text style={styles.reportDesc}>{operationZones.length} vùng</Text>
              </View>
            </View>
            <View style={styles.reportCard}>
              <LinearGradient colors={['#10B981', '#059669']} style={styles.reportIcon}>
                <MaterialCommunityIcons name="star" size={28} color="#FFF" />
              </LinearGradient>
              <View style={styles.reportInfo}>
                <Text style={styles.reportTitle}>Dịch vụ</Text>
                <Text style={styles.reportDesc}>{serviceTypes.length} loại</Text>
              </View>
            </View>
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
