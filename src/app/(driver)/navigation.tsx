import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Platform,
  Linking,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5, Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/services/api';
import { globalConfig } from '@/services/config';
import {
  AmbulanceSimulation,
  AmbulanceSimulationStatus,
  DispatchMission,
  DispatchMissionStatus,
  DriverResource,
  LatLng,
  TrackingUpdate,
  getResourceLicensePlate,
} from '@/types';
import AmbulanceMap from '@/components/AmbulanceMap';

export default function NavigationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // --- Route params ---
  const missionId = (params.missionId as string) || (params.dispatchMissionId as string) || (params.id as string) || 'DM-101';
  const initialVictimLat = params.victimLat ? parseFloat(params.victimLat as string) : 21.0091;
  const initialVictimLng = params.victimLng ? parseFloat(params.victimLng as string) : 105.8247;
  const initialVictimName = (params.victimName as string) || 'Nguyễn Văn Nam';
  const initialVictimPhone = (params.victimPhone as string) || '0987.654.321';
  const initialVictimAddress = (params.victimAddress as string) || '12 Chùa Bộc, Đống Đa, Hà Nội';
  const initialVictimInjury = (params.victimInjury as string) || 'Tai nạn giao thông - Gãy xương cẳng chân';

  // --- Mission & Resource state ---
  const [mission, setMission] = useState<DispatchMission | null>(null);
  const [driverResource, setDriverResource] = useState<DriverResource | null>(null);
  const [loadingAction, setLoadingAction] = useState<boolean>(false);

  // Operational State Machine: 'STARTING' -> 'EN_ROUTE_TO_SCENE' -> 'ARRIVED_SCENE' -> 'TRANSPORTING' -> 'ARRIVED_HOSPITAL' -> 'COMPLETED'
  const [missionPhase, setMissionPhase] = useState<DispatchMissionStatus>('EN_ROUTE_TO_SCENE');

  // --- Simulation & Map state ---
  const [simulation, setSimulation] = useState<AmbulanceSimulation | null>(null);
  const [simStatus, setSimStatus] = useState<AmbulanceSimulationStatus>('RUNNING');
  const [driverPos, setDriverPos] = useState<LatLng>({
    lat: initialVictimLat + 0.006,
    lng: initialVictimLng + 0.005,
  });

  const [distance, setDistance] = useState<number>(1.2);
  const [eta, setEta] = useState<number>(4);
  const [progress, setProgress] = useState<number>(10);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simIdRef = useRef<string | null>(null);

  // Patient & Hospital Info
  const victimName = mission?.victimName || mission?.patientName || initialVictimName;
  const victimPhone = mission?.victimPhone || mission?.patientPhone || initialVictimPhone;
  const victimAddress = mission?.victimAddress || mission?.pickupAddress || initialVictimAddress;
  const victimInjury = mission?.injury || mission?.description || initialVictimInjury;

  const hospitalName = mission?.hospitalName || 'Bệnh viện Cấp Cứu 115 (Khoa Cấp Cứu)';
  const hospitalAddress = mission?.hospitalAddress || 'Số 1 Chùa Bộc, Đống Đa, Hà Nội';
  const hospitalLocation: LatLng = mission?.hospitalLocation || { lat: 21.0075, lng: 105.8285 };
  const victimLocation: LatLng = { lat: initialVictimLat, lng: initialVictimLng };

  // 1. Fetch Mission Details (GET /dispatch-missions/me/{missionId}) & Resource
  const loadMissionDetails = useCallback(async () => {
    try {
      const [resMission, resResource] = await Promise.allSettled([
        api.getMyMission(missionId),
        api.getDriverResource(),
      ]);

      if (resMission.status === 'fulfilled' && resMission.value) {
        setMission(resMission.value);
        const st = (resMission.value.status || '').toUpperCase();
        if (st === 'ACCEPTED' || st === 'ASSIGNED') setMissionPhase('STARTING');
        else if (st === 'EN_ROUTE_TO_SCENE' || st === 'STARTED') setMissionPhase('EN_ROUTE_TO_SCENE');
        else if (st === 'ARRIVED_SCENE') setMissionPhase('ARRIVED_SCENE');
        else if (st === 'START_TRANSPORT' || st === 'TRANSPORTING') setMissionPhase('TRANSPORTING');
        else if (st === 'ARRIVED_HOSPITAL') setMissionPhase('ARRIVED_HOSPITAL');
        else if (st === 'COMPLETED') setMissionPhase('COMPLETED');
      }

      if (resResource.status === 'fulfilled' && resResource.value) {
        setDriverResource(resResource.value);
      }
    } catch (e) {
      console.warn('[DriverNav] Load mission details error:', e);
    }
  }, [missionId]);

  // 2. Initialize Navigation, Simulation, and GPS Polling
  useEffect(() => {
    let cancelled = false;
    loadMissionDetails();

    const initSimulation = async () => {
      try {
        const startLoc: LatLng = {
          lat: initialVictimLat + 0.007,
          lng: initialVictimLng + 0.005,
        };
        const endLoc: LatLng = { lat: initialVictimLat, lng: initialVictimLng };

        const currentUser = globalConfig.getCurrentUser();
        const created = await api.createAmbulanceSimulation({
          missionId: String(missionId),
          dispatchMissionId: String(missionId),
          driverId: currentUser?.id,
          vehicleId: driverResource?.id ? String(driverResource.id) : undefined,
          startLocation: startLoc,
          endLocation: endLoc,
        });

        if (cancelled) return;
        setSimulation(created);
        simIdRef.current = created.id;
        setDriverPos({ ...startLoc });

        // Update initial location in resource API
        api.updateDriverResourceLocation({
          latitude: startLoc.lat,
          longitude: startLoc.lng,
          speed: 38,
          heading: 90,
        }).catch(() => {});

        // Start simulation
        const started = await api.startAmbulanceSimulation(created.id);
        if (cancelled) return;
        setSimulation(started);
        setSimStatus(started.status);

        // Start polling tracking
        pollingRef.current = setInterval(async () => {
          if (!simIdRef.current) return;
          try {
            const track: TrackingUpdate = await api.getSimulationTracking(simIdRef.current);
            if (cancelled) return;
            setDriverPos(track.currentLocation);
            if (track.status) setSimStatus(track.status);

            // Sync with PATCH /driver-resource/location
            api.updateDriverResourceLocation({
              latitude: track.currentLocation.lat,
              longitude: track.currentLocation.lng,
              speed: track.speed || 38,
              heading: track.heading || 0,
            }).catch(() => {});

            if (typeof track.distanceTraveled === 'number') {
              const startDistance = 1.2;
              setDistance(Math.max(0.05, startDistance - track.distanceTraveled));
            }
            if (typeof track.estimatedTimeArrival === 'number') {
              setEta(Math.max(0, Math.ceil(track.estimatedTimeArrival / 60)));
            }
            if (typeof track.progress === 'number') {
              setProgress(track.progress);
            }
          } catch (e) {
            console.warn('[DriverNav] Tracking poll error:', e);
          }
        }, 1800);
      } catch (e) {
        console.warn('[DriverNav] Simulation init error:', e);
      }
    };

    initSimulation();

    return () => {
      cancelled = true;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (simIdRef.current) {
        api.stopAmbulanceSimulation(simIdRef.current).catch(() => {});
      }
    };
  }, [initialVictimLat, initialVictimLng, loadMissionDetails, missionId, driverResource?.id]);

  // --- 3. API Actions for Operational Lifecycle ---

  // Action 1: POST /dispatch-missions/{id}/start (Bắt đầu di chuyển đến hiện trường)
  const handleStartMission = async () => {
    setLoadingAction(true);
    try {
      console.log('[DriverNav] Calling POST /dispatch-missions/{id}/start:', missionId);
      const res = await api.startMission(missionId);
      setMission(prev => (prev ? { ...prev, status: 'EN_ROUTE_TO_SCENE' } : res));
      setMissionPhase('EN_ROUTE_TO_SCENE');
      await api.updateDriverResourceStatus('EN_ROUTE').catch(() => {});
      Alert.alert('Đã Bắt Đầu Xuất Phát', 'Hệ thống đã thông báo cho Tổng đài 115 và Người dân.');
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể bắt đầu nhiệm vụ');
    } finally {
      setLoadingAction(false);
    }
  };

  // Action 2: POST /dispatch-missions/{id}/arrive-scene (Xác nhận đã đến hiện trường)
  const handleArriveScene = async () => {
    setLoadingAction(true);
    try {
      console.log('[DriverNav] Calling POST /dispatch-missions/{id}/arrive-scene:', missionId);
      const res = await api.arriveScene(missionId);
      setMission(prev => (prev ? { ...prev, status: 'ARRIVED_SCENE' } : res));
      setMissionPhase('ARRIVED_SCENE');
      setDistance(0);
      setEta(0);
      setDriverPos({ lat: initialVictimLat, lng: initialVictimLng });

      await api.updateDriverResourceStatus('ARRIVED_SCENE').catch(() => {});
      await api.updateDriverResourceLocation({
        latitude: initialVictimLat,
        longitude: initialVictimLng,
        speed: 0,
        heading: 0,
      }).catch(() => {});

      Alert.alert(
        'ĐÃ ĐẾN HIỆN TRƯỜNG! 🏥',
        'Vui lòng tiến hành sơ cứu, ổn định tình trạng bệnh nhân và đưa bệnh nhân lên cáng cứu thương.'
      );
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể cập nhật trạng thái');
    } finally {
      setLoadingAction(false);
    }
  };

  // Action 3: POST /dispatch-missions/{id}/start-transport (Bắt đầu vận chuyển bệnh nhân đến bệnh viện)
  const handleStartTransport = async () => {
    setLoadingAction(true);
    try {
      console.log('[DriverNav] Calling POST /dispatch-missions/{id}/start-transport:', missionId);
      const res = await api.startTransport(missionId);
      setMission(prev => (prev ? { ...prev, status: 'TRANSPORTING' } : res));
      setMissionPhase('TRANSPORTING');
      setDistance(1.8);
      setEta(6);
      setProgress(25);

      await api.updateDriverResourceStatus('TRANSPORTING').catch(() => {});
      Alert.alert(
        'BẮT ĐẦU CHUYỂN VIỆN! 🚑',
        `Đang vận chuyển bệnh nhân về ${hospitalName}. Bản đồ đã cập nhật tuyến đường tới Bệnh viện.`
      );
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể bắt đầu vận chuyển');
    } finally {
      setLoadingAction(false);
    }
  };

  // Action 4: POST /dispatch-missions/{id}/arrive-hospital (Xác nhận đã đến bệnh viện)
  const handleArriveHospital = async () => {
    setLoadingAction(true);
    try {
      console.log('[DriverNav] Calling POST /dispatch-missions/{id}/arrive-hospital:', missionId);
      const res = await api.arriveHospital(missionId);
      setMission(prev => (prev ? { ...prev, status: 'ARRIVED_HOSPITAL' } : res));
      setMissionPhase('ARRIVED_HOSPITAL');
      setDistance(0);
      setEta(0);
      setProgress(100);
      setDriverPos(hospitalLocation);

      await api.updateDriverResourceStatus('ARRIVED_HOSPITAL').catch(() => {});
      Alert.alert(
        'ĐÃ ĐẾN BỆNH VIỆN! 🏥',
        'Tiến hành bàn giao bệnh nhân và hồ sơ y tế cho Bác sĩ Khoa Cấp Cứu tiếp nhận.'
      );
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể cập nhật trạng thái');
    } finally {
      setLoadingAction(false);
    }
  };

  // Action 5: POST /dispatch-missions/{id}/complete (Hoàn thành nhiệm vụ)
  const handleCompleteMission = () => {
    Alert.alert(
      'HOÀN THÀNH NHIỆM VỤ',
      'Xác nhận bệnh nhân đã được bàn giao cho Bệnh viện an toàn? Xe sẽ chuyển về trạng thái SẴN SÀNG đón ca mới.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'XÁC NHẬN HOÀN THÀNH',
          onPress: async () => {
            setLoadingAction(true);
            try {
              console.log('[DriverNav] Calling POST /dispatch-missions/{id}/complete:', missionId);
              if (simIdRef.current) {
                api.stopAmbulanceSimulation(simIdRef.current).catch(() => {});
              }
              await api.completeMission(missionId, 'Đã bàn giao bệnh nhân an toàn cho khoa cấp cứu');
              await api.updateDriverResourceStatus('AVAILABLE').catch(() => {});

              Alert.alert(
                'HOÀN TẤT CA CẤP CỨU! 🎉',
                'Nhiệm vụ đã được ghi nhận vào lịch sử. Xe cứu thương chuyển về trạng thái SẴN SÀNG.',
                [
                  {
                    text: 'Về Màn Hình Chính',
                    onPress: () => router.replace('/(driver)/dashboard'),
                  },
                ]
              );
            } catch (e: any) {
              Alert.alert('Lỗi', e?.message || 'Không thể hoàn tất ca');
            } finally {
              setLoadingAction(false);
            }
          },
        },
      ]
    );
  };

  const openGoogleMaps = () => {
    const targetLoc = missionPhase === 'TRANSPORTING' || missionPhase === 'ARRIVED_HOSPITAL'
      ? hospitalLocation
      : victimLocation;
    const targetLabel = missionPhase === 'TRANSPORTING' || missionPhase === 'ARRIVED_HOSPITAL'
      ? hospitalName
      : `Nạn nhân: ${victimName}`;

    const latLng = `${targetLoc.lat},${targetLoc.lng}`;
    const url = Platform.select({
      ios: `maps:0,0?q=${targetLabel}@${latLng}`,
      android: `geo:0,0?q=${latLng}(${targetLabel})`,
      web: `https://www.google.com/maps/search/?api=1&query=${latLng}`,
    });
    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert('Lỗi', 'Không thể mở ứng dụng bản đồ bên ngoài.');
      });
    }
  };

  const callVictim = () => {
    Linking.openURL(`tel:${victimPhone}`).catch(() => {
      Alert.alert('Số điện thoại', `SĐT Nạn nhân: ${victimPhone}`);
    });
  };

  const licensePlate = getResourceLicensePlate(driverResource);
  const currentMapTarget = missionPhase === 'TRANSPORTING' || missionPhase === 'ARRIVED_HOSPITAL'
    ? hospitalLocation
    : victimLocation;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#070A10" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>

        {/* TOP FLOATING CARD: PATIENT & DESTINATION */}
        <View style={styles.topFloatCard}>
          <View style={styles.topCardRow}>
            <View style={styles.locationBadge}>
              <MaterialCommunityIcons name="ambulance" size={14} color="#10B981" />
              <Text style={styles.badgeText}>
                {licensePlate} • {distance.toFixed(1)} km ({eta} ph)
              </Text>
            </View>

            <TouchableOpacity onPress={openGoogleMaps} style={styles.googleMapsBtn} activeOpacity={0.8}>
              <Ionicons name="navigate-circle-outline" size={14} color="#34D399" style={{ marginRight: 4 }} />
              <Text style={styles.googleMapsBtnText}>MỞ GOOGLE MAPS</Text>
            </TouchableOpacity>
          </View>

          {/* Phase Banner */}
          <View style={[styles.phaseBanner, getPhaseBannerStyle(missionPhase)]}>
            <MaterialCommunityIcons name={getPhaseIcon(missionPhase) as any} size={15} color={getPhaseColor(missionPhase)} />
            <Text style={[styles.phaseBannerText, { color: getPhaseColor(missionPhase) }]}>
              {getPhaseLabel(missionPhase)}
            </Text>
          </View>

          {/* Target Address */}
          <Text style={styles.addressText} numberOfLines={2}>
            <Ionicons name="location-sharp" size={13} color="#EF4444" />{' '}
            {missionPhase === 'TRANSPORTING' || missionPhase === 'ARRIVED_HOSPITAL' ? hospitalAddress : victimAddress}
          </Text>

          <Text style={styles.injuryText} numberOfLines={1}>
            <MaterialCommunityIcons name="medical-bag" size={13} color="#F59E0B" /> {victimInjury}
          </Text>

          {/* Progress bar */}
          <View style={styles.progressRow}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${Math.min(100, progress)}%` }]} />
            </View>
            <Text style={styles.progressPct}>{progress.toFixed(0)}%</Text>
          </View>
        </View>

        {/* MAP CONTAINER */}
        <View style={styles.mapContainer}>
          <AmbulanceMap
            victimLocation={currentMapTarget}
            ambulanceLocation={driverPos}
            route={simulation?.route}
          />
        </View>

        {/* BOTTOM FLOATING MISSION CONTROLLER */}
        <View style={[styles.bottomStatusCard, { paddingBottom: Platform.OS === 'ios' ? 36 : 20 }]}>
          {/* Patient Info Header */}
          <View style={styles.patientRow}>
            <View style={styles.patientInfo}>
              <Text style={styles.patientName}>{victimName}</Text>
              <Text style={styles.patientPhone}>
                <Ionicons name="call-outline" size={12} color="#94A3B8" /> {victimPhone}
              </Text>
            </View>

            <TouchableOpacity
              onPress={callVictim}
              style={styles.callButton}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={16} color="#34D399" />
              <Text style={styles.callButtonText}>GỌI NẠN NHÂN</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* GPS Live Sync Status */}
          <View style={styles.simStatusRow}>
            <View style={styles.livePulseDot} />
            <Text style={styles.simStatusLabel}>
              GPS: {driverPos.lat.toFixed(5)}, {driverPos.lng.toFixed(5)} • Vận tốc: 38 km/h
            </Text>
            <Text style={styles.simIdLabel} numberOfLines={1}>
              #{missionId}
            </Text>
          </View>

          {/* STEP-BY-STEP OPERATIONAL BUTTONS */}
          <View style={styles.actionsBox}>
            {loadingAction ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#10B981" />
                <Text style={styles.loadingText}>Đang cập nhật trạng thái API...</Text>
              </View>
            ) : (
              <>
                {missionPhase === 'STARTING' && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleStartMission}
                    style={[styles.mainButton, { backgroundColor: '#38BDF8' }]}
                  >
                    <FontAwesome5 name="paper-plane" size={14} color="#082F49" style={styles.btnIcon} />
                    <Text style={[styles.mainButtonText, { color: '#082F49' }]}>
                      BẮT ĐẦU DI CHUYỂN ĐẾN HIỆN TRƯỜNG (POST /start)
                    </Text>
                  </TouchableOpacity>
                )}

                {missionPhase === 'EN_ROUTE_TO_SCENE' && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleArriveScene}
                    style={[styles.mainButton, { backgroundColor: '#10B981' }]}
                  >
                    <FontAwesome5 name="map-marker-alt" size={15} color="#022C22" style={styles.btnIcon} />
                    <Text style={styles.mainButtonText}>
                      XÁC NHẬN ĐÃ ĐẾN HIỆN TRƯỜNG (POST /arrive-scene)
                    </Text>
                  </TouchableOpacity>
                )}

                {missionPhase === 'ARRIVED_SCENE' && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleStartTransport}
                    style={[styles.mainButton, { backgroundColor: '#F59E0B' }]}
                  >
                    <FontAwesome5 name="ambulance" size={15} color="#451A03" style={styles.btnIcon} />
                    <Text style={[styles.mainButtonText, { color: '#451A03' }]}>
                      BẮT ĐẦU VẬN CHUYỂN BỆNH NHÂN (POST /start-transport)
                    </Text>
                  </TouchableOpacity>
                )}

                {missionPhase === 'TRANSPORTING' && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleArriveHospital}
                    style={[styles.mainButton, { backgroundColor: '#A78BFA' }]}
                  >
                    <FontAwesome5 name="hospital" size={15} color="#2E1065" style={styles.btnIcon} />
                    <Text style={[styles.mainButtonText, { color: '#2E1065' }]}>
                      XÁC NHẬN ĐÃ ĐẾN BỆNH VIỆN (POST /arrive-hospital)
                    </Text>
                  </TouchableOpacity>
                )}

                {(missionPhase === 'ARRIVED_HOSPITAL' || missionPhase === 'COMPLETED') && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleCompleteMission}
                    style={[styles.mainButton, { backgroundColor: '#EF4444' }]}
                  >
                    <FontAwesome5 name="flag-checkered" size={15} color="#FFF" style={styles.btnIcon} />
                    <Text style={[styles.mainButtonText, { color: '#FFF' }]}>
                      HOÀN THÀNH NHIỆM VỤ (POST /complete)
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>

      </SafeAreaView>
    </View>
  );
}

const getPhaseLabel = (phase: DispatchMissionStatus) => {
  switch (phase) {
    case 'STARTING':
      return 'BƯỚC 1: SẴN SÀNG XUẤT PHÁT';
    case 'EN_ROUTE_TO_SCENE':
      return 'BƯỚC 1: ĐANG DI CHUYỂN ĐẾN HIỆN TRƯỜNG';
    case 'ARRIVED_SCENE':
      return 'BƯỚC 2: ĐÃ ĐẾN HIỆN TRƯỜNG • TIẾN HÀNH SƠ CỨU';
    case 'TRANSPORTING':
      return 'BƯỚC 3: ĐANG VẬN CHUYỂN BỆNH NHÂN ĐẾN BỆNH VIỆN';
    case 'ARRIVED_HOSPITAL':
      return 'BƯỚC 4: ĐÃ ĐẾN BỆNH VIỆN • BÀN GIAO KHOA CẤP CỨU';
    case 'COMPLETED':
      return 'BƯỚC 5: ĐÃ HOÀN TẤT CA CỨU HỘ';
    default:
      return 'ĐANG THỰC HIỆN NHIỆM VỤ CẤP CỨU';
  }
};

const getPhaseColor = (phase: DispatchMissionStatus) => {
  switch (phase) {
    case 'STARTING':
      return '#38BDF8';
    case 'EN_ROUTE_TO_SCENE':
      return '#10B981';
    case 'ARRIVED_SCENE':
      return '#F59E0B';
    case 'TRANSPORTING':
      return '#A78BFA';
    case 'ARRIVED_HOSPITAL':
      return '#34D399';
    case 'COMPLETED':
      return '#EF4444';
    default:
      return '#38BDF8';
  }
};

const getPhaseIcon = (phase: DispatchMissionStatus) => {
  switch (phase) {
    case 'STARTING':
      return 'send';
    case 'EN_ROUTE_TO_SCENE':
      return 'car-speed-limiter';
    case 'ARRIVED_SCENE':
      return 'account-injury';
    case 'TRANSPORTING':
      return 'ambulance';
    case 'ARRIVED_HOSPITAL':
      return 'hospital-building';
    case 'COMPLETED':
      return 'check-decagram';
    default:
      return 'alarm-light';
  }
};

const getPhaseBannerStyle = (phase: DispatchMissionStatus) => {
  const color = getPhaseColor(phase);
  return {
    backgroundColor: `${color}15`,
    borderColor: `${color}40`,
  };
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070A10',
  },
  safeArea: {
    flex: 1,
  },
  topFloatCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 10,
    elevation: 8,
  },
  topCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  badgeText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '800',
  },
  googleMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  googleMapsBtnText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
  },
  phaseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  phaseBannerText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  addressText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
    lineHeight: 18,
  },
  injuryText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  progressPct: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
    width: 32,
    textAlign: 'right',
  },
  mapContainer: {
    flex: 1,
  },
  bottomStatusCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    elevation: 16,
  },
  patientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '900',
  },
  patientPhone: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  callButtonText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '900',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 10,
  },
  simStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  simStatusLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  simIdLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
  },
  actionsBox: {
    marginTop: 4,
  },
  loadingBox: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  mainButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    elevation: 4,
  },
  btnIcon: {
    marginRight: 8,
  },
  mainButtonText: {
    color: '#022C22',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
