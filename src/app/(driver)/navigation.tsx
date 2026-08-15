import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/services/api';
import { globalConfig } from '@/services/config';
import { AmbulanceSimulation, AmbulanceSimulationStatus, DriverResource, LatLng, TrackingUpdate } from '@/types';
import AmbulanceMap from '@/components/AmbulanceMap';

type MissionStatus = 'EN_ROUTE' | 'ARRIVED_SCENE';

export default function NavigationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // --- Route params ---
  const victimLat = params.victimLat ? parseFloat(params.victimLat as string) : 21.028511;
  const victimLng = params.victimLng ? parseFloat(params.victimLng as string) : 105.804817;
  const victimName = (params.victimName as string) || 'Nguyễn Văn A';
  const victimPhone = (params.victimPhone as string) || '0987.654.321';
  const victimAddress = (params.victimAddress as string) || '12 Chùa Bộc, Đống Đa, Hà Nội';
  const victimInjury = (params.victimInjury as string) || 'Tai nạn giao thông - Chấn thương chân';
  const missionId = (params.missionId as string) || (params.dispatchMissionId as string) || undefined;

  // --- Driver Resource state ---
  const [driverResource, setDriverResource] = useState<DriverResource | null>(null);

  // --- Simulation state ---
  const [simulation, setSimulation] = useState<AmbulanceSimulation | null>(null);
  const [simStatus, setSimStatus] = useState<AmbulanceSimulationStatus>('CREATED');
  const [driverPos, setDriverPos] = useState<LatLng>({
    lat: victimLat + 0.008,
    lng: victimLng + 0.006,
  });

  // --- UI state ---
  const [status, setStatus] = useState<MissionStatus>('EN_ROUTE');
  const [distance, setDistance] = useState<number>(1.2);
  const [eta, setEta] = useState<number>(8);
  const [progress, setProgress] = useState<number>(0);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simIdRef = useRef<string | null>(null);
  const resourceIdRef = useRef<string | number>('1042');

  // --- Init: fetch resource, create + start simulation, start polling tracking ---
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        // Fetch current assigned ambulance resource
        try {
          const res = await api.getDriverResource();
          if (res) {
            setDriverResource(res);
            resourceIdRef.current = res.id || '1042';
            api.updateDriverResourceStatus(resourceIdRef.current, 'EN_ROUTE').catch(() => {});
          }
        } catch (rErr) {
          console.warn('[DriverNav] Could not fetch driver resource:', rErr);
        }

        const startLoc: LatLng = {
          lat: victimLat + 0.008,
          lng: victimLng + 0.006,
        };
        const endLoc: LatLng = { lat: victimLat, lng: victimLng };

        const currentUser = globalConfig.getCurrentUser();
        const created = await api.createAmbulanceSimulation({
          missionId,
          dispatchMissionId: missionId,
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
        api.updateDriverResourceLocation(resourceIdRef.current, {
          latitude: startLoc.lat,
          longitude: startLoc.lng,
          speed: 40,
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

            // Sync with PATCH /driver-resource/{id}/location
            api.updateDriverResourceLocation(resourceIdRef.current, {
              latitude: track.currentLocation.lat,
              longitude: track.currentLocation.lng,
              speed: track.speed || 0,
              heading: track.heading || 0,
            }).catch(() => {});

            if (typeof track.distanceTraveled === 'number') {
              const startDistance = 1.2;
              setDistance(Math.max(0.01, startDistance - track.distanceTraveled));
            }
            if (typeof track.estimatedTimeArrival === 'number') {
              setEta(Math.max(0, Math.ceil(track.estimatedTimeArrival / 60)));
            }
            if (typeof track.progress === 'number') {
              setProgress(track.progress);
              if (track.progress >= 98) {
                setDistance(0);
                setEta(0);
                setDriverPos({ lat: victimLat, lng: victimLng });
              }
            }
          } catch (e) {
            console.warn('[DriverNav] Tracking poll failed', e);
          }
        }, 1500);
      } catch (e) {
        console.error('[DriverNav] Failed to start simulation', e);
        if (!cancelled) {
          Alert.alert('Lỗi', 'Không thể khởi tạo mô phỏng hành trình. Vui lòng thử lại.');
        }
      }
    };

    init();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleArrivedScene = () => {
    setStatus('ARRIVED_SCENE');
    setDistance(0);
    setEta(0);
    setDriverPos({ lat: victimLat, lng: victimLng });

    // Update resource status to ARRIVED
    api.updateDriverResourceStatus(resourceIdRef.current, 'ARRIVED_SCENE').catch(() => {});
    api.updateDriverResourceLocation(resourceIdRef.current, {
      latitude: victimLat,
      longitude: victimLng,
      speed: 0,
      heading: 0,
    }).catch(() => {});

    if (simIdRef.current) {
      api.stopAmbulanceSimulation(simIdRef.current).catch(() => {});
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
    Alert.alert(
      'Cập Nhật Trạng Thái',
      'Đã báo cáo trạng thái "ĐÃ ĐẾN HIỆN TRƯỜNG" về trung tâm tổng đài điều phối qua hệ thống PostGIS.',
      [{ text: 'Đóng' }]
    );
  };

  const handleCompleteMission = () => {
    Alert.alert(
      'Hoàn Thành Ca Cứu Trợ',
      'Xác nhận bệnh nhân đã được sơ cứu và chuyển viện an toàn? Xe sẽ chuyển về trạng thái SẴN SÀNG.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'XÁC NHẬN HOÀN THÀNH',
          onPress: async () => {
            if (simIdRef.current) {
              api.stopAmbulanceSimulation(simIdRef.current).catch(() => {});
            }
            await api.updateDriverResourceStatus(resourceIdRef.current, 'AVAILABLE').catch(() => {});
            router.replace('/(driver)/dashboard');
          },
        },
      ]
    );
  };

  const openGoogleMaps = () => {
    const latLng = `${victimLat},${victimLng}`;
    const label = `Nạn nhân: ${victimName}`;
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latLng}`,
      android: `geo:0,0?q=${latLng}(${label})`,
      web: `https://www.google.com/maps/search/?api=1&query=${latLng}`,
    });
    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert('Lỗi', 'Không thể mở ứng dụng bản đồ bên ngoài.');
      });
    }
  };

  const callVictim = () => {
    Linking.openURL(`tel:${victimPhone}`).catch(() => {});
  };

  const victimLocation: LatLng = { lat: victimLat, lng: victimLng };
  const licensePlate = driverResource?.licensePlate || '29A-115.88';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C0E12" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>

        {/* Floating Top Header (Patient & Mission Details) */}
        <View style={styles.topFloatCard}>
          <View style={styles.topCardRow}>
            <View style={styles.locationBadge}>
              <MaterialCommunityIcons name="ambulance" size={14} color="#FFF" />
              <Text style={styles.badgeText}>
                {licensePlate} • {distance.toFixed(1)} km ({eta} ph)
              </Text>
            </View>
            <TouchableOpacity onPress={openGoogleMaps} style={styles.googleMapsBtn}>
              <Ionicons name="navigate-circle-outline" size={14} color="#34D399" style={{ marginRight: 4 }} />
              <Text style={styles.googleMapsBtnText}>MỞ GOOGLE MAPS</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.addressText}>{victimAddress}</Text>
          <Text style={styles.injuryText} numberOfLines={1}>
            Sự cố: {victimInjury}
          </Text>
          <View style={styles.progressRow}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${Math.min(100, progress)}%` }]} />
            </View>
            <Text style={styles.progressPct}>{progress.toFixed(0)}%</Text>
          </View>
        </View>

        {/* Map Area */}
        <View style={styles.mapContainer}>
          <AmbulanceMap
            victimLocation={victimLocation}
            ambulanceLocation={driverPos}
            route={simulation?.route}
          />
        </View>

        {/* Bottom Floating Mission Control Card */}
        <View style={[styles.bottomStatusCard, { paddingBottom: Platform.OS === 'ios' ? 36 : 20 }]}>
          <View style={styles.patientRow}>
            <View style={styles.patientInfo}>
              <Text style={styles.patientName}>{victimName}</Text>
              <Text style={styles.patientPhone}>{victimPhone}</Text>
            </View>

            <TouchableOpacity
              onPress={callVictim}
              style={[styles.callButton, { backgroundColor: '#1E293B' }]}
            >
              <Ionicons name="call" size={16} color="#34D399" />
              <Text style={styles.callButtonText}>GỌI NẠN NHÂN</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.simStatusRow}>
            <MaterialCommunityIcons
              name={
                simStatus === 'RUNNING'
                  ? 'play-circle'
                  : simStatus === 'COMPLETED'
                  ? 'check-circle'
                  : simStatus === 'STOPPED'
                  ? 'stop-circle'
                  : 'circle-outline'
              }
              size={14}
              color={
                simStatus === 'RUNNING'
                  ? '#34D399'
                  : simStatus === 'COMPLETED'
                  ? '#A78BFA'
                  : simStatus === 'STOPPED'
                  ? '#F87171'
                  : '#94A3B8'
              }
            />
            <Text style={styles.simStatusLabel}>
              POSTGIS GPS: {driverPos.lat.toFixed(5)}, {driverPos.lng.toFixed(5)}
            </Text>
            <Text style={styles.simIdLabel} numberOfLines={1}>
              STATUS: {status}
            </Text>
          </View>

          {/* Action Button Workflow */}
          {status === 'EN_ROUTE' ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleArrivedScene}
              style={[styles.mainButton, { backgroundColor: '#10B981' }]}
            >
              <FontAwesome5 name="map-marker-alt" size={14} color="#022C22" style={styles.btnIcon} />
              <Text style={styles.mainButtonText}>ĐÃ ĐẾN HIỆN TRƯỜNG CẤP CỨU</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleCompleteMission}
              style={[styles.mainButton, { backgroundColor: '#EF4444' }]}
            >
              <FontAwesome5 name="flag-checkered" size={14} color="#FFF" style={styles.btnIcon} />
              <Text style={[styles.mainButtonText, { color: '#FFF' }]}>HOÀN THÀNH CA CỨU TRỢ</Text>
            </TouchableOpacity>
          )}
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070A10',
  },
  safeArea: {
    flex: 1,
  },
  topFloatCard: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 18,
    padding: 16,
    zIndex: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
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
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  googleMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  googleMapsBtnText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
  },
  addressText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  injuryText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  progressRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#334155',
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
    fontWeight: '900',
    width: 36,
    textAlign: 'right',
  },
  mapContainer: {
    flex: 1,
  },
  bottomStatusCard: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
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
    fontWeight: '800',
  },
  patientPhone: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  callButtonText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 12,
  },
  simStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  simStatusLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
  },
  simIdLabel: {
    flex: 1,
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
  },
  mainButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    elevation: 3,
  },
  btnIcon: {
    marginRight: 4,
  },
  mainButtonText: {
    color: '#022C22',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
