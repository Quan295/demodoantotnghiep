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
import { AmbulanceSimulation, AmbulanceSimulationStatus, LatLng, TrackingUpdate } from '@/types';
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

  // --- Init: create + start simulation, start polling tracking ---
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
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
          vehicleId: undefined,
          startLocation: startLoc,
          endLocation: endLoc,
        });

        if (cancelled) return;
        setSimulation(created);
        simIdRef.current = created.id;
        setDriverPos({ ...startLoc });

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
            if (typeof track.distanceTraveled === 'number') {
              // Reverse: how much left ~ start*1.2 minus traveled
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
      // Try to stop simulation on exit (best effort)
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
    if (simIdRef.current) {
      api.stopAmbulanceSimulation(simIdRef.current).catch(() => {});
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
    Alert.alert(
      'Cập Nhật Trạng Thái',
      'Đã báo cáo trạng thái "ĐÃ ĐẾN HIỆN TRƯỜNG" về trung tâm tổng đài điều phối.',
      [{ text: 'Đóng' }]
    );
  };

  const handleCompleteMission = () => {
    Alert.alert(
      'Hoàn Thành Ca Cứu Trợ',
      'Xác nhận bệnh nhân đã được sơ cứu hoặc đưa lên xe cấp cứu chuyển viện?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'XÁC NHẬN HOÀN THÀNH',
          onPress: () => {
            if (simIdRef.current) {
              api.stopAmbulanceSimulation(simIdRef.current).catch(() => {});
            }
            router.replace('/(driver)/dashboard');
          }
        }
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C0E12" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>

        {/* Floating Top Header (Patient Details) */}
        <View style={styles.topFloatCard}>
          <View style={styles.topCardRow}>
            <View style={styles.locationBadge}>
              <MaterialCommunityIcons name="map-marker-distance" size={14} color="#FFF" />
              <Text style={styles.badgeText}>
                {distance.toFixed(1)} km ({eta} ph)
              </Text>
            </View>
            <TouchableOpacity onPress={openGoogleMaps} style={styles.googleMapsBtn}>
              <Text style={styles.googleMapsBtnText}>MỞ BẢN ĐỒ NGOÀI</Text>
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
              style={[styles.callButton, { backgroundColor: '#151B26' }]}
            >
              <Ionicons name="call" size={18} color="#FFF" />
              <Text style={styles.callButtonText}>GỌI ĐIỆN</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.simStatusRow}>
            <MaterialCommunityIcons
              name={simStatus === 'RUNNING' ? 'play-circle' : simStatus === 'COMPLETED' ? 'check-circle' : simStatus === 'STOPPED' ? 'stop-circle' : 'circle-outline'}
              size={14}
              color={simStatus === 'RUNNING' ? '#32D583' : simStatus === 'COMPLETED' ? '#A78BFA' : simStatus === 'STOPPED' ? '#F04438' : '#98A2B3'}
            />
            <Text style={styles.simStatusLabel}>
              SIMULATION: {simStatus}
            </Text>
            {simulation?.id ? (
              <Text style={styles.simIdLabel} numberOfLines={1}>
                ID: {simulation.id}
              </Text>
            ) : null}
          </View>

          {/* Action Button Workflow */}
          {status === 'EN_ROUTE' ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleArrivedScene}
              style={[styles.mainButton, { backgroundColor: '#12B76A' }]}
            >
              <FontAwesome5 name="check" size={14} color="#FFF" style={styles.btnIcon} />
              <Text style={styles.mainButtonText}>ĐÃ ĐẾN HIỆN TRƯỜNG</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleCompleteMission}
              style={[styles.mainButton, { backgroundColor: '#F04438' }]}
            >
              <FontAwesome5 name="flag-checkered" size={14} color="#FFF" style={styles.btnIcon} />
              <Text style={styles.mainButtonText}>HOÀN THÀNH CA CỨU HỘ</Text>
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
    backgroundColor: '#0C0E12',
  },
  safeArea: {
    flex: 1,
  },
  topFloatCard: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    backgroundColor: '#151B26',
    borderRadius: 18,
    padding: 16,
    zIndex: 999,
    borderWidth: 1.5,
    borderColor: '#1F2A37',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
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
    backgroundColor: '#F04438',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  googleMapsBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#1F2A37',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  googleMapsBtnText: {
    color: '#D0D5DD',
    fontSize: 10,
    fontWeight: '800',
  },
  addressText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  injuryText: {
    color: '#98A2B3',
    fontSize: 12,
    fontWeight: '500',
  },
  progressRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#1F2A37',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#32D583',
    borderRadius: 3,
  },
  progressPct: {
    color: '#32D583',
    fontSize: 10,
    fontWeight: '900',
    width: 36,
    textAlign: 'right',
  },
  mapContainer: {
    flex: 1,
  },
  victimMarkerOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(240, 68, 56, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F04438',
  },
  victimMarkerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F04438',
  },
  ambulanceMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#32D583',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  bottomStatusCard: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: '#151B26',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#1F2A37',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
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
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  patientPhone: {
    color: '#98A2B3',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F2A37',
  },
  callButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#1F2A37',
    marginVertical: 14,
  },
  simStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  simStatusLabel: {
    color: '#98A2B3',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  simIdLabel: {
    flex: 1,
    color: '#475467',
    fontSize: 10,
    fontWeight: '700',
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
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
