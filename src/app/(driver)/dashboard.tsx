import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  Vibration,
  Alert,
  ActivityIndicator,
  Linking,
  RefreshControl,
  FlatList,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
  Feather,
} from '@expo/vector-icons';
import { api } from '@/services/api';
import { globalConfig } from '@/services/config';
import {
  DispatchMission,
  DispatchMissionStatus,
  DriverResource,
  LatLng,
  getResourceLicensePlate,
} from '@/types';
import AmbulanceMap from '@/components/AmbulanceMap';
import { useDriverLocationTracking } from '@/hooks/useDriverLocationTracking';

const { width, height } = Dimensions.get('window');

interface LocationSyncLog {
  id: string;
  time: string;
  coords: string;
  speed: number;
  status: string;
  source: 'AUTO_GPS' | 'MANUAL';
}

export default function DriverDashboard() {
  const router = useRouter();

  // Tab State: 'overview' | 'missions' | 'vehicle' | 'logs'
  const [activeTab, setActiveTab] = useState<'overview' | 'missions' | 'vehicle' | 'logs'>('overview');

  // Resource State from API (GET /driver-resource)
  const [driverResource, setDriverResource] = useState<DriverResource | null>(null);
  const [loadingResource, setLoadingResource] = useState<boolean>(true);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const [resourceConnected, setResourceConnected] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Status & GPS Switch
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true);

  // Mission State (DRIVER - Mission API)
  const [activeRunningMission, setActiveRunningMission] = useState<DispatchMission | null>(null);
  const [missionsList, setMissionsList] = useState<DispatchMission[]>([]);
  const [selectedDetailMission, setSelectedDetailMission] = useState<DispatchMission | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Reusable Single Source of Truth Driver Location Tracking
  const shouldTrack = autoSyncEnabled || !!activeRunningMission;
  const {
    position: currentPos,
    latitude: currentLat,
    longitude: currentLng,
    speed: currentSpeed,
    heading: currentHeading,
    accuracy: currentAccuracy,
    gpsStatus,
    lastSyncedAt,
    syncError,
    syncInProgress,
    manualSync,
  } = useDriverLocationTracking({
    enabled: shouldTrack,
    missionId: activeRunningMission?.id,
    timeInterval: 3000,
    distanceInterval: 5,
  });

  // GPS Logs List (Local session logs only)
  const [gpsLogs, setGpsLogs] = useState<LocationSyncLog[]>([]);

  // Log session updates when synced
  useEffect(() => {
    if (lastSyncedAt) {
      const newLog: LocationSyncLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        time: lastSyncedAt,
        coords: `${currentLat.toFixed(6)}° N, ${currentLng.toFixed(6)}° E`,
        speed: currentSpeed,
        status: 'Đã đồng bộ lên máy chủ (PostGIS)',
        source: 'AUTO_GPS',
      };
      setGpsLogs(prev => [newLog, ...prev.slice(0, 24)]);
    }
  }, [lastSyncedAt, currentLat, currentLng, currentSpeed]);

  useEffect(() => {
    if (syncError) {
      const errLog: LocationSyncLog = {
        id: `log-err-${Date.now()}`,
        time: new Date().toLocaleTimeString('vi-VN'),
        coords: `${currentLat.toFixed(6)}° N, ${currentLng.toFixed(6)}° E`,
        speed: currentSpeed,
        status: `Đồng bộ thất bại: ${syncError}`,
        source: 'AUTO_GPS',
      };
      setGpsLogs(prev => [errLog, ...prev.slice(0, 24)]);
    }
  }, [syncError, currentLat, currentLng, currentSpeed]);

  // Incoming Mission Alert State
  const [showIncomingOrder, setShowIncomingOrder] = useState<boolean>(false);
  const [activeMission, setActiveMission] = useState<DispatchMission | null>(null);

  // Animations
  const flashAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  const radarScale = useRef(new Animated.Value(1)).current;
  const pulseSyncAnim = useRef(new Animated.Value(1)).current;

  // 1. Fetch Driver Resource via GET /driver-resource (No fake fallback)
  const fetchDriverResource = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoadingResource(true);
      setResourceError(null);

      const resource = await api.getDriverResource();
      console.log('[DriverDashboard] Fetched Driver Resource:', resource);
      if (resource) {
        setDriverResource(resource);
        setResourceConnected(true);
        const statusUpper = (resource.status || '').toUpperCase();
        setIsAvailable(statusUpper === 'AVAILABLE' || statusUpper === 'SẴN SÀNG');
      } else {
        setResourceConnected(false);
      }
    } catch (err: any) {
      console.error('[DriverDashboard] Error fetching driver resource:', err?.message || err);
      setDriverResource(null);
      setResourceConnected(false);
      setResourceError('Không thể tải thông tin xe từ máy chủ backend');
    } finally {
      setLoadingResource(false);
      setRefreshing(false);
    }
  }, []);

  // 2. Fetch Active Missions (GET /dispatch-missions/me/active) with exact BE status matching
  const fetchActiveMissions = useCallback(async () => {
    try {
      const activeList = await api.getMyActiveMissions();
      if (Array.isArray(activeList) && activeList.length > 0) {
        // DISPATCHED: new incoming assignment awaiting driver acceptance
        const assignedOrder = activeList.find(m => m.status === 'DISPATCHED');
        // Ongoing mission in progress
        const runningOrder = activeList.find(m =>
          ['ACCEPTED', 'EN_ROUTE', 'ARRIVED_SCENE', 'TRANSPORTING', 'ARRIVED_HOSPITAL'].includes(m.status)
        );

        if (assignedOrder && !showIncomingOrder) {
          setActiveMission(assignedOrder);
          setShowIncomingOrder(true);
        }

        setActiveRunningMission(runningOrder || null);
      } else {
        setActiveRunningMission(null);
      }
    } catch (e) {
      console.warn('[DriverDashboard] fetchActiveMissions error:', e);
    }
  }, [showIncomingOrder]);

  // 3. Fetch Mission History (GET /dispatch-missions/me)
  const fetchMissionsHistory = useCallback(async () => {
    try {
      const history = await api.getMyMissions();
      if (Array.isArray(history)) {
        setMissionsList(history);
      }
    } catch (e) {
      console.warn('[DriverDashboard] fetchMissionsHistory error:', e);
    }
  }, []);

  // 4. View Mission Detail (GET /dispatch-missions/me/{missionId})
  const handleOpenMissionDetail = async (missionItem: DispatchMission) => {
    setSelectedDetailMission(missionItem);
    setShowDetailModal(true);
    setLoadingDetail(true);
    try {
      const detailed = await api.getMyMission(missionItem.id);
      if (detailed) {
        setSelectedDetailMission(detailed);
      }
    } catch (e) {
      console.warn('[DriverDashboard] getMyMission error:', e);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Manual Sync Location Button Handler
  const handleManualSyncLocation = async () => {
    try {
      const success = await manualSync();
      if (success) {
        Alert.alert(
          'Đã Cập Nhật Vị Trí',
          `Vị trí xe cứu thương đã được đồng bộ lên máy chủ thành công!\n\nTọa độ: ${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}\nThời gian: ${lastSyncedAt || new Date().toLocaleTimeString('vi-VN')}`
        );
      } else {
        Alert.alert('Thông báo', syncError || 'Chưa thể đồng bộ vị trí, vui lòng kiểm tra kết nối GPS và mạng.');
      }
    } catch (e: any) {
      Alert.alert('Lỗi', 'Không thể cập nhật vị trí xe cứu thương: ' + e.message);
    }
  };

  // Initial Load (Runs ONCE on screen mount)
  useEffect(() => {
    fetchDriverResource();
    fetchActiveMissions();
    fetchMissionsHistory();
  }, [fetchActiveMissions, fetchDriverResource, fetchMissionsHistory]);

  // 9. Incoming Mission Overlay Animation
  useEffect(() => {
    if (showIncomingOrder) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(radarScale, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(radarScale, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();

      if (Platform.OS !== 'web') Vibration.vibrate([0, 500, 200, 500], true);

      Animated.loop(
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
          Animated.timing(flashAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
        ])
      ).start();
    } else {
      Animated.timing(slideAnim, { toValue: height, duration: 300, useNativeDriver: true }).start();
      if (Platform.OS !== 'web') Vibration.cancel();
    }
  }, [showIncomingOrder, flashAnim, radarScale, slideAnim]);

  // Trigger demo incoming emergency order (__DEV__ only)
  const handleSimulateIncomingOrder = () => {
    const mission: DispatchMission = {
      id: 3,
      requestId: 3,
      resourceId: 2,
      destinationName: '12 Chùa Bộc, Đống Đa, Hà Nội',
      status: 'DISPATCHED',
      dispatchedAt: new Date().toISOString(),
      notes: 'Tai nạn giao thông - Yêu cầu cấp cứu khẩn cấp',
    };
    setActiveMission(mission);
    setShowIncomingOrder(true);
  };

  // POST /dispatch-missions/{id}/accept
  const handleAcceptOrder = async () => {
    setShowIncomingOrder(false);
    if (!activeMission) return;
    const missionId = activeMission.id;
    try {
      console.log('[DriverDashboard] Calling POST /dispatch-missions/{id}/accept:', missionId);
      await api.acceptMission(missionId);

      const missionAny = activeMission as any;
      const incLat = missionAny?.incidentLatitude ?? missionAny?.latitude ?? missionAny?.request?.latitude ?? 21.0285;
      const incLng = missionAny?.incidentLongitude ?? missionAny?.longitude ?? missionAny?.request?.longitude ?? 105.8542;

      router.push({
        pathname: '/(driver)/navigation',
        params: {
          missionId: String(missionId),
          dispatchMissionId: String(missionId),
          requestId: String(activeMission.requestId || ''),
          destinationName: activeMission.destinationName || '',
          lat: String(incLat),
          lng: String(incLng),
        },
      });
    } catch (e: any) {
      console.error('[DriverDashboard] acceptMission error:', e);
      Alert.alert('Không thể nhận nhiệm vụ', e?.message || 'Vui lòng thử lại');
      fetchActiveMissions();
    }
  };

  // POST /dispatch-missions/{id}/reject
  const handleDeclineOrder = async () => {
    setShowIncomingOrder(false);
    if (activeMission?.id) {
      try {
        console.log('[DriverDashboard] Calling POST /dispatch-missions/{id}/reject:', activeMission.id);
        await api.rejectMission(activeMission.id, 'Tài xế từ chối ca');
      } catch (e) {
        console.warn('[DriverDashboard] rejectMission error:', e);
      }
    }
    Alert.alert('Đã Từ Chối Ca', 'Yêu cầu cứu trợ đã được chuyển tiếp tới trung tâm điều phối.');
    fetchActiveMissions();
  };

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn kết thúc ca trực và đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: () => {
          globalConfig.setToken(null);
          globalConfig.setRefreshToken(null);
          globalConfig.setCurrentUser(null);
          router.replace('/');
        },
      },
    ]);
  };

  const handleCallDispatcher = () => {
    Linking.openURL('tel:115').catch(() => {
      Alert.alert('Thông báo', 'Tổng đài điều phối 115: 115');
    });
  };

  const currentUser = globalConfig.getCurrentUser();
  const driverName = driverResource?.driverName || currentUser?.name || 'Tài xế';
  const unitBadge = driverResource?.resourceCode || (driverResource?.id ? `UNIT #${driverResource.id}` : 'Chưa có mã xe');
  const vehicleType = driverResource?.resourceType || 'Chưa có thông tin loại xe';
  const licensePlate = getResourceLicensePlate(driverResource);

  const mapAmbulanceLocation: LatLng = {
    lat: currentLat,
    lng: currentLng,
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#070A10', '#0F172A', '#0B0F19']} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>

          {/* TOP HEADER */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.badgeRow}>
                <View style={styles.unitBadge}>
                  <MaterialCommunityIcons name="ambulance" size={12} color="#10B981" />
                  <Text style={styles.unitText}>{unitBadge}</Text>
                </View>
                <View style={[styles.plateBadge, { backgroundColor: isAvailable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)' }]}>
                  <Text style={[styles.plateText, { color: isAvailable ? '#34D399' : '#94A3B8' }]}>{licensePlate}</Text>
                </View>
              </View>
              <Text style={styles.welcomeText} numberOfLines={1}>{driverName}</Text>
              <Text style={styles.providerText} numberOfLines={1}>
                <Ionicons name="car-outline" size={11} color="#94A3B8" /> {vehicleType}
              </Text>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={() => {
                  fetchDriverResource(true);
                  fetchActiveMissions();
                  fetchMissionsHistory();
                }}
                activeOpacity={0.7}
              >
                {loadingResource || refreshing ? (
                  <ActivityIndicator size="small" color="#10B981" />
                ) : (
                  <Ionicons name="refresh" size={18} color="#94A3B8" />
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
                <Ionicons name="log-out-outline" size={18} color="#F87171" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ONGOING ACTIVE MISSION STICKY BANNER */}
          {activeRunningMission && (
            <TouchableOpacity
              style={styles.runningMissionBanner}
              onPress={() => {
                const missionAny = activeRunningMission as any;
                const incLat = missionAny?.incidentLatitude ?? missionAny?.latitude ?? missionAny?.request?.latitude ?? 21.0285;
                const incLng = missionAny?.incidentLongitude ?? missionAny?.longitude ?? missionAny?.request?.longitude ?? 105.8542;

                router.push({
                  pathname: '/(driver)/navigation',
                  params: {
                    missionId: String(activeRunningMission.id),
                    dispatchMissionId: String(activeRunningMission.id),
                    requestId: String(activeRunningMission.requestId || ''),
                    destinationName: activeRunningMission.destinationName || '',
                    lat: String(incLat),
                    lng: String(incLng),
                  },
                });
              }}
              activeOpacity={0.85}
            >
              <View style={styles.runningBannerLeft}>
                <View style={styles.pulseDotRed} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.runningBannerTitle}>
                    NHIỆM VỤ ĐANG THỰC HIỆN (#{activeRunningMission.id}) • YÊU CẦU #{activeRunningMission.requestId}
                  </Text>
                  <Text style={styles.runningBannerSubtitle} numberOfLines={1}>
                    {activeRunningMission.destinationName || 'Chưa xác định điểm đến'}
                  </Text>
                </View>
              </View>
              <View style={styles.runningBannerBtn}>
                <Text style={styles.runningBannerBtnText}>TIẾP TỤC ➔</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* TAB BAR NAVIGATION */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'overview' && styles.tabItemActive]}
              onPress={() => setActiveTab('overview')}
            >
              <MaterialCommunityIcons
                name="view-dashboard-outline"
                size={16}
                color={activeTab === 'overview' ? '#10B981' : '#64748B'}
              />
              <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
                Ca Trực & GPS
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'missions' && styles.tabItemActive]}
              onPress={() => {
                setActiveTab('missions');
                fetchMissionsHistory();
              }}
            >
              <MaterialCommunityIcons
                name="clipboard-list-outline"
                size={16}
                color={activeTab === 'missions' ? '#10B981' : '#64748B'}
              />
              <Text style={[styles.tabText, activeTab === 'missions' && styles.tabTextActive]}>
                Nhiệm Vụ ({missionsList.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'vehicle' && styles.tabItemActive]}
              onPress={() => setActiveTab('vehicle')}
            >
              <MaterialCommunityIcons
                name="car-wrench"
                size={16}
                color={activeTab === 'vehicle' ? '#10B981' : '#64748B'}
              />
              <Text style={[styles.tabText, activeTab === 'vehicle' && styles.tabTextActive]}>
                Xe & Thiết Bị
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'logs' && styles.tabItemActive]}
              onPress={() => setActiveTab('logs')}
            >
              <MaterialCommunityIcons
                name="history"
                size={16}
                color={activeTab === 'logs' ? '#10B981' : '#64748B'}
              />
              <Text style={[styles.tabText, activeTab === 'logs' && styles.tabTextActive]}>
                Nhật Ký Phiên
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: OVERVIEW & GPS DISPATCH */}
          {activeTab === 'overview' && (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => fetchDriverResource(true)}
                  tintColor="#10B981"
                />
              }
            >
              {/* STATUS CARD (DISABLED SWITCH AS BACKEND DOES NOT SUPPORT PATCH /status) */}
              <View style={styles.statusCard}>
                <View style={styles.statusLeft}>
                  <View style={[styles.statusIconBox, { backgroundColor: isAvailable ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' }]}>
                    <MaterialCommunityIcons
                      name={isAvailable ? 'radiobox-marked' : 'radiobox-blank'}
                      size={22}
                      color={isAvailable ? '#10B981' : '#EF4444'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statusLabel}>TRẠNG THÁI XE CẤP CỨU</Text>
                    <Text style={[styles.statusValue, { color: isAvailable ? '#34D399' : '#F87171' }]}>
                      {driverResource?.status || (isAvailable ? 'AVAILABLE' : 'OFFLINE')}
                    </Text>
                    <Text style={styles.statusNote}>
                      Chức năng cập nhật ca trực chưa được backend hỗ trợ
                    </Text>
                  </View>
                </View>

                <Switch
                  value={isAvailable}
                  disabled={true}
                  trackColor={{ false: '#334155', true: '#059669' }}
                  thumbColor={isAvailable ? '#34D399' : '#94A3B8'}
                />
              </View>

              {/* API RESOURCE SUMMARY CARD */}
              <View style={styles.resourceSummaryCard}>
                <View style={styles.resourceHeaderRow}>
                  <View style={styles.resourceIconCircle}>
                    <FontAwesome5 name="ambulance" size={18} color="#10B981" />
                  </View>
                  <View style={styles.resourceTitleBlock}>
                    <Text style={styles.resourceVehicleType}>{vehicleType}</Text>
                    <Text style={styles.resourceSubInfo}>
                      Mã xe: {unitBadge} • Biển: {licensePlate}
                    </Text>
                  </View>
                  <View style={[styles.liveTag, { backgroundColor: resourceConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
                    <View style={[styles.liveDot, { backgroundColor: resourceConnected ? '#10B981' : '#EF4444' }]} />
                    <Text style={[styles.liveTagText, { color: resourceConnected ? '#34D399' : '#F87171' }]}>
                      {resourceConnected ? 'API CONNECTED' : 'API DISCONNECTED'}
                    </Text>
                  </View>
                </View>

                {resourceError ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle-outline" size={16} color="#F87171" />
                    <Text style={styles.errorText}>{resourceError}</Text>
                  </View>
                ) : null}
              </View>

              {/* GPS POSTGIS SYNCHRONIZATION CONTROL */}
              <View style={styles.gpsSyncPanel}>
                <View style={styles.gpsPanelHeader}>
                  <View style={styles.gpsPanelTitleRow}>
                    <Animated.View style={{ transform: [{ scale: pulseSyncAnim }] }}>
                      <MaterialCommunityIcons name="satellite-uplink" size={20} color="#10B981" />
                    </Animated.View>
                    <View>
                      <Text style={styles.gpsPanelTitle}>ĐỒNG BỘ GPS POSTGIS</Text>
                      <Text style={styles.gpsPanelSubTitle}>
                        PATCH /driver-resource/location
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.syncNowBtn, syncInProgress && styles.syncNowBtnActive]}
                    onPress={handleManualSyncLocation}
                    disabled={syncInProgress}
                    activeOpacity={0.8}
                  >
                    {syncInProgress ? (
                      <ActivityIndicator size="small" color="#022C22" />
                    ) : (
                      <>
                        <Feather name="upload-cloud" size={14} color="#022C22" />
                        <Text style={styles.syncNowText}>CẬP NHẬT</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* GPS / Server Real-time Status Indicators */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: gpsStatus === 'tracking' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: gpsStatus === 'tracking' ? '#10B981' : '#EF4444', marginRight: 6 }} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: gpsStatus === 'tracking' ? '#34D399' : '#F87171' }}>
                      GPS: {gpsStatus === 'tracking' ? 'Đang hoạt động' : gpsStatus === 'denied' ? 'Bị từ chối quyền' : 'Đang lấy tín hiệu'}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: !syncError ? 'rgba(56, 189, 248, 0.15)' : 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: !syncError ? '#38BDF8' : '#EF4444', marginRight: 6 }} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: !syncError ? '#38BDF8' : '#F87171' }}>
                      Server: {syncError ? 'Lỗi kết nối' : (lastSyncedAt ? `${lastSyncedAt}` : 'Chờ đồng bộ')}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(148, 163, 184, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#94A3B8' }}>
                      Độ chính xác: ~{currentAccuracy.toFixed(0)}m • Tốc độ: {currentSpeed.toFixed(0)} km/h
                    </Text>
                  </View>
                </View>

                {/* Coordinates Grid */}
                <View style={styles.coordsGrid}>
                  <View style={styles.coordBox}>
                    <Text style={styles.coordLabel}>VĨ ĐỘ (LATITUDE)</Text>
                    <Text style={styles.coordValue}>{currentLat.toFixed(6)}° N</Text>
                  </View>
                  <View style={styles.coordBox}>
                    <Text style={styles.coordLabel}>KINH ĐỘ (LONGITUDE)</Text>
                    <Text style={styles.coordValue}>{currentLng.toFixed(6)}° E</Text>
                  </View>
                </View>

                <View style={styles.coordsSubGrid}>
                  <View style={styles.subCoordItem}>
                    <Ionicons name="time-outline" size={14} color="#94A3B8" />
                    <Text style={styles.subCoordText}>Đồng bộ gần nhất: {lastSyncedAt || 'Chưa có'}</Text>
                  </View>
                </View>

                {/* Auto Sync Switch Row */}
                <View style={styles.autoSyncRow}>
                  <View style={styles.autoSyncInfo}>
                    <Text style={styles.autoSyncTitle}>Tự động theo dõi & đồng bộ GPS</Text>
                    <Text style={styles.autoSyncDesc}>
                      {shouldTrack ? 'Đang tự động phát tín hiệu vị trí thời gian thực (3s/lần)' : 'Đã tạm dừng theo dõi GPS'}
                    </Text>
                  </View>
                  <Switch
                    value={autoSyncEnabled}
                    onValueChange={setAutoSyncEnabled}
                    trackColor={{ false: '#334155', true: '#10B981' }}
                    thumbColor="#FFF"
                  />
                </View>
              </View>

              {/* MINI MAP PREVIEW */}
              <View style={styles.mapPreviewCard}>
                <View style={styles.mapPreviewHeader}>
                  <MaterialCommunityIcons name="map-marker-radius" size={16} color="#10B981" />
                  <Text style={styles.mapPreviewTitle}>VỊ TRÍ XE CỨU THƯƠNG HIỆN TẠI</Text>
                </View>

                <View style={styles.mapFrame}>
                  <AmbulanceMap
                    victimLocation={currentPos}
                    ambulanceLocation={currentPos}
                  />
                  <View style={styles.mapOverlayPill}>
                    <View style={styles.pulseDot} />
                    <Text style={styles.mapOverlayText}>
                      {licensePlate} • {currentLat.toFixed(4)}, {currentLng.toFixed(4)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* DEV / SIMULATION ONLY */}
              {__DEV__ && (
                <View style={styles.devSection}>
                  <Text style={styles.devSectionTitle}>DÀNH CHO PHÁT TRIỂN (DEVELOPMENT)</Text>
                  <TouchableOpacity
                    style={styles.simulateOrderBtn}
                    onPress={handleSimulateIncomingOrder}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="alarm-light" size={18} color="#F87171" />
                    <Text style={styles.simulateOrderText}>MÔ PHỎNG CA CẤP CỨU (MOCK DISPATCH)</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* QUICK ACTION BUTTON */}
              <View style={styles.quickActionsContainer}>
                <TouchableOpacity
                  style={[styles.quickActionBtn, { backgroundColor: 'rgba(56, 189, 248, 0.12)', borderColor: 'rgba(56, 189, 248, 0.3)' }]}
                  onPress={handleCallDispatcher}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={20} color="#38BDF8" />
                  <Text style={[styles.quickActionText, { color: '#38BDF8' }]}>GỌI TỔNG ĐÀI 115</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* TAB 2: MISSIONS HISTORY (GET /dispatch-missions/me) - EXACT BE FIELDS */}
          {activeTab === 'missions' && (
            <FlatList
              data={missionsList}
              keyExtractor={(item, index) => (item?.id != null ? String(item.id) : `mission-key-${index}`)}
              contentContainerStyle={styles.missionsListContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => fetchMissionsHistory()}
                  tintColor="#10B981"
                />
              }
              renderItem={({ item }) => {
                const missionTime = item.dispatchedAt || item.acceptedAt || item.enRouteAt || item.completedAt;
                const formattedTime = missionTime && !Number.isNaN(new Date(missionTime).getTime())
                  ? new Date(missionTime).toLocaleString('vi-VN')
                  : 'Chưa có thời gian';

                return (
                  <View style={styles.missionCard}>
                    <View style={styles.missionCardHeader}>
                      <View style={styles.missionIdTag}>
                        <Text style={styles.missionIdTagText}>Nhiệm vụ #{item.id}</Text>
                      </View>
                      <View style={[styles.missionStatusBadge, getMissionStatusBadgeStyle(item.status)]}>
                        <Text style={styles.missionStatusBadgeText}>{getMissionStatusText(item.status)}</Text>
                      </View>
                    </View>

                    <Text style={styles.missionReqIdText}>
                      Yêu cầu điều phối #{item.requestId} • Xe #{item.resourceId}
                    </Text>

                    <Text style={styles.missionAddress} numberOfLines={2}>
                      <Ionicons name="location-outline" size={13} color="#94A3B8" />{' '}
                      {item.destinationName || 'Chưa xác định điểm đến'}
                    </Text>

                    {item.notes ? (
                      <Text style={styles.missionInjuryText} numberOfLines={2}>
                        <MaterialCommunityIcons name="clipboard-text-outline" size={12} color="#F59E0B" /> {item.notes}
                      </Text>
                    ) : null}

                    <View style={styles.missionMetaRow}>
                      <Text style={styles.missionMetaItem}>
                        <Ionicons name="time-outline" size={12} color="#64748B" /> {formattedTime}
                      </Text>
                    </View>

                    <View style={styles.missionCardActions}>
                      <TouchableOpacity
                        style={styles.viewDetailMissionBtn}
                        onPress={() => handleOpenMissionDetail(item)}
                      >
                        <Ionicons name="document-text-outline" size={14} color="#38BDF8" />
                        <Text style={styles.viewDetailMissionBtnText}>XEM CHI TIẾT</Text>
                      </TouchableOpacity>

                      {['DISPATCHED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED_SCENE', 'TRANSPORTING', 'ARRIVED_HOSPITAL'].includes(item.status) && (
                        <TouchableOpacity
                          style={styles.resumeMissionBtn}
                          onPress={() => {
                            router.push({
                              pathname: '/(driver)/navigation',
                              params: {
                                missionId: String(item.id),
                                dispatchMissionId: String(item.id),
                                requestId: String(item.requestId || ''),
                                destinationName: item.destinationName || '',
                              },
                            });
                          }}
                        >
                          <FontAwesome5 name="navigation" size={12} color="#022C22" />
                          <Text style={styles.resumeMissionBtnText}>ĐIỀU HƯỚNG</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons name="clipboard-text-off-outline" size={48} color="#334155" />
                  <Text style={styles.emptyTitle}>Chưa có nhiệm vụ nào</Text>
                  <Text style={styles.emptySubtitle}>
                    Các nhiệm vụ được điều phối từ hệ thống sẽ xuất hiện tại đây.
                  </Text>
                </View>
              }
            />
          )}

          {/* TAB 3: VEHICLE & RESOURCE SPECS (GET /driver-resource) */}
          {activeTab === 'vehicle' && (
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              <View style={styles.specCard}>
                <View style={styles.specHeaderRow}>
                  <MaterialCommunityIcons name="car-info" size={18} color="#10B981" />
                  <Text style={styles.specSectionTitle}>CHI TIẾT XE CỨU THƯƠNG (GET /driver-resource)</Text>
                </View>

                {driverResource ? (
                  <View style={styles.specGrid}>
                    <View style={styles.specHalfRow}>
                      <View style={styles.specBlock}>
                        <Text style={styles.specLabel}>MÃ XE (RESOURCE ID)</Text>
                        <Text style={styles.specValueHighlight}>#{driverResource.id}</Text>
                      </View>
                      <View style={styles.specBlock}>
                        <Text style={styles.specLabel}>MÃ ĐỊNH DANH (CODE)</Text>
                        <Text style={styles.specValueHighlight}>{driverResource.resourceCode || 'Chưa có'}</Text>
                      </View>
                    </View>

                    <View style={styles.specDivider} />

                    <View style={styles.specHalfRow}>
                      <View style={styles.specBlock}>
                        <Text style={styles.specLabel}>BIỂN KIỂM SOÁT</Text>
                        <Text style={[styles.specValueHighlight, { color: '#34D399' }]}>{licensePlate}</Text>
                      </View>
                      <View style={styles.specBlock}>
                        <Text style={styles.specLabel}>TRẠNG THÁI TRỰC</Text>
                        <Text style={[styles.specValueHighlight, { color: '#38BDF8' }]}>{driverResource.status || 'Chưa có'}</Text>
                      </View>
                    </View>

                    <View style={styles.specDivider} />

                    <View style={styles.specFullRow}>
                      <Text style={styles.specLabel}>LOẠI PHƯƠNG TIỆN (RESOURCE TYPE)</Text>
                      <Text style={styles.specValueBold}>{driverResource.resourceType || 'Chưa có thông tin'}</Text>
                    </View>

                    <View style={styles.specDivider} />

                    <View style={styles.specFullRow}>
                      <Text style={styles.specLabel}>TÀI XẾ PHỤ TRÁCH</Text>
                      <Text style={styles.specValueBold}>{driverResource.driverName || 'Chưa gán tài xế'}</Text>
                    </View>

                    <View style={styles.specDivider} />

                    <View style={styles.specFullRow}>
                      <Text style={styles.specLabel}>CẬP NHẬT LẦN CUỐI</Text>
                      <Text style={styles.specValueNormal}>
                        {driverResource.updatedAt && !Number.isNaN(new Date(driverResource.updatedAt).getTime())
                          ? new Date(driverResource.updatedAt).toLocaleString('vi-VN')
                          : 'Chưa có dữ liệu thời gian'}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.noDataBox}>
                    <Text style={styles.noDataText}>Chưa có dữ liệu từ hệ thống máy chủ</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}

          {/* TAB 4: CURRENT SESSION GPS SYNC LOGS */}
          {activeTab === 'logs' && (
            <View style={{ flex: 1 }}>
              <View style={styles.logsSessionNotice}>
                <Ionicons name="information-circle-outline" size={14} color="#94A3B8" />
                <Text style={styles.logsSessionNoticeText}>
                  Nhật ký đồng bộ phiên hiện tại (Lưu cục bộ, không phải lịch sử máy chủ)
                </Text>
              </View>
              <FlatList
                data={gpsLogs}
                keyExtractor={(item, index) => (item?.id ? item.id : `log-key-${index}`)}
                contentContainerStyle={styles.logsListContent}
                renderItem={({ item }) => (
                  <View style={styles.logCard}>
                    <View style={styles.logHeaderRow}>
                      <View style={styles.logTimeTag}>
                        <Ionicons name="time-outline" size={11} color="#94A3B8" />
                        <Text style={styles.logTimeText}>{item.time}</Text>
                      </View>
                      <View style={[styles.logSourceBadge, { backgroundColor: item.source === 'MANUAL' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(16, 185, 129, 0.15)' }]}>
                        <Text style={[styles.logSourceText, { color: item.source === 'MANUAL' ? '#38BDF8' : '#34D399' }]}>
                          {item.source}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.logCoordsText}>{item.coords}</Text>
                    <Text style={styles.logStatusText}>{item.status}</Text>
                  </View>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <MaterialCommunityIcons name="satellite-uplink" size={40} color="#334155" />
                    <Text style={styles.emptySubtitle}>Chưa có lượt đồng bộ nào trong phiên này.</Text>
                  </View>
                }
              />
            </View>
          )}

          {/* MODAL: MISSION DETAIL (GET /dispatch-missions/me/{missionId}) */}
          <Modal
            visible={showDetailModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowDetailModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>CHI TIẾT NHIỆM VỤ</Text>
                    <Text style={styles.modalSubtitle}>Nhiệm vụ #{selectedDetailMission?.id} • Yêu cầu #{selectedDetailMission?.requestId}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setShowDetailModal(false)}
                  >
                    <Ionicons name="close" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>

                {loadingDetail ? (
                  <View style={styles.modalLoadingBox}>
                    <ActivityIndicator size="large" color="#10B981" />
                    <Text style={styles.modalLoadingText}>Đang tải dữ liệu từ máy chủ...</Text>
                  </View>
                ) : (
                  <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
                    {/* Status Badge */}
                    <View style={[styles.modalStatusBanner, getMissionStatusBadgeStyle(selectedDetailMission?.status)]}>
                      <Text style={styles.modalStatusText}>{getMissionStatusText(selectedDetailMission?.status)}</Text>
                    </View>

                    {/* Destination Card */}
                    <View style={styles.modalSectionCard}>
                      <Text style={styles.modalSectionTitle}>ĐIỂM ĐẾN / YÊU CẦU</Text>
                      <View style={styles.modalInfoRow}>
                        <Text style={styles.modalInfoLabel}>Điểm đến:</Text>
                        <Text style={styles.modalInfoVal}>{selectedDetailMission?.destinationName || 'Chưa xác định'}</Text>
                      </View>
                      {selectedDetailMission?.notes ? (
                        <View style={styles.modalInfoRow}>
                          <Text style={styles.modalInfoLabel}>Ghi chú:</Text>
                          <Text style={[styles.modalInfoVal, { color: '#F59E0B' }]}>{selectedDetailMission.notes}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Timeline */}
                    <View style={styles.modalSectionCard}>
                      <Text style={styles.modalSectionTitle}>TIẾN TRÌNH THỜI GIAN (BACKEND DTO)</Text>
                      <TimelineRow label="Điều phối (Dispatched):" time={selectedDetailMission?.dispatchedAt} />
                      <TimelineRow label="Chấp nhận (Accepted):" time={selectedDetailMission?.acceptedAt} />
                      <TimelineRow label="Đang di chuyển (En Route):" time={selectedDetailMission?.enRouteAt} />
                      <TimelineRow label="Đến hiện trường (Arrived Scene):" time={selectedDetailMission?.arrivedSceneAt} />
                      <TimelineRow label="Vận chuyển (Start Transport):" time={selectedDetailMission?.startTransportAt} />
                      <TimelineRow label="Đến bệnh viện (Arrived Hospital):" time={selectedDetailMission?.arrivedHospitalAt} />
                      <TimelineRow label="Hoàn thành (Completed):" time={selectedDetailMission?.completedAt} />
                      {selectedDetailMission?.cancelledAt ? (
                        <TimelineRow label="Đã hủy (Cancelled):" time={selectedDetailMission?.cancelledAt} />
                      ) : null}
                    </View>
                  </ScrollView>
                )}
              </View>
            </View>
          </Modal>

          {/* INCOMING MISSION POPUP MODAL (POST /accept & POST /reject) */}
          <Animated.View style={[styles.incomingOrderSheet, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.incomingHeader}>
              <View style={styles.emergencyBadge}>
                <MaterialCommunityIcons name="alarm-light" size={16} color="#FFF" />
                <Text style={styles.emergencyBadgeText}>NHIỆM VỤ ĐIỀU PHỐI MỚI (DISPATCHED)</Text>
              </View>
              <Text style={styles.incomingId}>#{activeMission?.id}</Text>
            </View>

            <View style={styles.patientBox}>
              <Text style={styles.incomingVictimName}>Yêu cầu điều phối #{activeMission?.requestId}</Text>
              <Text style={styles.incomingAddress}>
                <Ionicons name="location-sharp" size={14} color="#EF4444" />{' '}
                {activeMission?.destinationName || 'Chưa xác định điểm đến'}
              </Text>
              {activeMission?.notes ? (
                <Text style={styles.incomingInjury}>
                  <MaterialCommunityIcons name="clipboard-text-outline" size={14} color="#F59E0B" />{' '}
                  {activeMission.notes}
                </Text>
              ) : null}
            </View>

            {/* Action Buttons */}
            <View style={styles.sheetBtnRow}>
              <TouchableOpacity
                style={styles.declineBtn}
                onPress={handleDeclineOrder}
                activeOpacity={0.8}
              >
                <Text style={styles.declineBtnText}>TỪ CHỐI (POST /reject)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={handleAcceptOrder}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  style={styles.acceptBtnGradient}
                >
                  <FontAwesome5 name="ambulance" size={16} color="#022C22" style={{ marginRight: 8 }} />
                  <Text style={styles.acceptBtnText}>CHẤP NHẬN (POST /accept)</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>

        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const TimelineRow = ({ label, time }: { label: string; time?: string | null }) => (
  <View style={styles.timelineRow}>
    <Text style={styles.timelineLabel}>{label}</Text>
    <Text style={[styles.timelineTime, !time && { color: '#64748B' }]}>
      {time && !Number.isNaN(new Date(time).getTime())
        ? new Date(time).toLocaleTimeString('vi-VN')
        : '---'}
    </Text>
  </View>
);

const getMissionStatusBadgeStyle = (status?: string) => {
  switch ((status || '').toUpperCase()) {
    case 'DISPATCHED':
      return { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)' };
    case 'ACCEPTED':
    case 'EN_ROUTE':
      return { backgroundColor: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.3)' };
    case 'ARRIVED_SCENE':
    case 'TRANSPORTING':
      return { backgroundColor: 'rgba(167, 139, 250, 0.15)', borderColor: 'rgba(167, 139, 250, 0.3)' };
    case 'ARRIVED_HOSPITAL':
    case 'COMPLETED':
      return { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' };
    case 'REJECTED':
    case 'CANCELLED':
    case 'FAILED':
    case 'TIMEOUT':
      return { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' };
    default:
      return { backgroundColor: 'rgba(148, 163, 184, 0.15)', borderColor: 'rgba(148, 163, 184, 0.3)' };
  }
};

const getMissionStatusText = (status?: string) => {
  switch ((status || '').toUpperCase()) {
    case 'CREATED':
      return 'MỚI TẠO';
    case 'DISPATCHED':
      return 'ĐÃ ĐIỀU PHỐI (CHỜ NHẬN)';
    case 'ACCEPTED':
      return 'ĐÃ CHẤP NHẬN';
    case 'EN_ROUTE':
      return 'ĐANG DI CHUYỂN';
    case 'ARRIVED_SCENE':
      return 'ĐÃ ĐẾN HIỆN TRƯỜNG';
    case 'TRANSPORTING':
      return 'ĐANG VẬN CHUYỂN';
    case 'ARRIVED_HOSPITAL':
      return 'ĐÃ ĐẾN BỆNH VIỆN';
    case 'COMPLETED':
      return 'HOÀN THÀNH';
    case 'REJECTED':
      return 'ĐÃ TỪ CHỐI';
    case 'CANCELLED':
      return 'ĐÃ HỦY';
    case 'FAILED':
      return 'THẤT BẠI';
    case 'TIMEOUT':
      return 'HẾT THỜI GIAN';
    default:
      return status || 'ĐANG XỬ LÝ';
  }
};

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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 36 : 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerLeft: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  unitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  unitText: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '800',
  },
  plateBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  plateText: {
    fontSize: 10,
    fontWeight: '800',
  },
  welcomeText: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '900',
  },
  providerText: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  runningMissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 68, 68, 0.3)',
  },
  runningBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pulseDotRed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  runningBannerTitle: {
    color: '#F87171',
    fontSize: 10,
    fontWeight: '900',
  },
  runningBannerSubtitle: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  runningBannerBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  runningBannerBtnText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    gap: 6,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  tabItemActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  tabText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#34D399',
    fontWeight: '900',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  statusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  statusIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusValue: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  statusNote: {
    color: '#64748B',
    fontSize: 8,
    marginTop: 2,
  },
  resourceSummaryCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  resourceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resourceIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  resourceTitleBlock: {
    flex: 1,
  },
  resourceVehicleType: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  resourceSubInfo: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveTagText: {
    fontSize: 8,
    fontWeight: '800',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 8,
    borderRadius: 8,
  },
  errorText: {
    color: '#F87171',
    fontSize: 10,
    fontWeight: '600',
  },
  gpsSyncPanel: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  gpsPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  gpsPanelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  gpsPanelTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '900',
  },
  gpsPanelSubTitle: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '600',
  },
  syncNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  syncNowBtnActive: {
    opacity: 0.6,
  },
  syncNowText: {
    color: '#022C22',
    fontSize: 10,
    fontWeight: '900',
  },
  coordsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  coordBox: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  coordLabel: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '800',
  },
  coordValue: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  coordsSubGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  subCoordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subCoordText: {
    color: '#94A3B8',
    fontSize: 10,
  },
  autoSyncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  autoSyncInfo: {
    flex: 1,
    marginRight: 10,
  },
  autoSyncTitle: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
  },
  autoSyncDesc: {
    color: '#64748B',
    fontSize: 9,
    marginTop: 2,
  },
  mapPreviewCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  mapPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  mapPreviewTitle: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 6,
    flex: 1,
  },
  mapFrame: {
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  mapOverlayPill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  mapOverlayText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '700',
  },
  devSection: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    padding: 12,
    borderRadius: 14,
    gap: 8,
  },
  devSectionTitle: {
    color: '#F87171',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  simulateOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: 10,
    borderRadius: 10,
  },
  simulateOrderText: {
    color: '#F87171',
    fontSize: 10,
    fontWeight: '900',
  },
  quickActionsContainer: {
    flexDirection: 'row',
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: '900',
  },
  // Tab 2: Missions List Styles
  missionsListContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  missionCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  missionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  missionIdTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  missionIdTagText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
  },
  missionStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  missionStatusBadgeText: {
    color: '#F8FAFC',
    fontSize: 9,
    fontWeight: '900',
  },
  missionReqIdText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  missionAddress: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  missionInjuryText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  missionMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  missionMetaItem: {
    color: '#94A3B8',
    fontSize: 10,
  },
  missionCardActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
  },
  viewDetailMissionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  viewDetailMissionBtnText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
  },
  resumeMissionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingVertical: 8,
    borderRadius: 8,
  },
  resumeMissionBtnText: {
    color: '#022C22',
    fontSize: 10,
    fontWeight: '900',
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
    paddingHorizontal: 20,
    lineHeight: 16,
  },
  // Tab 3: Vehicle Specs Styles
  specCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  specHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  specSectionTitle: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  specGrid: {
    gap: 10,
  },
  specHalfRow: {
    flexDirection: 'row',
    gap: 12,
  },
  specBlock: {
    flex: 1,
    gap: 4,
  },
  specFullRow: {
    gap: 4,
  },
  specDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 2,
  },
  specLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  specValueBold: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  specValueNormal: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16,
  },
  specValueHighlight: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '900',
  },
  noDataBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noDataText: {
    color: '#64748B',
    fontSize: 11,
  },
  // Tab 4: Logs Styles
  logsSessionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  logsSessionNoticeText: {
    color: '#94A3B8',
    fontSize: 10,
  },
  logsListContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 8,
  },
  logCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.35)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  logHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logTimeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logTimeText: {
    color: '#94A3B8',
    fontSize: 10,
  },
  logSourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  logSourceText: {
    fontSize: 8,
    fontWeight: '900',
  },
  logCoordsText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '800',
  },
  logStatusText: {
    color: '#64748B',
    fontSize: 9,
    marginTop: 2,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoadingBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  modalLoadingText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  modalScrollView: {
    gap: 12,
  },
  modalStatusBanner: {
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  modalStatusText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '900',
  },
  modalSectionCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalSectionTitle: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 8,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  modalInfoLabel: {
    color: '#94A3B8',
    fontSize: 11,
  },
  modalInfoVal: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
    maxWidth: '65%',
    textAlign: 'right',
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  timelineLabel: {
    color: '#94A3B8',
    fontSize: 10,
  },
  timelineTime: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '700',
  },
  // Incoming Sheet Styles
  incomingOrderSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0B0F19',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    elevation: 24,
    zIndex: 999,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  incomingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  emergencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  emergencyBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
  },
  incomingId: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
  },
  patientBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  incomingVictimName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  incomingAddress: {
    color: '#CBD5E1',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 4,
  },
  incomingInjury: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '600',
  },
  sheetBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  declineBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  declineBtnText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '900',
  },
  acceptBtn: {
    flex: 1.5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  acceptBtnGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
  },
  acceptBtnText: {
    color: '#022C22',
    fontSize: 11,
    fontWeight: '900',
  },
});
