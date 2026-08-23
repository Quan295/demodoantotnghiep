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
  DispatchMission,
  DispatchMissionStatus,
  DriverResource,
  LatLng,
  getResourceLicensePlate,
} from '@/types';
import AmbulanceMap from '@/components/AmbulanceMap';
import { useDriverLocationTracking } from '@/hooks/useDriverLocationTracking';

export default function NavigationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Route params from caller
  const missionId = (params.missionId as string) || (params.dispatchMissionId as string) || (params.id as string);
  const requestId = (params.requestId as string) || '';
  const initialDestination = (params.destinationName as string) || '';

  // Mission & Resource state
  const [mission, setMission] = useState<DispatchMission | null>(null);
  const [driverResource, setDriverResource] = useState<DriverResource | null>(null);
  const [loadingMission, setLoadingMission] = useState<boolean>(true);
  const [loadingAction, setLoadingAction] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Continuous Real-time Driver GPS Tracking (Single Source of Truth)
  const {
    position: driverPos,
    latitude: currentLat,
    longitude: currentLng,
    speed: currentSpeed,
    accuracy: currentAccuracy,
    gpsStatus,
    lastSyncedAt,
    syncError,
    syncInProgress,
    manualSync,
  } = useDriverLocationTracking({
    enabled: true,
    missionId,
    timeInterval: 3000,
    distanceInterval: 5,
  });

  // Load Mission Details (GET /dispatch-missions/me/{missionId}) & Resource
  const loadMissionDetails = useCallback(async () => {
    if (!missionId) {
      setLoadError('Không tìm thấy mã nhiệm vụ');
      setLoadingMission(false);
      return;
    }

    try {
      setLoadingMission(true);
      setLoadError(null);
      const [resMission, resResource] = await Promise.allSettled([
        api.getMyMission(missionId),
        api.getDriverResource(),
      ]);

      if (resMission.status === 'fulfilled' && resMission.value) {
        setMission(resMission.value);
      } else {
        setLoadError('Không thể tải thông tin nhiệm vụ từ máy chủ');
      }

      if (resResource.status === 'fulfilled' && resResource.value) {
        setDriverResource(resResource.value);
      }
    } catch (e: any) {
      console.warn('[DriverNav] Load mission details error:', e);
      setLoadError('Không thể tải thông tin nhiệm vụ');
    } finally {
      setLoadingMission(false);
    }
  }, [initialDestination, missionId, requestId]);

  useEffect(() => {
    loadMissionDetails();
  }, [loadMissionDetails]);

  const currentStatus: DispatchMissionStatus = (mission?.status || 'ACCEPTED').toUpperCase() as DispatchMissionStatus;
  const destinationName = mission?.destinationName || initialDestination || 'Chưa xác định điểm đến';
  const licensePlate = getResourceLicensePlate(driverResource);
  const unitBadge = driverResource?.resourceCode || (driverResource?.id ? `UNIT #${driverResource.id}` : 'Xe cấp cứu');

  // --- API Actions Mapping Exact BE Endpoints ---

  // 1. POST /dispatch-missions/{id}/accept
  const handleAcceptMission = async () => {
    if (!missionId) return;
    setLoadingAction(true);
    try {
      await api.acceptMission(missionId);
      await loadMissionDetails();
      Alert.alert('Thành Công', 'Đã chấp nhận nhiệm vụ điều phối.');
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể chấp nhận nhiệm vụ');
    } finally {
      setLoadingAction(false);
    }
  };

  // 2. POST /dispatch-missions/{id}/reject
  const handleRejectMission = async () => {
    if (!missionId) return;
    Alert.alert('Từ chối nhiệm vụ', 'Bạn có chắc chắn muốn từ chối nhiệm vụ này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Từ chối',
        style: 'destructive',
        onPress: async () => {
          setLoadingAction(true);
          try {
            await api.rejectMission(missionId, 'Tài xế từ chối nhiệm vụ');
            router.replace('/(driver)/dashboard');
          } catch (e: any) {
            Alert.alert('Lỗi', e?.message || 'Không thể từ chối');
          } finally {
            setLoadingAction(false);
          }
        },
      },
    ]);
  };

  // 3. POST /dispatch-missions/{id}/start -> EN_ROUTE
  const handleStartMission = async () => {
    if (!missionId) return;
    setLoadingAction(true);
    try {
      console.log('[DriverNav] Calling POST /dispatch-missions/{id}/start:', missionId);
      await api.startMission(missionId);
      await loadMissionDetails();
      Alert.alert('Đã Bắt Đầu Di Chuyển', 'Hệ thống đã cập nhật trạng thái xe đang trên đường đến hiện trường.');
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể bắt đầu nhiệm vụ');
    } finally {
      setLoadingAction(false);
    }
  };

  // 4. POST /dispatch-missions/{id}/arrive-scene -> ARRIVED_SCENE
  const handleArriveScene = async () => {
    if (!missionId) return;
    setLoadingAction(true);
    try {
      console.log('[DriverNav] Calling POST /dispatch-missions/{id}/arrive-scene:', missionId);
      await api.arriveScene(missionId);
      await loadMissionDetails();
      Alert.alert(
        'ĐÃ ĐẾN HIỆN TRƯỜNG! 🏥',
        'Vui lòng tiến hành sơ cứu, ổn định tình trạng bệnh nhân và đưa bệnh nhân lên xe.'
      );
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể cập nhật trạng thái');
    } finally {
      setLoadingAction(false);
    }
  };

  // 5. POST /dispatch-missions/{id}/start-transport -> TRANSPORTING
  const handleStartTransport = async () => {
    if (!missionId) return;
    setLoadingAction(true);
    try {
      console.log('[DriverNav] Calling POST /dispatch-missions/{id}/start-transport:', missionId);
      await api.startTransport(missionId);
      await loadMissionDetails();
      Alert.alert(
        'BẮT ĐẦU VẬN CHUYỂN! 🚑',
        'Đang vận chuyển bệnh nhân đến bệnh viện tiếp nhận.'
      );
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể bắt đầu vận chuyển');
    } finally {
      setLoadingAction(false);
    }
  };

  // 6. POST /dispatch-missions/{id}/arrive-hospital -> ARRIVED_HOSPITAL
  const handleArriveHospital = async () => {
    if (!missionId) return;
    setLoadingAction(true);
    try {
      console.log('[DriverNav] Calling POST /dispatch-missions/{id}/arrive-hospital:', missionId);
      await api.arriveHospital(missionId);
      await loadMissionDetails();
      Alert.alert(
        'ĐÃ ĐẾN BỆNH VIỆN! 🏥',
        'Tiến hành bàn giao bệnh nhân cho Khoa Cấp Cứu tiếp nhận.'
      );
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể cập nhật trạng thái');
    } finally {
      setLoadingAction(false);
    }
  };

  // 7. POST /dispatch-missions/{id}/complete -> COMPLETED
  const handleCompleteMission = () => {
    if (!missionId) return;
    Alert.alert(
      'HOÀN THÀNH NHIỆM VỤ',
      'Xác nhận bệnh nhân đã được bàn giao an toàn? Ca trực sẽ được kết thúc.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'XÁC NHẬN HOÀN THÀNH',
          onPress: async () => {
            setLoadingAction(true);
            try {
              console.log('[DriverNav] Calling POST /dispatch-missions/{id}/complete:', missionId);
              await api.completeMission(missionId, 'Đã bàn giao bệnh nhân an toàn cho khoa cấp cứu');
              Alert.alert(
                'HOÀN TẤT NHIỆM VỤ! 🎉',
                'Nhiệm vụ đã được ghi nhận hoàn tất vào lịch sử hệ thống.',
                [
                  {
                    text: 'Về Màn Hình Chính',
                    onPress: () => router.replace('/(driver)/dashboard'),
                  },
                ]
              );
            } catch (e: any) {
              Alert.alert('Lỗi', e?.message || 'Không thể hoàn tất nhiệm vụ');
            } finally {
              setLoadingAction(false);
            }
          },
        },
      ]
    );
  };

  const openExternalMap = () => {
    const latLng = `${driverPos.lat},${driverPos.lng}`;
    const targetLabel = destinationName;
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(targetLabel)}@${latLng}`,
      android: `geo:0,0?q=${latLng}(${encodeURIComponent(targetLabel)})`,
      web: `https://www.google.com/maps/search/?api=1&query=${latLng}`,
    });
    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert('Thông báo', `Điểm đến: ${destinationName}`);
      });
    }
  };

  if (loadingMission) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Đang tải dữ liệu nhiệm vụ...</Text>
      </View>
    );
  }

  if (loadError || !mission) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={styles.errorTitle}>Lỗi tải nhiệm vụ</Text>
        <Text style={styles.errorSubtitle}>{loadError || 'Không tìm thấy dữ liệu nhiệm vụ'}</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: '#10B981', flex: 1 }]}
            onPress={loadMissionDetails}
          >
            <Text style={styles.backBtnText}>Thử Lại</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: '#334155', flex: 1 }]}
            onPress={() => router.replace('/(driver)/dashboard')}
          >
            <Text style={styles.backBtnText}>Quay Về</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const missionAny = mission as any;
  const rawIncLat = params.lat ? Number(params.lat) : (missionAny?.incidentLatitude ?? missionAny?.latitude ?? missionAny?.request?.latitude ?? null);
  const rawIncLng = params.lng ? Number(params.lng) : (missionAny?.incidentLongitude ?? missionAny?.longitude ?? missionAny?.request?.longitude ?? null);
  
  const incidentLocation: LatLng | undefined = (typeof rawIncLat === 'number' && !isNaN(rawIncLat) && typeof rawIncLng === 'number' && !isNaN(rawIncLng))
    ? { lat: rawIncLat, lng: rawIncLng }
    : undefined;

  const rawHospLat = missionAny?.hospitalLatitude ? Number(missionAny.hospitalLatitude) : null;
  const rawHospLng = missionAny?.hospitalLongitude ? Number(missionAny.hospitalLongitude) : null;
  const hospitalLocation: LatLng | undefined = (typeof rawHospLat === 'number' && !isNaN(rawHospLat) && typeof rawHospLng === 'number' && !isNaN(rawHospLng))
    ? { lat: rawHospLat, lng: rawHospLng }
    : undefined;

  const isTransportingPhase = ['TRANSPORTING', 'ARRIVED_HOSPITAL', 'COMPLETED'].includes(currentStatus);

  // Debug check: verify coordinates from server vs driver GPS
  useEffect(() => {
    console.log('[DriverNav Coordinates Check]', {
      incidentLocation: incidentLocation || 'Chưa có tọa độ từ máy chủ',
      hospitalLocation: hospitalLocation || 'Chưa có tọa độ bệnh viện',
      driverLat: currentLat,
      driverLng: currentLng,
      phase: isTransportingPhase ? 'TO_HOSPITAL' : 'TO_SCENE',
    });
  }, [incidentLocation, hospitalLocation, currentLat, currentLng, isTransportingPhase]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>

        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backIconBtn}
            onPress={() => router.replace('/(driver)/dashboard')}
          >
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>ĐIỀU HƯỚNG NHIỆM VỤ #{mission.id}</Text>
            <Text style={styles.headerSubtitle}>
              Yêu cầu #{mission.requestId} • {unitBadge} • {licensePlate}
            </Text>
          </View>

          <View style={[styles.statusBadge, getNavStatusBadgeStyle(currentStatus)]}>
            <Text style={styles.statusBadgeText}>{getNavStatusText(currentStatus)}</Text>
          </View>
        </View>

        {/* LIVE GPS / SERVER SYNC HUD STRIP */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0B0F19', paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.06)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: gpsStatus === 'tracking' ? '#10B981' : '#EF4444' }} />
            <Text style={{ fontSize: 10, fontWeight: '700', color: gpsStatus === 'tracking' ? '#34D399' : '#F87171' }}>
              GPS: {gpsStatus === 'tracking' ? 'Đang hoạt động' : 'Tín hiệu yếu'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 10, fontWeight: '600', color: !syncError ? '#94A3B8' : '#F87171' }}>
              Server: {syncError ? 'Lỗi kết nối' : (lastSyncedAt ? `${lastSyncedAt}` : 'Chờ đồng bộ')}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '600', color: '#64748B' }}>•</Text>
            <Text style={{ fontSize: 10, fontWeight: '600', color: '#94A3B8' }}>
              ~{currentAccuracy.toFixed(0)}m ({currentSpeed.toFixed(0)} km/h)
            </Text>
          </View>
        </View>

        {/* MAP VIEW */}
        <View style={styles.mapContainer}>
          <AmbulanceMap
            victimLocation={incidentLocation}
            hospitalLocation={hospitalLocation}
            ambulanceLocation={driverPos}
            destinationType={isTransportingPhase ? 'HOSPITAL' : 'SCENE'}
            followAmbulance={true}
          />

          <TouchableOpacity style={styles.externalMapBtn} onPress={openExternalMap} activeOpacity={0.8}>
            <Ionicons name="navigate" size={16} color="#022C22" />
            <Text style={styles.externalMapText}>Google Maps</Text>
          </TouchableOpacity>
        </View>

        {/* BOTTOM ACTION PANEL */}
        <ScrollView style={styles.bottomPanel} contentContainerStyle={styles.bottomContent}>
          {/* Destination Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.iconCircleRed}>
                <Ionicons name="location-sharp" size={18} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>ĐIỂM ĐẾN NHIỆM VỤ</Text>
                <Text style={styles.destinationTitle}>{destinationName}</Text>
                <Text style={styles.victimNoticeText}>
                  Thông tin nạn nhân chưa được cung cấp
                </Text>
              </View>
            </View>

            {mission.notes ? (
              <View style={styles.notesBox}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={14} color="#F59E0B" />
                <Text style={styles.notesText}>{mission.notes}</Text>
              </View>
            ) : null}
          </View>

          {/* ACTION BUTTONS BASED ON EXACT STATE MACHINE */}
          <View style={styles.actionSection}>
            {/* Status: DISPATCHED */}
            {currentStatus === 'DISPATCHED' && (
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.declineBtn]}
                  onPress={handleRejectMission}
                  disabled={loadingAction}
                >
                  <Text style={styles.declineBtnText}>TỪ CHỐI (POST /reject)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.primaryBtn]}
                  onPress={handleAcceptMission}
                  disabled={loadingAction}
                >
                  {loadingAction ? (
                    <ActivityIndicator size="small" color="#022C22" />
                  ) : (
                    <Text style={styles.primaryBtnText}>CHẤP NHẬN (POST /accept)</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Status: ACCEPTED */}
            {currentStatus === 'ACCEPTED' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.primaryBtn]}
                onPress={handleStartMission}
                disabled={loadingAction}
              >
                {loadingAction ? (
                  <ActivityIndicator size="small" color="#022C22" />
                ) : (
                  <>
                    <FontAwesome5 name="ambulance" size={16} color="#022C22" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryBtnText}>BẮT ĐẦU DI CHUYỂN (POST /start)</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Status: EN_ROUTE */}
            {currentStatus === 'EN_ROUTE' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.arriveBtn]}
                onPress={handleArriveScene}
                disabled={loadingAction}
              >
                {loadingAction ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="map-marker-check" size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.arriveBtnText}>ĐÃ ĐẾN HIỆN TRƯỜNG (POST /arrive-scene)</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Status: ARRIVED_SCENE */}
            {currentStatus === 'ARRIVED_SCENE' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.transportBtn]}
                onPress={handleStartTransport}
                disabled={loadingAction}
              >
                {loadingAction ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="hospital-building" size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.transportBtnText}>BẮT ĐẦU VẬN CHUYỂN (POST /start-transport)</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Status: TRANSPORTING */}
            {currentStatus === 'TRANSPORTING' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.arriveHospitalBtn]}
                onPress={handleArriveHospital}
                disabled={loadingAction}
              >
                {loadingAction ? (
                  <ActivityIndicator size="small" color="#022C22" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done-circle" size={20} color="#022C22" style={{ marginRight: 8 }} />
                    <Text style={styles.arriveHospitalBtnText}>ĐÃ ĐẾN BỆNH VIỆN (POST /arrive-hospital)</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Status: ARRIVED_HOSPITAL */}
            {currentStatus === 'ARRIVED_HOSPITAL' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.completeBtn]}
                onPress={handleCompleteMission}
                disabled={loadingAction}
              >
                {loadingAction ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check-circle" size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.completeBtnText}>HOÀN THÀNH NHIỆM VỤ (POST /complete)</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Status: COMPLETED / CANCELLED */}
            {(currentStatus === 'COMPLETED' || currentStatus === 'CANCELLED') && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.backBtnFull]}
                onPress={() => router.replace('/(driver)/dashboard')}
              >
                <Text style={styles.backBtnFullText}>QUAY VỀ DASHBOARD</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const getNavStatusBadgeStyle = (status: string) => {
  switch (status) {
    case 'DISPATCHED':
      return { backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: 'rgba(245, 158, 11, 0.4)' };
    case 'ACCEPTED':
    case 'EN_ROUTE':
      return { backgroundColor: 'rgba(56, 189, 248, 0.2)', borderColor: 'rgba(56, 189, 248, 0.4)' };
    case 'ARRIVED_SCENE':
    case 'TRANSPORTING':
      return { backgroundColor: 'rgba(167, 139, 250, 0.2)', borderColor: 'rgba(167, 139, 250, 0.4)' };
    case 'ARRIVED_HOSPITAL':
    case 'COMPLETED':
      return { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: 'rgba(16, 185, 129, 0.4)' };
    default:
      return { backgroundColor: 'rgba(148, 163, 184, 0.2)', borderColor: 'rgba(148, 163, 184, 0.4)' };
  }
};

const getNavStatusText = (status: string) => {
  switch (status) {
    case 'DISPATCHED':
      return 'CHỜ NHẬN';
    case 'ACCEPTED':
      return 'ĐÃ NHẬN';
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
    default:
      return status;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070A10',
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#070A10',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#070A10',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  errorSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
  },
  backBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  backBtnText: {
    color: '#022C22',
    fontSize: 12,
    fontWeight: '900',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  backIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleBox: {
    flex: 1,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    color: '#F8FAFC',
    fontSize: 9,
    fontWeight: '900',
  },
  mapContainer: {
    height: 240,
    position: 'relative',
  },
  externalMapBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 4,
  },
  externalMapText: {
    color: '#022C22',
    fontSize: 10,
    fontWeight: '900',
  },
  bottomPanel: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  bottomContent: {
    padding: 16,
    gap: 14,
  },
  infoCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircleRed: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
  },
  destinationTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  victimNoticeText: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 4,
    fontStyle: 'italic',
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 10,
    borderRadius: 8,
  },
  notesText: {
    color: '#F59E0B',
    fontSize: 11,
    flex: 1,
  },
  actionSection: {
    gap: 10,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#10B981',
  },
  primaryBtnText: {
    color: '#022C22',
    fontSize: 12,
    fontWeight: '900',
  },
  declineBtn: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  declineBtnText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '900',
  },
  arriveBtn: {
    backgroundColor: '#38BDF8',
  },
  arriveBtnText: {
    color: '#022C22',
    fontSize: 12,
    fontWeight: '900',
  },
  transportBtn: {
    backgroundColor: '#8B5CF6',
  },
  transportBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },
  arriveHospitalBtn: {
    backgroundColor: '#F59E0B',
  },
  arriveHospitalBtnText: {
    color: '#022C22',
    fontSize: 12,
    fontWeight: '900',
  },
  completeBtn: {
    backgroundColor: '#10B981',
  },
  completeBtnText: {
    color: '#022C22',
    fontSize: 12,
    fontWeight: '900',
  },
  backBtnFull: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  backBtnFullText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },
});
