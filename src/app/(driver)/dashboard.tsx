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
import { DriverResource, LatLng } from '@/types';
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

  // Tab State: 'overview' | 'vehicle' | 'logs'
  const [activeTab, setActiveTab] = useState<'overview' | 'vehicle' | 'logs'>('overview');

  // Resource State from API
  const [driverResource, setDriverResource] = useState<DriverResource | null>(null);
  const [loadingResource, setLoadingResource] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Status & GPS State
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true);
  const [syncingLocation, setSyncingLocation] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Chưa đồng bộ');

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
      console.error('[DriverDashboard] Error fetching driver resource:', err);
      // Fallback mock resource if error or not yet assigned
      if (!driverResource) {
        setDriverResource({
          id: '1042',
          licensePlate: '29A-115.88',
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
          updatedAt: new Date().toISOString(),
        });
      }
    } finally {
      setLoadingResource(false);
      setRefreshing(false);
    }
  }, [driverResource]);

  // 2. Location Update Handler via PATCH /driver-resource/{id}/location
  const sendLocationUpdate = useCallback(async (
    lat: number,
    lng: number,
    speed = 0,
    heading = 0,
    accuracy = 5,
    source: 'AUTO_GPS' | 'MANUAL' | 'SIMULATION' = 'AUTO_GPS'
  ) => {
    const resourceId = driverResource?.id || '1042';
    try {
      setSyncingLocation(true);

      // Animate Sync Icon
      Animated.sequence([
        Animated.timing(pulseSyncAnim, { toValue: 1.3, duration: 200, useNativeDriver: true }),
        Animated.timing(pulseSyncAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      const payload = {
        latitude: lat,
        longitude: lng,
        speed,
        heading,
        accuracy,
      };

      console.log(`[DriverDashboard] Calling PATCH /driver-resource/${resourceId}/location:`, payload);
      await api.updateDriverResourceLocation(resourceId, payload);

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
  }, [driverResource, pulseSyncAnim]);

  // 3. Manual Sync Location Button Handler
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

  // 4. Toggle Driver/Vehicle Status (Available / Busy / Offline)
  const handleToggleStatus = async (val: boolean) => {
    setIsAvailable(val);
    const newStatus = val ? 'AVAILABLE' : 'OFFLINE';
    const resourceId = driverResource?.id || '1042';

    try {
      await api.updateDriverResourceStatus(resourceId, newStatus);
      if (driverResource) {
        setDriverResource({ ...driverResource, status: newStatus });
      }
    } catch (e) {
      console.warn('[DriverDashboard] Failed to update resource status:', e);
    }
  };

  // 5. Initial Load & Background Location Sync
  useEffect(() => {
    fetchDriverResource();

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
            // Initial sync
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
  }, [fetchDriverResource, sendLocationUpdate]);

  // 6. Auto-sync Interval (every 8 seconds when enabled and available)
  useEffect(() => {
    if (autoSyncEnabled && isAvailable) {
      autoSyncIntervalRef.current = setInterval(async () => {
        try {
          let lat = currentCoords.latitude;
          let lng = currentCoords.longitude;
          let spd = currentCoords.speed;
          let hdg = currentCoords.heading;
          let acc = currentCoords.accuracy;

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
      }, 8000);
    } else {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
        autoSyncIntervalRef.current = null;
      }
    }

    return () => {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
        autoSyncIntervalRef.current = null;
      }
    };
  }, [autoSyncEnabled, isAvailable, currentCoords, sendLocationUpdate]);

  // 7. Incoming Mission Overlay Animation
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
    const mission = {
      id: `DM-${Math.floor(1000 + Math.random() * 9000)}`,
      victimName: 'Nguyễn Văn A (48 tuổi)',
      victimPhone: '0987.654.321',
      victimAddress: '12 Chùa Bộc, P. Quang Trung, Q. Đống Đa, Hà Nội',
      victimLat: '21.0091',
      victimLng: '105.8247',
      victimInjury: 'Tai nạn giao thông - Đa chấn thương cẳng chân, cần nẹp cố định',
      distance: '1.2 km',
      eta: '4 phút',
    };
    setActiveMission(mission);
    setShowIncomingOrder(true);
  };

  const handleAcceptOrder = () => {
    setShowIncomingOrder(false);
    const missionId = activeMission?.id || `mission_${Date.now()}`;
    router.push({
      pathname: '/(driver)/navigation',
      params: {
        victimLat: activeMission?.victimLat || '21.0091',
        victimLng: activeMission?.victimLng || '105.8247',
        victimName: activeMission?.victimName || 'Nguyễn Văn A',
        victimAddress: activeMission?.victimAddress || '12 Chùa Bộc, Đống Đa, Hà Nội',
        missionId,
        dispatchMissionId: missionId,
        victimPhone: activeMission?.victimPhone || '0987.654.321',
        victimInjury: activeMission?.victimInjury || 'Tai nạn giao thông - Chấn thương chân',
      },
    });
  };

  const handleDeclineOrder = () => {
    setShowIncomingOrder(false);
    Alert.alert('Đã Bỏ Qua', 'Yêu cầu cứu trợ đã được chuyển tiếp cho xe cứu thương lân cận khác.');
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

  const handleCallHospital = () => {
    Linking.openURL('tel:02438693731').catch(() => {
      Alert.alert('Thông báo', 'Hotline Bệnh viện Cấp Cứu: 024 3869 3731');
    });
  };

  const flashBgColor = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#111827', '#450a0a'],
  });

  const currentUser = globalConfig.getCurrentUser();
  const driverName = driverResource?.driverName || currentUser?.name || 'Bác sĩ / Tài xế Cứu Thương';
  const unitBadge = driverResource?.vehicleNumber || (driverResource?.id ? `UNIT: #${driverResource.id}` : 'UNIT: AMB-042');
  const licensePlate = driverResource?.licensePlate || '29A-115.88';
  const providerTitle = driverResource?.providerName || 'Bệnh viện Cấp cứu 115 - Chi nhánh Đống Đa';
  const vehicleTypeStr = driverResource?.vehicleType || driverResource?.type || 'Xe Cấp Cứu Hồi Sức Tích Cực (ICU)';

  // Parse equipment list
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
                onPress={() => fetchDriverResource(true)}
                activeOpacity={0.7}
              >
                {loadingResource || refreshing ? (
                  <ActivityIndicator size="small" color="#10B981" />
                ) : (
                  <Ionicons name="refresh" size={18} color="#94A3B8" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.profileBtn}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="logout" size={18} color="#F87171" />
              </TouchableOpacity>
            </View>
          </View>

          {/* NAVIGATION TAB BAR */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'overview' && styles.tabItemActive]}
              onPress={() => setActiveTab('overview')}
            >
              <MaterialCommunityIcons
                name="radar"
                size={16}
                color={activeTab === 'overview' ? '#10B981' : '#64748B'}
              />
              <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
                Điều Hành & GPS
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'vehicle' && styles.tabItemActive]}
              onPress={() => setActiveTab('vehicle')}
            >
              <MaterialCommunityIcons
                name="car-info"
                size={16}
                color={activeTab === 'vehicle' ? '#10B981' : '#64748B'}
              />
              <Text style={[styles.tabText, activeTab === 'vehicle' && styles.tabTextActive]}>
                Thông Số Xe
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'logs' && styles.tabItemActive]}
              onPress={() => setActiveTab('logs')}
            >
              <MaterialCommunityIcons
                name="format-list-bulleted-type"
                size={16}
                color={activeTab === 'logs' ? '#10B981' : '#64748B'}
              />
              <Text style={[styles.tabText, activeTab === 'logs' && styles.tabTextActive]}>
                Nhật Ký PostGIS ({gpsLogs.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* MAIN SCROLLABLE CONTENT */}
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
            {/* TAB 1: OVERVIEW & LIVE GPS SYNC */}
            {activeTab === 'overview' && (
              <>
                {/* DRIVER READINESS STATUS CARD */}
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => handleToggleStatus(!isAvailable)}
                  style={styles.statusCardWrapper}
                >
                  <LinearGradient
                    colors={
                      isAvailable
                        ? ['rgba(16, 185, 129, 0.18)', 'rgba(5, 150, 105, 0.05)']
                        : ['rgba(239, 68, 68, 0.15)', 'rgba(30, 41, 59, 0.5)']
                    }
                    style={styles.statusCard}
                  >
                    <View style={styles.statusInfo}>
                      <View
                        style={[
                          styles.statusIndicator,
                          { backgroundColor: isAvailable ? '#10B981' : '#EF4444' },
                        ]}
                      >
                        {isAvailable && <View style={styles.indicatorPing} />}
                      </View>
                      <View>
                        <Text
                          style={[
                            styles.statusTitle,
                            { color: isAvailable ? '#34D399' : '#F87171' },
                          ]}
                        >
                          {isAvailable ? 'SẴN SÀNG NHẬN CA (ONLINE)' : 'TẠM NGHỈ / NGOẠI TUYẾN'}
                        </Text>
                        <Text style={styles.statusSub}>
                          {isAvailable
                            ? 'Đang phát tín hiệu GPS về trung tâm điều phối 115'
                            : 'Không nhận điều phối cứu thương tự động'}
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={isAvailable}
                      onValueChange={handleToggleStatus}
                      trackColor={{ false: '#334155', true: '#10B981' }}
                      thumbColor="#FFF"
                    />
                  </LinearGradient>
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
                          API: PATCH /driver-resource/{driverResource?.id || '1042'}/location
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
                      <Text style={styles.autoSyncTitle}>Tự động đồng bộ GPS mỗi 8 giây</Text>
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
              </>
            )}

            {/* TAB 2: VEHICLE & MEDICAL EQUIPMENT DETAILS */}
            {activeTab === 'vehicle' && (
              <View style={styles.vehicleTabContainer}>
                {/* Vehicle Detailed Card */}
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
                  <View style={styles.specItemRow}>
                    <Text style={styles.specLabel}>Trạng thái hiện tại:</Text>
                    <View style={styles.statusBadgeInline}>
                      <Text style={styles.statusBadgeInlineText}>
                        {(driverResource?.status || 'AVAILABLE').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.specItemRow}>
                    <Text style={styles.specLabel}>Cập nhật lần cuối:</Text>
                    <Text style={styles.specValue}>
                      {driverResource?.updatedAt
                        ? new Date(driverResource.updatedAt).toLocaleString('vi-VN')
                        : new Date().toLocaleString('vi-VN')}
                    </Text>
                  </View>
                </View>

                {/* Medical Equipment Checklist */}
                <View style={styles.equipmentCard}>
                  <View style={styles.equipmentHeader}>
                    <MaterialCommunityIcons name="medical-bag" size={20} color="#10B981" />
                    <Text style={styles.equipmentTitle}>DANH MỤC TRANG THIẾT BỊ Y TẾ TRÊN XE</Text>
                  </View>

                  {equipmentList.map((item, index) => (
                    <View key={index} style={styles.equipmentItem}>
                      <View style={styles.equipmentCheckCircle}>
                        <Ionicons name="checkmark-sharp" size={14} color="#10B981" />
                      </View>
                      <Text style={styles.equipmentName}>{item}</Text>
                      <View style={styles.readyBadge}>
                        <Text style={styles.readyBadgeText}>SẴN SÀNG</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Emergency Hotlines */}
                <View style={styles.hotlinesCard}>
                  <Text style={styles.specSectionTitle}>ĐƯỜNG DÂY NÓNG HỖ TRỢ</Text>
                  <TouchableOpacity style={styles.hotlineRow} onPress={handleCallDispatcher}>
                    <View style={styles.hotlineIcon}>
                      <Ionicons name="call" size={18} color="#FFF" />
                    </View>
                    <View style={styles.hotlineContent}>
                      <Text style={styles.hotlineTitle}>Tổng Đài Cấp Cứu 115</Text>
                      <Text style={styles.hotlineSub}>Điều phối cứu thương khẩn cấp trung tâm</Text>
                    </View>
                    <Text style={styles.hotlineNum}>115</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.hotlineRow} onPress={handleCallHospital}>
                    <View style={[styles.hotlineIcon, { backgroundColor: '#38BDF8' }]}>
                      <FontAwesome5 name="hospital" size={16} color="#FFF" />
                    </View>
                    <View style={styles.hotlineContent}>
                      <Text style={styles.hotlineTitle}>Trực Ban Bệnh Viện Bạch Mai / 115</Text>
                      <Text style={styles.hotlineSub}>Khoa Hồi Sức Cấp Cứu A9</Text>
                    </View>
                    <Text style={styles.hotlineNum}>024 3869 3731</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* TAB 3: POSTGIS LOGS */}
            {activeTab === 'logs' && (
              <View style={styles.logsTabContainer}>
                <View style={styles.logsHeaderRow}>
                  <MaterialCommunityIcons name="database-sync" size={18} color="#10B981" />
                  <Text style={styles.logsSectionTitle}>NHẬT KÝ ĐỒNG BỘ POSTGIS GPS</Text>
                  <TouchableOpacity
                    style={styles.clearLogsBtn}
                    onPress={() => setGpsLogs([])}
                  >
                    <Text style={styles.clearLogsText}>XÓA NHẬT KÝ</Text>
                  </TouchableOpacity>
                </View>

                {gpsLogs.map(item => (
                  <View key={item.id} style={styles.logItemCard}>
                    <View style={styles.logItemHeader}>
                      <View style={styles.logSourceBadge}>
                        <Text style={styles.logSourceText}>{item.source}</Text>
                      </View>
                      <Text style={styles.logTimeText}>{item.time}</Text>
                    </View>
                    <Text style={styles.logCoordsText}>Tọa độ: {item.coords}</Text>
                    <View style={styles.logStatusRow}>
                      <Ionicons
                        name={item.status.includes('200') ? 'checkmark-circle' : 'alert-circle'}
                        size={14}
                        color={item.status.includes('200') ? '#10B981' : '#F87171'}
                      />
                      <Text
                        style={[
                          styles.logStatusMessage,
                          { color: item.status.includes('200') ? '#34D399' : '#F87171' },
                        ]}
                      >
                        {item.status}
                      </Text>
                    </View>
                  </View>
                ))}

                {gpsLogs.length === 0 && (
                  <View style={styles.emptyLogsBox}>
                    <MaterialCommunityIcons name="satellite-variant" size={40} color="#334155" />
                    <Text style={styles.emptyLogsText}>Chưa có bản ghi đồng bộ GPS nào.</Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* INCOMING EMERGENCY MISSION MODAL / OVERLAY */}
          {showIncomingOrder && activeMission && (
            <Animated.View
              style={[
                styles.orderOverlay,
                { backgroundColor: flashBgColor, transform: [{ translateY: slideAnim }] },
              ]}
            >
              <View style={styles.sheetHandle} />

              <View style={styles.orderHeader}>
                <Animated.View style={[styles.emergencyIcon, { transform: [{ scale: radarScale }] }]}>
                  <MaterialCommunityIcons name="alarm-light" size={32} color="#FFF" />
                </Animated.View>
                <View style={styles.orderHeaderTextGroup}>
                  <Text style={styles.orderTitle}>LỆNH ĐIỀU PHỐI CẤP CỨU!</Text>
                  <Text style={styles.orderSubTitle}>
                    Khoảng cách: {activeMission.distance} • Dự kiến: {activeMission.eta}
                  </Text>
                </View>
              </View>

              <View style={styles.orderInfoCard}>
                <InfoRow
                  icon="map-marker-radius"
                  label="ĐỊA ĐIỂM CẤP CỨU"
                  value={activeMission.victimAddress}
                />
                <InfoRow
                  icon="account-alert"
                  label="NẠN NHÂN"
                  value={`${activeMission.victimName} • SĐT: ${activeMission.victimPhone}`}
                />
                <InfoRow
                  icon="alert-octagon"
                  label="TÌNH TRẠNG Y TẾ"
                  value={activeMission.victimInjury}
                />
              </View>

              <View style={styles.orderActions}>
                <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={handleDeclineOrder}
                  activeOpacity={0.8}
                >
                  <Text style={styles.declineText}>TỪ CHỐI</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={handleAcceptOrder}
                  activeOpacity={0.8}
                >
                  <FontAwesome5 name="ambulance" size={18} color="#022C22" style={{ marginRight: 8 }} />
                  <Text style={styles.acceptText}>NHẬN CA & ĐIỀU HƯỚNG</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const InfoRow = ({ icon, label, value }: { icon: any; label: string; value: string }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconBox}>
      <MaterialCommunityIcons name={icon} size={20} color="#34D399" />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

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
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 36 : 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  unitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  unitText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  plateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  plateText: {
    fontSize: 10,
    fontWeight: '800',
  },
  welcomeText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
  },
  providerText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  profileBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    gap: 8,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  tabItemActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  tabText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#34D399',
    fontWeight: '800',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  statusCardWrapper: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  statusIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicatorPing: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    position: 'absolute',
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statusSub: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  resourceSummaryCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  resourceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  resourceIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  resourceTitleBlock: {
    flex: 1,
  },
  resourceVehicleType: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  resourceSubInfo: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveTagText: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '900',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  gpsSyncPanel: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  gpsPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  gpsPanelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  gpsPanelTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  gpsPanelSubTitle: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  syncNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    elevation: 4,
  },
  syncNowBtnActive: {
    backgroundColor: '#34D399',
    opacity: 0.8,
  },
  syncNowText: {
    color: '#022C22',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  coordsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  coordBox: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  coordLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  coordValue: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
  },
  coordsSubGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  subCoordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subCoordText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
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
    fontSize: 12,
    fontWeight: '700',
  },
  autoSyncDesc: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  mapPreviewCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  mapPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  mapPreviewTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    flex: 1,
    marginLeft: 8,
  },
  openNavDirectBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  openNavDirectText: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '800',
  },
  mapFrame: {
    height: 180,
    width: '100%',
    position: 'relative',
  },
  mapOverlayPill: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  mapOverlayText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '700',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  // Tab 2 Vehicle Styles
  vehicleTabContainer: {
    gap: 16,
  },
  specCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  specSectionTitle: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  specItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  specLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  specValue: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    flex: 1,
  },
  statusBadgeInline: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusBadgeInlineText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '900',
  },
  equipmentCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  equipmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  equipmentTitle: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  equipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  equipmentCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  equipmentName: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  readyBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  readyBadgeText: {
    color: '#10B981',
    fontSize: 9,
    fontWeight: '800',
  },
  hotlinesCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  hotlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  hotlineIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  hotlineContent: {
    flex: 1,
  },
  hotlineTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  hotlineSub: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  hotlineNum: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '900',
  },
  // Tab 3 Logs Styles
  logsTabContainer: {
    gap: 12,
  },
  logsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logsSectionTitle: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    flex: 1,
    marginLeft: 8,
  },
  clearLogsBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  clearLogsText: {
    color: '#F87171',
    fontSize: 9,
    fontWeight: '800',
  },
  logItemCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  logItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  logSourceBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  logSourceText: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '800',
  },
  logTimeText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  logCoordsText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  logStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logStatusMessage: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyLogsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyLogsText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  // Incoming Emergency Overlay Styles
  orderOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    elevation: 30,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    zIndex: 9999,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 14,
  },
  emergencyIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  orderHeaderTextGroup: {
    flex: 1,
  },
  orderTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  orderSubTitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  orderInfoCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  infoValue: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  orderActions: {
    flexDirection: 'row',
    gap: 10,
  },
  declineBtn: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineText: {
    color: '#FFF',
    fontWeight: '800',
    letterSpacing: 0.5,
    fontSize: 12,
  },
  acceptBtn: {
    flex: 2,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  acceptText: {
    color: '#022C22',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
