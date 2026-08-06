import AmbulanceMap from '@/components/AmbulanceMap';
import { api } from '@/services/api';
import { LatLng, TrackingUpdate } from '@/types';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Linking,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

type CaseStatus = 'PENDING' | 'DISPATCHED' | 'ARRIVED';

export default function TrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const victimLat = params.lat ? parseFloat(params.lat as string) : 21.028511;
  const victimLng = params.lng ? parseFloat(params.lng as string) : 105.804817;
  const callId = params.id as string | undefined;
  const missionId = (params.missionId as string) || (params.dispatchMissionId as string) || callId;
  const simId = params.simulationId as string | undefined;

  const [status, setStatus] = useState<CaseStatus>('PENDING');
  const [eta, setEta] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [ambulancePos, setAmbulancePos] = useState<LatLng | undefined>(undefined);
  const [caseDetail, setCaseDetail] = useState<any>(null);
  const [trackUpdate, setTrackUpdate] = useState<TrackingUpdate | null>(null);

  const slideAnim = useRef(new Animated.Value(400)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll tracking updates via ambulance-simulation API (by-mission or by-id)
  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        let update: TrackingUpdate | null = null;
        if (simId) {
          update = await api.getSimulationTracking(simId);
        } else if (missionId) {
          update = await api.getSimulationTrackingByMission(missionId);
        }
        if (!update || cancelled) return;

        setTrackUpdate(update);
        const simHasLocation = update.currentLocation && (update.currentLocation.lat !== 0 || update.currentLocation.lng !== 0);

        if (simHasLocation) {
          setAmbulancePos(update.currentLocation);
        }

        if (typeof update.estimatedTimeArrival === 'number') {
          setEta(Math.max(0, Math.ceil(update.estimatedTimeArrival / 60)));
        }
        if (typeof update.progress === 'number') {
          setProgress(update.progress);
        }

        // Translate simulation status into UI case status
        switch (update.status) {
          case 'RUNNING':
            setStatus('DISPATCHED');
            if (!simHasLocation) {
              // Fallback: show ambulance offset if no real position yet
              setAmbulancePos({
                lat: victimLat + 0.004,
                lng: victimLng + 0.003,
              });
            }
            break;
          case 'COMPLETED':
          case 'STOPPED':
            setStatus('ARRIVED');
            setAmbulancePos({ lat: victimLat, lng: victimLng });
            setEta(0);
            setProgress(100);
            break;
          case 'CREATED':
          case 'PAUSED':
          default:
            if (simHasLocation) {
              setStatus('DISPATCHED');
            } else {
              setStatus('PENDING');
            }
            break;
        }
      } catch (e) {
        console.warn('[CitizenTracking] Poll failed', e);
      }
    };

    // Also fetch call details if available
    const fetchCall = async () => {
      if (!callId) return;
      try {
        const detail = await api.getCallDetail(callId);
        if (cancelled) return;
        setCaseDetail(detail);
        if (detail.status === 'assigned' || detail.status === 'in-progress') {
          if (status === 'PENDING') setStatus('DISPATCHED');
        } else if (detail.status === 'completed') {
          setStatus('ARRIVED');
        }
      } catch (e) {
        console.warn('[CitizenTracking] Failed call detail', e);
      }
    };

    fetchCall();
    poll();
    interval = setInterval(poll, 1800);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simId, missionId, callId]);

  const getStatusColor = (s: CaseStatus) => {
    if (status === s) return '#F04438';
    if (status === 'ARRIVED' || (status === 'DISPATCHED' && s === 'PENDING')) return '#32D583';
    return '#1F2A37';
  };

  const victimLocation: LatLng = { lat: victimLat, lng: victimLng };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.mapWrapper}>
        <AmbulanceMap
          victimLocation={victimLocation}
          ambulanceLocation={ambulancePos}
          style={styles.map}
        />
      </View>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.replace('/(citizen)/sos')}
      >
        <Ionicons name="arrow-back" size={24} color="#FFF" />
      </TouchableOpacity>

      <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: slideAnim }], paddingBottom: Platform.OS === 'ios' ? 40 : 24 }]}>
        <View style={styles.sheetHandle} />

        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.etaLabel}>THỜI GIAN DỰ KIẾN</Text>
            <Text style={styles.etaValue}>
              {status === 'PENDING' ? '--' : `${eta} PHÚT`}
            </Text>
            {status !== 'PENDING' ? (
              <View style={styles.progressRow}>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${Math.min(100, progress)}%` }]} />
                </View>
                <Text style={styles.progressPct}>{progress.toFixed(0)}%</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => Linking.openURL('tel:115')} style={styles.callFab}>
            <Ionicons name="call" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.timeline}>
          <TimelineItem
            title="Đã gửi yêu cầu"
            time="Vừa xong"
            status={status === 'PENDING' ? 'active' : 'done'}
            color={getStatusColor('PENDING')}
          />
          <TimelineItem
            title="Xe cứu thương đang đến"
            time={status === 'DISPATCHED' ? `Đang di chuyển • ${trackUpdate?.speed ? `${trackUpdate.speed} km/h` : ''}` : ''}
            status={status === 'DISPATCHED' ? 'active' : status === 'ARRIVED' ? 'done' : 'pending'}
            color={getStatusColor('DISPATCHED')}
          />
          <TimelineItem
            title="Đã đến hiện trường"
            time={trackUpdate?.simulationId ? `Sim: ${trackUpdate.simulationId.slice(-6)}` : ''}
            status={status === 'ARRIVED' ? 'active' : 'pending'}
            color={getStatusColor('ARRIVED')}
            isLast
          />
        </View>

        <View style={styles.driverInfo}>
          <View style={styles.driverAvatar}>
            <FontAwesome5 name="userMd" size={20} color="#98A2B3" />
          </View>
          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>
              {status === 'PENDING'
                ? 'Đang tìm xe...'
                : caseDetail?.assignedDriverId
                  ? `Tài xế: ${caseDetail.assignedDriverId}`
                  : 'Bác sĩ Lê Văn M'}
            </Text>
            <Text style={styles.vehicleInfo}>
              {status === 'PENDING'
                ? 'Hệ thống đang điều phối'
                : caseDetail?.assignedVehicleId
                  ? `Xe biển số: ${caseDetail.assignedVehicleId}`
                  : 'Xe 29-A1 115.88 • Đội 115 Đống Đa'}
            </Text>
          </View>
          {status !== 'PENDING' && (
            <MaterialCommunityIcons name="message-text" size={24} color="#F04438" />
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const TimelineItem = ({ title, time, status, color, isLast }: any) => (
  <View style={styles.timelineItem}>
    <View style={styles.timelineLeft}>
      <View style={[styles.timelineDot, { backgroundColor: color }]} />
      {!isLast && <View style={[styles.timelineLine, { backgroundColor: status === 'done' ? '#32D583' : '#1F2A37' }]} />}
    </View>
    <View style={styles.timelineRight}>
      <Text style={[styles.timelineTitle, { color: status === 'pending' ? '#475467' : '#F9FAFB' }]}>{title}</Text>
      {time ? <Text style={styles.timelineTime}>{time}</Text> : null}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090B0F',
  },
  mapWrapper: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#111827',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
    gap: 16,
  },
  etaLabel: {
    color: '#475467',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  etaValue: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 4,
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
  callFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F04438',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
  timeline: {
    marginBottom: 24,
  },
  timelineItem: {
    flexDirection: 'row',
    height: 60,
  },
  timelineLeft: {
    width: 30,
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    zIndex: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  timelineRight: {
    flex: 1,
    marginLeft: 16,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  timelineTime: {
    color: '#98A2B3',
    fontSize: 12,
    marginTop: 2,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1F2A37',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverDetails: {
    flex: 1,
    marginLeft: 16,
  },
  driverName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  vehicleInfo: {
    color: '#98A2B3',
    fontSize: 12,
    marginTop: 2,
  },
});
