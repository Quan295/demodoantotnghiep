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
import * as Location from 'expo-location';
import { api } from '@/services/api';
import { globalConfig } from '@/services/config';
import { DispatchMission, DriverResource, LatLng, getResourceLicensePlate } from '@/types';
import AmbulanceMap from '@/components/AmbulanceMap';

const { width, height } = Dimensions.get('window');

interface LocationSyncLog {
  id: string;
  time: string;
  coords: string;
  speed: number;
  status: string;
  source: 'AUTO_GPS' | 'MANUAL' | 'SIMULATION';
}

export default function DriverDashboard() {
  const router = useRouter();

  // Tab State: 'overview' | 'missions' | 'vehicle' | 'logs'
  const [activeTab, setActiveTab] = useState<'overview' | 'missions' | 'vehicle' | 'logs'>('overview');

  // Resource State from API (GET /driver-resource)
  const [driverResource, setDriverResource] = useState<DriverResource | null>(null);
  const [loadingResource, setLoadingResource] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Status & GPS State
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true);
  const [syncingLocation, setSyncingLocation] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Chưa đồng bộ');

  // Mission State (DRIVER - Mission API)
  const [activeRunningMission, setActiveRunningMission] = useState<DispatchMission | null>(null);
  const [missionsList, setMissionsList] = useState<DispatchMission[]>([]);
  const [selectedDetailMission, setSelectedDetailMission] = useState<DispatchMission | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Current Coordinates
  const [currentCoords, setCurrentCoords] = useState<{
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    accuracy: number;
  }>({
    latitude: 21.0091,
    longitude: 105.8247,
    speed: 0,
    heading: 90,
    accuracy: 5,
  });

  // GPS Logs List
  const [gpsLogs, setGpsLogs] = useState<LocationSyncLog[]>([
    {
      id: 'init-1',
      time: new Date().toLocaleTimeString('vi-VN'),
      coords: '21.009100° N, 105.824700° E',
      speed: 0,
      status: '200 OK (PostGIS Point Updated)',
      source: 'AUTO_GPS',
    },
  ]);

  // Incoming Mission Alert State
  const [showIncomingOrder, setShowIncomingOrder] = useState<boolean>(false);
  const [activeMission, setActiveMission] = useState<any>(null);

  // Animations
  const flashAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  const radarScale = useRef(new Animated.Value(1)).current;
  const pulseSyncAnim = useRef(new Animated.Value(1)).current;

  // Auto-sync Interval Ref
  const autoSyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSyncEnabledRef = useRef(autoSyncEnabled);
  const isAvailableRef = useRef(isAvailable);
  const currentCoordsRef = useRef(currentCoords);

  useEffect(() => { autoSyncEnabledRef.current = autoSyncEnabled; }, [autoSyncEnabled]);
  useEffect(() => { isAvailableRef.current = isAvailable; }, [isAvailable]);
  useEffect(() => { currentCoordsRef.current = currentCoords; }, [currentCoords]);

  // 1. Fetch Driver Resource via GET /driver-resource
  const fetchDriverResource = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoadingResource(true);

      const resource = await api.getDriverResource();
      console.log('[DriverDashboard] Fetched Driver Resource:', resource);
      if (resource) {
        setDriverResource(resource);
        if (resource.latitude && resource.longitude) {
          setCurrentCoords(prev => ({
            ...prev,
            latitude: Number(resource.latitude),
            longitude: Number(resource.longitude),
            speed: resource.speed || 0,
            heading: resource.heading || 0,
          }));
        }
        const statusUpper = (resource.status || '').toUpperCase();
        setIsAvailable(statusUpper === 'AVAILABLE' || statusUpper === 'SẴN SÀNG');
      }
    } catch (err: any) {
      console.error('[DriverDashboard] Error fetching driver resource:', err?.message || err);
      setDriverResource(prev => prev || {
        id: '1042',
        licensePlate: '29A-115.88',
        license_plate: '29A-115.88',
        vehicleNumber: 'AMB-042',
        type: 'AMBULANCE',
        vehicleType: 'Xe Cấp Cứu Hồi Sức Tích Cực (ICU Ambulance)',
        status: 'AVAILABLE',
        providerName: 'Bệnh viện Cấp Cứu 115 - Chi nhánh Đống Đa',
        driverName: 'Bác sĩ / Tài xế Hùng',
        driverPhone: '0988.115.115',
        latitude: 21.0091,
        longitude: 105.8247,
        speed: 0,
        heading: 90,
        fuelLevel: 88,
        batteryLevel: 96,
        odometer: 14250,
        equipment: [
          'Máy sốc tim ngoài lồng ngực tự động (AED)',
          'Bình Oxy y tế 10L kèm đồng hồ đo lưu lượng',
          'Máy thở mini di động chuyên dụng cấp cứu',
          'Bộ nẹp cố định cột sống & cổ đa năng',
          'Cáng / Băng ca cứu thương thủy lực gấp gọn',
          'Bộ sơ cấp cứu & dịch truyền tĩnh mạch',
        ],
        extended_attributes: {
          license_plate: '29A-115.88',
          vehicle_type: 'Xe Cấp Cứu Hồi Sức Tích Cực (ICU Ambulance)',
          hospital_name: 'Bệnh viện Cấp Cứu 115',
        },
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setLoadingResource(false);
      setRefreshing(false);
    }
  }, []);

  // 2. Fetch Active Missions (GET /dispatch-missions/me/active)
  const fetchActiveMissions = useCallback(async () => {
    try {
      const activeList = await api.getMyActiveMissions();
      if (Array.isArray(activeList) && activeList.length > 0) {
        const assignedOrder = activeList.find(m => m.status === 'ASSIGNED' || m.status === 'PENDING');
        const runningOrder = activeList.find(m =>
          m.status === 'ACCEPTED' ||
          m.status === 'STARTED' ||
          m.status === 'EN_ROUTE_TO_SCENE' ||
          m.status === 'ARRIVED_SCENE' ||
          m.status === 'START_TRANSPORT' ||
          m.status === 'TRANSPORTING' ||
          m.status === 'ARRIVED_HOSPITAL'
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

  // 5. Location Update Handler via PATCH /driver-resource/location (ownership-safe)
  const sendLocationUpdate = useCallback(async (
    lat: number,
    lng: number,
    speed = 0,
    heading = 0,
    accuracy = 5,
    source: 'AUTO_GPS' | 'MANUAL' | 'SIMULATION' = 'AUTO_GPS'
  ) => {
    try {
      setSyncingLocation(true);

      const payload = {
        latitude: lat,
        longitude: lng,
        speed,
        heading,
        accuracy,
      };

      console.log('[DriverDashboard] Calling PATCH /driver-resource/location:', payload);
      await api.updateDriverResourceLocation(payload);

      const nowStr = new Date().toLocaleTimeString('vi-VN');
      setLastSyncTime(nowStr);

      const newLog: LocationSyncLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        time: nowStr,
        coords: `${lat.toFixed(6)}° N, ${lng.toFixed(6)}° E`,
        speed,
        status: '200 OK (PostGIS Point Updated)',
        source,
      };

      setGpsLogs(prev => [newLog, ...prev.slice(0, 24)]);
      return true;
    } catch (e: any) {
      console.warn('[DriverDashboard] PATCH location failed:', e.message);
      const nowStr = new Date().toLocaleTimeString('vi-VN');
      const errLog: LocationSyncLog = {
        id: `log-err-${Date.now()}`,
        time: nowStr,
        coords: `${lat.toFixed(6)}° N, ${lng.toFixed(6)}° E`,
        speed,
        status: `Lỗi: ${e.message || 'Network error'}`,
        source,
      };
      setGpsLogs(prev => [errLog, ...prev.slice(0, 24)]);
      return false;
    } finally {
      setSyncingLocation(false);
    }
  }, []);

  // 6. Manual Sync Location Button Handler
  const handleManualSyncLocation = async () => {
    try {
      setSyncingLocation(true);
      let lat = currentCoords.latitude;
      let lng = currentCoords.longitude;
      let speed = currentCoords.speed;
      let heading = currentCoords.heading;
      let accuracy = currentCoords.accuracy;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
          speed = loc.coords.speed || 0;
          heading = loc.coords.heading || 0;
          accuracy = loc.coords.accuracy || 5;
          setCurrentCoords({ latitude: lat, longitude: lng, speed, heading, accuracy });
        }
      } catch (locErr) {
        console.log('[DriverDashboard] Device GPS not available, using existing coordinates', locErr);
      }

      const success = await sendLocationUpdate(lat, lng, speed, heading, accuracy, 'MANUAL');
      if (success) {
        Alert.alert(
          'Đã Cập Nhật Vị Trí',
          `Vị trí xe cứu thương đã được đồng bộ lên máy chủ thành công!\n\nTọa độ: ${lat.toFixed(6)}, ${lng.toFixed(6)}\nThời gian: ${new Date().toLocaleTimeString('vi-VN')}`
        );
      }
    } catch (e: any) {
      Alert.alert('Lỗi', 'Không thể cập nhật vị trí xe cứu thương: ' + e.message);
    } finally {
      setSyncingLocation(false);
    }
  };

  // 7. Toggle Driver/Vehicle Status (Available / Busy / Offline)
  const handleToggleStatus = async (val: boolean) => {
    setIsAvailable(val);
    const newStatus = val ? 'AVAILABLE' : 'OFFLINE';

    try {
      await api.updateDriverResourceStatus(newStatus);
      setDriverResource(prev => (prev ? { ...prev, status: newStatus } : null));
    } catch (e) {
      console.warn('[DriverDashboard] Failed to update resource status:', e);
    }
  };

  // 8. Initial Load (Runs ONCE on screen mount)
  useEffect(() => {
    fetchDriverResource();
    fetchActiveMissions();
    fetchMissionsHistory();

    // Check device location once on launch
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (loc?.coords) {
            setCurrentCoords({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              speed: loc.coords.speed || 0,
              heading: loc.coords.heading || 0,
              accuracy: loc.coords.accuracy || 5,
            });
            sendLocationUpdate(
              loc.coords.latitude,
              loc.coords.longitude,
              loc.coords.speed || 0,
              loc.coords.heading || 0,
              loc.coords.accuracy || 5,
              'AUTO_GPS'
            );
          }
        }
      } catch (err) {
        console.log('[DriverDashboard] Initial GPS check skipped', err);
      }
    })();
  }, [fetchActiveMissions, fetchDriverResource, fetchMissionsHistory, sendLocationUpdate]);

  // 9. Auto-sync Interval with proper cleanup
  useEffect(() => {
    if (autoSyncIntervalRef.current) {
      clearInterval(autoSyncIntervalRef.current);
      autoSyncIntervalRef.current = null;
    }

    if (autoSyncEnabled && isAvailable) {
      autoSyncIntervalRef.current = setInterval(async () => {
        if (!autoSyncEnabledRef.current || !isAvailableRef.current) return;
        try {
          let lat = currentCoordsRef.current.latitude;
          let lng = currentCoordsRef.current.longitude;
          let spd = currentCoordsRef.current.speed;
          let hdg = currentCoordsRef.current.heading;
          let acc = currentCoordsRef.current.accuracy;

          try {
            const loc = await Location.getLastKnownPositionAsync();
            if (loc?.coords) {
              lat = loc.coords.latitude;
              lng = loc.coords.longitude;
              spd = loc.coords.speed || 0;
              hdg = loc.coords.heading || 0;
              acc = loc.coords.accuracy || 5;
              setCurrentCoords({ latitude: lat, longitude: lng, speed: spd, heading: hdg, accuracy: acc });
            }
          } catch {}

          sendLocationUpdate(lat, lng, spd, hdg, acc, 'AUTO_GPS');
        } catch (e) {
          console.warn('[DriverDashboard] Auto sync interval error:', e);
        }
      }, 15000);
    }

    return () => {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
        autoSyncIntervalRef.current = null;
      }
    };
  }, [autoSyncEnabled, isAvailable, sendLocationUpdate]);

  // 10. Incoming Mission Overlay Animation
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

  // Trigger demo incoming emergency order
  const handleSimulateIncomingOrder = () => {
    const mission: DispatchMission = {
      id: `DM-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'ASSIGNED',
      priority: 'HIGH',
      victimName: 'Nguyễn Văn Nam (48 tuổi)',
      victimPhone: '0987.654.321',
      victimAddress: '12 Chùa Bộc, P. Quang Trung, Q. Đống Đa, Hà Nội',
      pickupAddress: '12 Chùa Bộc, P. Quang Trung, Q. Đống Đa, Hà Nội',
      latitude: 21.0091,
      longitude: 105.8247,
      injury: 'Tai nạn giao thông - Đa chấn thương cẳng chân, cần nẹp cố định',
      distanceKm: 1.2,
      estimatedEtaMin: 4,
      createdAt: new Date().toISOString(),
    };
    setActiveMission(mission);
    setShowIncomingOrder(true);
  };

  // POST /dispatch-missions/{id}/accept
  const handleAcceptOrder = async () => {
    setShowIncomingOrder(false);
    const missionId = activeMission?.id || `mission_${Date.now()}`;
    try {
      console.log('[DriverDashboard] Calling POST /dispatch-missions/{id}/accept:', missionId);
      await api.acceptMission(missionId);
    } catch (e) {
      console.warn('[DriverDashboard] acceptMission error:', e);
    }

    router.push({
      pathname: '/(driver)/navigation',
      params: {
        victimLat: activeMission?.victimLat || activeMission?.latitude?.toString() || '21.0091',
        victimLng: activeMission?.victimLng || activeMission?.longitude?.toString() || '105.8247',
        victimName: activeMission?.victimName || activeMission?.patientName || 'Nguyễn Văn Nam',
        victimAddress: activeMission?.victimAddress || activeMission?.pickupAddress || '12 Chùa Bộc, Đống Đa, Hà Nội',
        missionId: String(missionId),
        dispatchMissionId: String(missionId),
        victimPhone: activeMission?.victimPhone || activeMission?.patientPhone || '0987.654.321',
        victimInjury: activeMission?.victimInjury || activeMission?.injury || activeMission?.description || 'Tai nạn giao thông - Chấn thương chân',
      },
    });
  };

  // POST /dispatch-missions/{id}/reject
  const handleDeclineOrder = async () => {
    setShowIncomingOrder(false);
    if (activeMission?.id) {
      try {
        console.log('[DriverDashboard] Calling POST /dispatch-missions/{id}/reject:', activeMission.id);
        await api.rejectMission(activeMission.id, 'Tài xế bận ca trực khác');
      } catch (e) {
        console.warn('[DriverDashboard] rejectMission error:', e);
      }
    }
    Alert.alert('Đã Từ Chối Ca', 'Yêu cầu cứu trợ đã được chuyển tiếp tới trung tâm điều phối 115.');
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
      Alert.alert('Thông báo', 'Tổng đài điều phối 115: 115 hoặc 1900 1155');
    });
  };

  const currentUser = globalConfig.getCurrentUser();
  const driverName = driverResource?.driverName || currentUser?.name || 'Bác sĩ / Tài xế Hùng';
  const unitBadge = driverResource?.vehicleNumber || (driverResource?.id ? `UNIT: #${driverResource.id}` : 'UNIT: AMB-042');
  const licensePlate = getResourceLicensePlate(driverResource);

  const extAttrs = driverResource?.extended_attributes || driverResource?.extendedAttributes;
  let extObj: any = {};
  if (typeof extAttrs === 'string') {
    try { extObj = JSON.parse(extAttrs); } catch {}
  } else if (typeof extAttrs === 'object' && extAttrs) {
    extObj = extAttrs;
  }

  const providerTitle = driverResource?.providerName || extObj.hospital || 'Bệnh viện Cấp cứu 115 - Chi nhánh Đống Đa';
  const vehicleTypeStr =
    extObj.vehicle_type ||
    extObj.vehicleType ||
    driverResource?.vehicleType ||
    driverResource?.type ||
    'Xe Cấp Cứu Hồi Sức Tích Cực (ICU Ambulance)';

  const equipmentList: string[] = Array.isArray(driverResource?.equipment)
    ? driverResource.equipment
    : typeof driverResource?.equipment === 'string'
    ? driverResource.equipment.split(',').map((s: string) => s.trim())
    : [
        'Máy sốc tim ngoài lồng ngực tự động (AED)',
        'Bình Oxy y tế 10L kèm đồng hồ đo lưu lượng',
        'Máy thở mini di động chuyên dụng cấp cứu',
        'Bộ nẹp cố định cột sống & cổ đa năng',
        'Cáng / Băng ca cứu thương thủy lực gấp gọn',
        'Bộ sơ cấp cứu & dịch truyền tĩnh mạch',
      ];

  const mapAmbulanceLocation: LatLng = {
    lat: currentCoords.latitude,
    lng: currentCoords.longitude,
  };
  const mapDummyVictim: LatLng = {
    lat: currentCoords.latitude + 0.006,
    lng: currentCoords.longitude + 0.005,
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
                <Ionicons name="business-outline" size={11} color="#94A3B8" /> {providerTitle}
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
                router.push({
                  pathname: '/(driver)/navigation',
                  params: {
                    missionId: String(activeRunningMission.id),
                    dispatchMissionId: String(activeRunningMission.id),
                    victimName: activeRunningMission.victimName || activeRunningMission.patientName,
                    victimPhone: activeRunningMission.victimPhone || activeRunningMission.patientPhone,
                    victimAddress: activeRunningMission.victimAddress || activeRunningMission.pickupAddress,
                    victimInjury: activeRunningMission.injury || activeRunningMission.description,
                  },
                });
              }}
              activeOpacity={0.85}
            >
              <View style={styles.runningBannerLeft}>
                <View style={styles.pulseDotRed} />
                <View>
                  <Text style={styles.runningBannerTitle}>
                    CA CẤP CỨU ĐANG THỰC HIỆN (#{activeRunningMission.id})
                  </Text>
                  <Text style={styles.runningBannerSubtitle} numberOfLines={1}>
                    {activeRunningMission.victimName || 'Nạn nhân'} • {activeRunningMission.pickupAddress || 'Đang vận chuyển'}
                  </Text>
                </View>
              </View>
              <View style={styles.runningBannerBtn}>
                <Text style={styles.runningBannerBtnText}>TIẾP TỤC ĐIỀU HƯỚNG ➔</Text>
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
                Nhật Ký GPS
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
              {/* STATUS TOGGLE CARD */}
              <TouchableOpacity
                style={[
                  styles.statusCard,
                  { borderColor: isAvailable ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.3)' },
                ]}
                activeOpacity={0.9}
                onPress={() => handleToggleStatus(!isAvailable)}
              >
                <View style={styles.statusLeft}>
                  <View style={[styles.statusIconBox, { backgroundColor: isAvailable ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' }]}>
                    <MaterialCommunityIcons
                      name={isAvailable ? 'radiobox-marked' : 'radiobox-blank'}
                      size={22}
                      color={isAvailable ? '#10B981' : '#EF4444'}
                    />
                  </View>
                  <View>
                    <Text style={styles.statusLabel}>TRẠNG THÁI CA TRỰC TÀI XẾ</Text>
                    <Text style={[styles.statusValue, { color: isAvailable ? '#34D399' : '#F87171' }]}>
                      {isAvailable ? 'SẴN SÀNG NHẬN NHIỆM VỤ' : 'TẠM NGHỈ / KHÔNG HOẠT ĐỘNG'}
                    </Text>
                  </View>
                </View>

                <Switch
                  value={isAvailable}
                  onValueChange={handleToggleStatus}
                  trackColor={{ false: '#334155', true: '#059669' }}
                  thumbColor={isAvailable ? '#34D399' : '#94A3B8'}
                />
              </TouchableOpacity>

              {/* API RESOURCE SUMMARY CARD */}
              <View style={styles.resourceSummaryCard}>
                <View style={styles.resourceHeaderRow}>
                  <View style={styles.resourceIconCircle}>
                    <FontAwesome5 name="ambulance" size={18} color="#10B981" />
                  </View>
                  <View style={styles.resourceTitleBlock}>
                    <Text style={styles.resourceVehicleType}>{vehicleTypeStr}</Text>
                    <Text style={styles.resourceSubInfo}>
                      Mã xe: #{driverResource?.id || '1042'} • Biển: {licensePlate}
                    </Text>
                  </View>
                  <View style={styles.liveTag}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveTagText}>API CONNECTED</Text>
                  </View>
                </View>

                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <MaterialCommunityIcons name="gas-station" size={16} color="#F59E0B" />
                    <Text style={styles.metricValue}>{driverResource?.fuelLevel ?? 88}%</Text>
                    <Text style={styles.metricLabel}>Nhiên liệu</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricItem}>
                    <MaterialCommunityIcons name="battery-charging-90" size={16} color="#10B981" />
                    <Text style={styles.metricValue}>{driverResource?.batteryLevel ?? 96}%</Text>
                    <Text style={styles.metricLabel}>Ắc quy ICU</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricItem}>
                    <MaterialCommunityIcons name="speedometer" size={16} color="#38BDF8" />
                    <Text style={styles.metricValue}>
                      {(driverResource?.odometer ?? 14250).toLocaleString()} km
                    </Text>
                    <Text style={styles.metricLabel}>Odometer</Text>
                  </View>
                </View>
              </View>

              {/* GPS POSTGIS SYNCHRONIZATION CONTROL */}
              <View style={styles.gpsSyncPanel}>
                <View style={styles.gpsPanelHeader}>
                  <View style={styles.gpsPanelTitleRow}>
                    <Animated.View style={{ transform: [{ scale: pulseSyncAnim }] }}>
                      <MaterialCommunityIcons name="satellite-uplink" size={20} color="#10B981" />
                    </Animated.View>
                    <View>
                      <Text style={styles.gpsPanelTitle}>GPS & POSTGIS LIVE TRACKER</Text>
                      <Text style={styles.gpsPanelSubTitle}>
                        API: PATCH /driver-resource/location
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.syncNowBtn, syncingLocation && styles.syncNowBtnActive]}
                    onPress={handleManualSyncLocation}
                    disabled={syncingLocation}
                    activeOpacity={0.8}
                  >
                    {syncingLocation ? (
                      <ActivityIndicator size="small" color="#022C22" />
                    ) : (
                      <>
                        <Feather name="upload-cloud" size={14} color="#022C22" />
                        <Text style={styles.syncNowText}>CẬP NHẬT NGAY</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Coordinates Grid */}
                <View style={styles.coordsGrid}>
                  <View style={styles.coordBox}>
                    <Text style={styles.coordLabel}>VĨ ĐỘ (LATITUDE)</Text>
                    <Text style={styles.coordValue}>{currentCoords.latitude.toFixed(6)}° N</Text>
                  </View>
                  <View style={styles.coordBox}>
                    <Text style={styles.coordLabel}>KINH ĐỘ (LONGITUDE)</Text>
                    <Text style={styles.coordValue}>{currentCoords.longitude.toFixed(6)}° E</Text>
                  </View>
                </View>

                <View style={styles.coordsSubGrid}>
                  <View style={styles.subCoordItem}>
                    <Ionicons name="speedometer-outline" size={14} color="#94A3B8" />
                    <Text style={styles.subCoordText}>Vận tốc: {currentCoords.speed.toFixed(1)} km/h</Text>
                  </View>
                  <View style={styles.subCoordItem}>
                    <MaterialCommunityIcons name="compass-outline" size={14} color="#94A3B8" />
                    <Text style={styles.subCoordText}>Hướng: {currentCoords.heading.toFixed(0)}°</Text>
                  </View>
                  <View style={styles.subCoordItem}>
                    <Ionicons name="time-outline" size={14} color="#94A3B8" />
                    <Text style={styles.subCoordText}>Gần nhất: {lastSyncTime}</Text>
                  </View>
                </View>

                {/* Auto Sync Switch Row */}
                <View style={styles.autoSyncRow}>
                  <View style={styles.autoSyncInfo}>
                    <Text style={styles.autoSyncTitle}>Tự động đồng bộ GPS mỗi 15 giây</Text>
                    <Text style={styles.autoSyncDesc}>
                      Liên tục cập nhật tọa độ thời gian thực về điều phối viên và người dân
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
                  <Text style={styles.mapPreviewTitle}>VỊ TRÍ HIỆN TẠI TRÊN BẢN ĐỒ</Text>
                  <TouchableOpacity
                    style={styles.openNavDirectBtn}
                    onPress={() => handleSimulateIncomingOrder()}
                  >
                    <Text style={styles.openNavDirectText}>THỬ NGHIỆM ĐIỀU HƯỚNG</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.mapFrame}>
                  <AmbulanceMap
                    victimLocation={mapDummyVictim}
                    ambulanceLocation={mapAmbulanceLocation}
                  />
                  <View style={styles.mapOverlayPill}>
                    <View style={styles.pulseDot} />
                    <Text style={styles.mapOverlayText}>
                      {licensePlate} • {currentCoords.latitude.toFixed(4)}, {currentCoords.longitude.toFixed(4)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* QUICK ACTION BUTTONS */}
              <View style={styles.quickActionsContainer}>
                <TouchableOpacity
                  style={[styles.quickActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}
                  onPress={handleSimulateIncomingOrder}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="alarm-light" size={22} color="#EF4444" />
                  <Text style={[styles.quickActionText, { color: '#F87171' }]}>MÔ PHỎNG CA CẤP CỨU</Text>
                </TouchableOpacity>

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

          {/* TAB 2: MISSIONS HISTORY (GET /dispatch-missions/me) */}
          {activeTab === 'missions' && (
            <FlatList
              data={missionsList}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={styles.missionsListContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => fetchMissionsHistory()}
                  tintColor="#10B981"
                />
              }
              renderItem={({ item }) => (
                <View style={styles.missionCard}>
                  <View style={styles.missionCardHeader}>
                    <View style={styles.missionIdTag}>
                      <Text style={styles.missionIdTagText}>#{item.id}</Text>
                    </View>
                    <View style={[styles.missionStatusBadge, getMissionStatusBadgeStyle(item.status)]}>
                      <Text style={styles.missionStatusBadgeText}>{getMissionStatusText(item.status)}</Text>
                    </View>
                  </View>

                  <Text style={styles.missionVictimName}>{item.victimName || item.patientName || 'Nạn nhân'}</Text>
                  <Text style={styles.missionAddress} numberOfLines={2}>
                    <Ionicons name="location-outline" size={13} color="#94A3B8" /> {item.victimAddress || item.pickupAddress || 'Chưa có địa chỉ'}
                  </Text>

                  {item.injury ? (
                    <Text style={styles.missionInjuryText} numberOfLines={1}>
                      <MaterialCommunityIcons name="medical-bag" size={12} color="#F59E0B" /> {item.injury}
                    </Text>
                  ) : null}

                  <View style={styles.missionMetaRow}>
                    <Text style={styles.missionMetaItem}>
                      <Ionicons name="time-outline" size={12} color="#64748B" />{' '}
                      {new Date(item.createdAt).toLocaleDateString('vi-VN')} {new Date(item.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {item.distanceKm ? (
                      <Text style={[styles.missionMetaItem, { color: '#34D399', fontWeight: '800' }]}>
                        {item.distanceKm} km
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.missionCardActions}>
                    <TouchableOpacity
                      style={styles.viewDetailMissionBtn}
                      onPress={() => handleOpenMissionDetail(item)}
                    >
                      <Ionicons name="document-text-outline" size={14} color="#38BDF8" />
                      <Text style={styles.viewDetailMissionBtnText}>XEM CHI TIẾT CA</Text>
                    </TouchableOpacity>

                    {(item.status === 'ASSIGNED' || item.status === 'ACCEPTED' || item.status === 'STARTED' || item.status === 'EN_ROUTE_TO_SCENE') && (
                      <TouchableOpacity
                        style={styles.resumeMissionBtn}
                        onPress={() => {
                          router.push({
                            pathname: '/(driver)/navigation',
                            params: {
                              missionId: String(item.id),
                              dispatchMissionId: String(item.id),
                              victimName: item.victimName || item.patientName,
                              victimPhone: item.victimPhone || item.patientPhone,
                              victimAddress: item.victimAddress || item.pickupAddress,
                              victimInjury: item.injury || item.description,
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
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons name="clipboard-text-off-outline" size={48} color="#334155" />
                  <Text style={styles.emptyTitle}>Chưa có nhiệm vụ nào</Text>
                  <Text style={styles.emptySubtitle}>
                    Các ca cấp cứu được phân công sẽ xuất hiện tại đây sau khi tổng đài điều phối.
                  </Text>
                </View>
              }
            />
          )}

          {/* TAB 3: VEHICLE & MEDICAL EQUIPMENT DETAILS */}
          {activeTab === 'vehicle' && (
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              <View style={styles.specCard}>
                <Text style={styles.specSectionTitle}>CHI TIẾT XE CẤP CỨU (GET /driver-resource)</Text>

                <View style={styles.specItemRow}>
                  <Text style={styles.specLabel}>Mã định danh (Resource ID):</Text>
                  <Text style={styles.specValue}>#{driverResource?.id || '1042'}</Text>
                </View>
                <View style={styles.specItemRow}>
                  <Text style={styles.specLabel}>Biển kiểm soát:</Text>
                  <Text style={[styles.specValue, { color: '#34D399', fontWeight: '800' }]}>{licensePlate}</Text>
                </View>
                <View style={styles.specItemRow}>
                  <Text style={styles.specLabel}>Loại xe cứu thương:</Text>
                  <Text style={styles.specValue}>{vehicleTypeStr}</Text>
                </View>
                <View style={styles.specItemRow}>
                  <Text style={styles.specLabel}>Đơn vị quản lý / Bệnh viện:</Text>
                  <Text style={styles.specValue}>{providerTitle}</Text>
                </View>
                <View style={styles.specItemRow}>
                  <Text style={styles.specLabel}>Tài xế / Bác sĩ phụ trách:</Text>
                  <Text style={styles.specValue}>{driverName}</Text>
                </View>
                <View style={styles.specItemRow}>
                  <Text style={styles.specLabel}>Số điện thoại liên hệ:</Text>
                  <Text style={styles.specValue}>{driverResource?.driverPhone || '0988.115.115'}</Text>
                </View>
              </View>

              {/* Equipment Checklist */}
              <View style={styles.equipmentCard}>
                <View style={styles.equipmentHeader}>
                  <FontAwesome5 name="briefcase-medical" size={16} color="#10B981" />
                  <Text style={styles.equipmentTitle}>DANH MỤC TRANG THIẾT BỊ Y TẾ TRÊN XE</Text>
                </View>

                <View style={styles.equipmentList}>
                  {equipmentList.map((item, idx) => (
                    <View key={idx} style={styles.equipmentItem}>
                      <View style={styles.checkCircle}>
                        <Ionicons name="checkmark" size={12} color="#10B981" />
                      </View>
                      <Text style={styles.equipmentText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          )}

          {/* TAB 4: GPS SYNC LOGS */}
          {activeTab === 'logs' && (
            <FlatList
              data={gpsLogs}
              keyExtractor={item => item.id}
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
            />
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
                    <Text style={styles.modalTitle}>CHI TIẾT NHIỆM VỤ CẤP CỨU</Text>
                    <Text style={styles.modalSubtitle}>Mã ca: #{selectedDetailMission?.id}</Text>
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
                    <Text style={styles.modalLoadingText}>Đang tải dữ liệu nhiệm vụ...</Text>
                  </View>
                ) : (
                  <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
                    {/* Status Badge */}
                    <View style={[styles.modalStatusBanner, getMissionStatusBadgeStyle(selectedDetailMission?.status)]}>
                      <Text style={styles.modalStatusText}>{getMissionStatusText(selectedDetailMission?.status)}</Text>
                    </View>

                    {/* Patient Card */}
                    <View style={styles.modalSectionCard}>
                      <Text style={styles.modalSectionTitle}>THÔNG TIN NẠN NHÂN</Text>
                      <View style={styles.modalInfoRow}>
                        <Text style={styles.modalInfoLabel}>Họ tên:</Text>
                        <Text style={styles.modalInfoVal}>{selectedDetailMission?.victimName || selectedDetailMission?.patientName || 'Nạn nhân'}</Text>
                      </View>
                      <View style={styles.modalInfoRow}>
                        <Text style={styles.modalInfoLabel}>Số điện thoại:</Text>
                        <Text style={[styles.modalInfoVal, { color: '#38BDF8' }]}>{selectedDetailMission?.victimPhone || selectedDetailMission?.patientPhone || '0987.654.321'}</Text>
                      </View>
                      <View style={styles.modalInfoRow}>
                        <Text style={styles.modalInfoLabel}>Địa chỉ đón:</Text>
                        <Text style={styles.modalInfoVal}>{selectedDetailMission?.victimAddress || selectedDetailMission?.pickupAddress || 'Hà Nội'}</Text>
                      </View>
                      {selectedDetailMission?.injury ? (
                        <View style={styles.modalInfoRow}>
                          <Text style={styles.modalInfoLabel}>Tình trạng sự cố:</Text>
                          <Text style={[styles.modalInfoVal, { color: '#F59E0B' }]}>{selectedDetailMission.injury}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Hospital Card */}
                    <View style={styles.modalSectionCard}>
                      <Text style={styles.modalSectionTitle}>BỆNH VIỆN TIẾP NHẬN</Text>
                      <View style={styles.modalInfoRow}>
                        <Text style={styles.modalInfoLabel}>Bệnh viện:</Text>
                        <Text style={styles.modalInfoVal}>{selectedDetailMission?.hospitalName || 'Bệnh viện Cấp Cứu 115'}</Text>
                      </View>
                      <View style={styles.modalInfoRow}>
                        <Text style={styles.modalInfoLabel}>Địa chỉ BV:</Text>
                        <Text style={styles.modalInfoVal}>{selectedDetailMission?.hospitalAddress || 'Số 1 Chùa Bộc, Đống Đa, Hà Nội'}</Text>
                      </View>
                    </View>

                    {/* Timeline */}
                    <View style={styles.modalSectionCard}>
                      <Text style={styles.modalSectionTitle}>TIẾN TRÌNH THỜI GIAN</Text>
                      <TimelineRow label="Tiếp nhận ca:" time={selectedDetailMission?.createdAt} />
                      <TimelineRow label="Bắt đầu di chuyển:" time={selectedDetailMission?.startTime} />
                      <TimelineRow label="Đã đến hiện trường:" time={selectedDetailMission?.arrivedSceneTime} />
                      <TimelineRow label="Bắt đầu chuyển viện:" time={selectedDetailMission?.startTransportTime} />
                      <TimelineRow label="Đã đến bệnh viện:" time={selectedDetailMission?.arrivedHospitalTime} />
                      <TimelineRow label="Hoàn tất ca:" time={selectedDetailMission?.completedTime} />
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
                <Text style={styles.emergencyBadgeText}>YÊU CẦU CẤP CỨU MỚI</Text>
              </View>
              <Text style={styles.incomingId}>#{activeMission?.id || 'DM-101'}</Text>
            </View>

            <View style={styles.patientBox}>
              <Text style={styles.incomingVictimName}>{activeMission?.victimName || 'Nguyễn Văn Nam (48 tuổi)'}</Text>
              <Text style={styles.incomingAddress}>
                <Ionicons name="location-sharp" size={14} color="#EF4444" />{' '}
                {activeMission?.victimAddress || activeMission?.pickupAddress || '12 Chùa Bộc, Đống Đa, Hà Nội'}
              </Text>
              <Text style={styles.incomingInjury}>
                <MaterialCommunityIcons name="medical-bag" size={14} color="#F59E0B" />{' '}
                {activeMission?.victimInjury || activeMission?.injury || 'Chấn thương gãy chân'}
              </Text>
            </View>

            <View style={styles.incomingMetricsRow}>
              <View style={styles.incMetricBox}>
                <Text style={styles.incMetricLabel}>KHOẢNG CÁCH</Text>
                <Text style={styles.incMetricVal}>{activeMission?.distanceKm || '1.2'} km</Text>
              </View>
              <View style={styles.incMetricBox}>
                <Text style={styles.incMetricLabel}>DỰ KIẾN (ETA)</Text>
                <Text style={[styles.incMetricVal, { color: '#34D399' }]}>{activeMission?.estimatedEtaMin || '4'} phút</Text>
              </View>
              <View style={styles.incMetricBox}>
                <Text style={styles.incMetricLabel}>ĐỘ ƯU TIÊN</Text>
                <Text style={[styles.incMetricVal, { color: '#F87171' }]}>KHẨN CẤP</Text>
              </View>
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

const TimelineRow = ({ label, time }: { label: string; time?: string }) => (
  <View style={styles.timelineRow}>
    <Text style={styles.timelineLabel}>{label}</Text>
    <Text style={[styles.timelineTime, !time && { color: '#64748B' }]}>
      {time ? new Date(time).toLocaleTimeString('vi-VN') : '---'}
    </Text>
  </View>
);

const getMissionStatusBadgeStyle = (status?: string) => {
  switch ((status || '').toUpperCase()) {
    case 'ASSIGNED':
    case 'PENDING':
      return { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)' };
    case 'ACCEPTED':
    case 'STARTED':
    case 'EN_ROUTE_TO_SCENE':
      return { backgroundColor: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.3)' };
    case 'ARRIVED_SCENE':
    case 'START_TRANSPORT':
    case 'TRANSPORTING':
      return { backgroundColor: 'rgba(167, 139, 250, 0.15)', borderColor: 'rgba(167, 139, 250, 0.3)' };
    case 'ARRIVED_HOSPITAL':
    case 'COMPLETED':
      return { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' };
    case 'REJECTED':
    case 'CANCELLED':
      return { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' };
    default:
      return { backgroundColor: 'rgba(148, 163, 184, 0.15)', borderColor: 'rgba(148, 163, 184, 0.3)' };
  }
};

const getMissionStatusText = (status?: string) => {
  switch ((status || '').toUpperCase()) {
    case 'ASSIGNED':
    case 'PENDING':
      return 'ĐANG CHỜ TÀI XẾ';
    case 'ACCEPTED':
      return 'ĐÃ CHẤP NHẬN';
    case 'STARTED':
    case 'EN_ROUTE_TO_SCENE':
      return 'ĐANG ĐẾN HIỆN TRƯỜNG';
    case 'ARRIVED_SCENE':
      return 'ĐÃ ĐẾN HIỆN TRƯỜNG';
    case 'START_TRANSPORT':
    case 'TRANSPORTING':
      return 'ĐANG CHUYỂN VIỆN';
    case 'ARRIVED_HOSPITAL':
      return 'ĐÃ ĐẾN BỆNH VIỆN';
    case 'COMPLETED':
      return 'HOÀN THÀNH';
    case 'REJECTED':
      return 'ĐÃ TỪ CHỐI';
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
    fontSize: 11,
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
    marginBottom: 12,
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
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveTagText: {
    color: '#34D399',
    fontSize: 8,
    fontWeight: '800',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 9,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
  openNavDirectBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  openNavDirectText: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '800',
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
  quickActionsContainer: {
    flexDirection: 'row',
    gap: 10,
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
    marginBottom: 8,
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
  missionVictimName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  missionAddress: {
    color: '#CBD5E1',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 6,
  },
  missionInjuryText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 8,
  },
  missionMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  missionMetaItem: {
    color: '#94A3B8',
    fontSize: 11,
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
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  specSectionTitle: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 10,
  },
  specItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  specLabel: {
    color: '#94A3B8',
    fontSize: 11,
  },
  specValue: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  equipmentCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  equipmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  equipmentTitle: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '900',
  },
  equipmentList: {
    gap: 8,
  },
  equipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  equipmentText: {
    color: '#CBD5E1',
    fontSize: 11,
    flex: 1,
  },
  // Tab 4: Logs Styles
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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  incomingVictimName: {
    color: '#F8FAFC',
    fontSize: 14,
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
    fontWeight: '700',
  },
  incomingMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  incMetricBox: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    padding: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  incMetricLabel: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '800',
  },
  incMetricVal: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
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
