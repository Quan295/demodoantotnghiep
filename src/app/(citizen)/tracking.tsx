import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Linking,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '@/services/api';
import { CallStatusResponse, EmergencyCall, LatLng, TrackingUpdate } from '@/types';
import AmbulanceMap from '@/components/AmbulanceMap';

type CaseStatus = 'PENDING' | 'DISPATCHED' | 'EN_ROUTE' | 'ARRIVED' | 'COMPLETED';

export default function TrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const victimLat = params.lat ? parseFloat(params.lat as string) : 21.0091;
  const victimLng = params.lng ? parseFloat(params.lng as string) : 105.8247;
  const callId = params.id as string | undefined;
  const missionId = (params.missionId as string) || (params.dispatchMissionId as string) || callId;
  const simId = params.simulationId as string | undefined;

  const [status, setStatus] = useState<CaseStatus>('PENDING');
  const [eta, setEta] = useState<number>(4);
  const [distance, setDistance] = useState<number>(1.2);
  const [progress, setProgress] = useState<number>(0);
  const [ambulancePos, setAmbulancePos] = useState<LatLng | undefined>(undefined);
  const [callDetail, setCallDetail] = useState<EmergencyCall | null>(null);
  const [callStatusData, setCallStatusData] = useState<CallStatusResponse | null>(null);
  const [trackUpdate, setTrackUpdate] = useState<TrackingUpdate | null>(null);

  const slideAnim = useRef(new Animated.Value(400)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  }, [pulseAnim, slideAnim]);

  // Polling tracking updates (GET /calls/{id}/tracking) & Call Status (GET /calls/{id}/status)
  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        let update: TrackingUpdate | null = null;
        if (callId) {
          try {
            update = await api.getCallTracking(callId);
          } catch {
            if (simId) update = await api.getSimulationTracking(simId);
            else if (missionId) update = await api.getSimulationTrackingByMission(missionId);
          }
        } else if (simId) {
          update = await api.getSimulationTracking(simId);
        } else if (missionId) {
          update = await api.getSimulationTrackingByMission(missionId);
        }

        if (!update || cancelled) return;
        setTrackUpdate(update);

        const simHasLocation =
          update.currentLocation &&
          (update.currentLocation.lat !== 0 || update.currentLocation.lng !== 0);

        if (simHasLocation) {
          setAmbulancePos(update.currentLocation);
        }

        if (typeof update.estimatedTimeArrival === 'number') {
          setEta(Math.max(0, Math.ceil(update.estimatedTimeArrival / 60)));
        }
        if (typeof update.distanceTraveled === 'number') {
          setDistance(Math.max(0, 1.2 - update.distanceTraveled));
        }
        if (typeof update.progress === 'number') {
          setProgress(update.progress);
        }

        // Map status to UI state
        switch (update.status) {
          case 'RUNNING':
            setStatus('EN_ROUTE');
            if (!simHasLocation) {
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
            setDistance(0);
            setProgress(100);
            break;
          case 'CREATED':
          case 'PAUSED':
          default:
            if (simHasLocation) {
              setStatus('EN_ROUTE');
            } else {
              setStatus('PENDING');
            }
            break;
        }
      } catch (e) {
        console.warn('[CitizenTracking] Tracking poll warning:', e);
      }
    };

    // Fetch call details & status
    const fetchCallInfo = async () => {
      if (!callId) return;
      try {
        const [detail, statusRes] = await Promise.allSettled([
          api.getCallDetails(callId),
          api.getCallStatus(callId),
        ]);

        if (cancelled) return;
        if (detail.status === 'fulfilled' && detail.value) {
          setCallDetail(detail.value);
          const stUpper = (detail.value.status || '').toUpperCase();
          if (stUpper === 'ASSIGNED' || stUpper === 'DISPATCHED') {
            setStatus(prev => (prev === 'PENDING' ? 'DISPATCHED' : prev));
          } else if (stUpper === 'EN_ROUTE' || stUpper === 'RUNNING') {
            setStatus('EN_ROUTE');
          } else if (stUpper === 'ARRIVED' || stUpper === 'ARRIVED_SCENE') {
            setStatus('ARRIVED');
          } else if (stUpper === 'COMPLETED') {
            setStatus('COMPLETED');
          }
        }
        if (statusRes.status === 'fulfilled' && statusRes.value) {
          setCallStatusData(statusRes.value);
        }
      } catch (e) {
        console.warn('[CitizenTracking] Failed to fetch call details:', e);
      }
    };

    fetchCallInfo();
    poll();
    interval = setInterval(() => {
      poll();
      fetchCallInfo();
    }, 2000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simId, missionId, callId]);

  const driverPhone =
    callStatusData?.assignedUnit?.driverPhone ||
    callDetail?.assignedDriverPhone ||
    '0988.115.115';

  const driverName =
    callStatusData?.assignedUnit?.driverName ||
    callDetail?.assignedDriverName ||
    'Bác sĩ / Tài xế Hùng';

  const extractUnitPlate = () => {
    const unit = callStatusData?.assignedUnit;
    const unitExt: any = typeof unit?.extended_attributes === 'string'
      ? (() => { try { return JSON.parse(unit.extended_attributes); } catch { return {}; } })()
      : unit?.extended_attributes || unit?.extendedAttributes;

    const callExt: any = typeof callDetail?.extended_attributes === 'string'
      ? (() => { try { return JSON.parse(callDetail.extended_attributes); } catch { return {}; } })()
      : callDetail?.extended_attributes || callDetail?.extendedAttributes;

    return (
      unit?.vehiclePlate ||
      unitExt?.license_plate ||
      unitExt?.licensePlate ||
      unitExt?.plate_number ||
      callExt?.license_plate ||
      callExt?.licensePlate ||
      callDetail?.assignedVehiclePlate ||
      '29A-115.88'
    );
  };

  const vehiclePlate = extractUnitPlate();

  const hospitalName =
    callStatusData?.assignedUnit?.hospitalName ||
    callDetail?.assignedHospital ||
    'Bệnh viện Cấp Cứu 115 - Chi nhánh Đống Đa';

  const handleCallDriver = () => {
    Linking.openURL(`tel:${driverPhone}`).catch(() => {
      Alert.alert('Liên hệ tài xế', `Số điện thoại tài xế cứu thương: ${driverPhone}`);
    });
  };

  const handleCall115 = () => {
    Linking.openURL('tel:115').catch(() => {
      Alert.alert('Tổng đài 115', 'Hotline Cấp cứu 115: 115');
    });
  };

  const victimLocation: LatLng = { lat: victimLat, lng: victimLng };

  const getStatusColor = (s: CaseStatus) => {
    if (status === s) return '#EF4444';
    if (
      status === 'ARRIVED' ||
      status === 'COMPLETED' ||
      (status === 'EN_ROUTE' && (s === 'PENDING' || s === 'DISPATCHED'))
    ) {
      return '#10B981';
    }
    return '#334155';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Map Area */}
      <View style={styles.mapWrapper}>
        <AmbulanceMap
          victimLocation={victimLocation}
          ambulanceLocation={ambulancePos}
          style={styles.map}
        />
      </View>

      {/* Top Floating Bar */}
      <View style={styles.topFloatHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/(citizen)/sos')}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.topCallIdBadge}>
          <View style={styles.livePulseDot} />
          <Text style={styles.topCallIdText}>
            YÊU CẦU #{callId || 'SOS-115'} • THEO DÕI TRỰC TIẾP
          </Text>
        </View>

        <TouchableOpacity style={styles.emergency115Btn} onPress={handleCall115}>
          <Text style={styles.emergency115Text}>115</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet Modal */}
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            transform: [{ translateY: slideAnim }],
            paddingBottom: Platform.OS === 'ios' ? 36 : 20,
          },
        ]}
      >
        <View style={styles.sheetHandle} />

        {/* ETA & Distance Row */}
        <View style={styles.sheetHeader}>
          <View style={styles.etaBlock}>
            <Text style={styles.etaLabel}>DỰ KIẾN TIẾP CẬN</Text>
            <Text style={styles.etaValue}>
              {status === 'ARRIVED' || status === 'COMPLETED'
                ? 'ĐÃ ĐẾN HIỆN TRƯỜNG'
                : status === 'PENDING'
                ? 'ĐANG TÌM XE...'
                : `${eta} PHÚT (${distance.toFixed(1)} km)`}
            </Text>

            {status !== 'PENDING' && status !== 'ARRIVED' && (
              <View style={styles.progressRow}>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${Math.min(100, progress)}%` }]} />
                </View>
                <Text style={styles.progressPct}>{progress.toFixed(0)}%</Text>
              </View>
            )}
          </View>

          <TouchableOpacity onPress={handleCallDriver} style={styles.callDriverFab} activeOpacity={0.8}>
            <Ionicons name="call" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Step-by-Step Progress Timeline */}
        <View style={styles.timeline}>
          <TimelineItem
            title="1. Đã tiếp nhận yêu cầu cấp cứu"
            time={callDetail?.createdAt ? new Date(callDetail.createdAt).toLocaleTimeString('vi-VN') : 'Vừa xong'}
            status={status === 'PENDING' ? 'active' : 'done'}
            color={getStatusColor('PENDING')}
          />
          <TimelineItem
            title="2. Xe cứu thương đang di chuyển tới"
            time={
              status === 'EN_ROUTE' || status === 'DISPATCHED'
                ? `Vận tốc: ${trackUpdate?.speed ? `${trackUpdate.speed.toFixed(0)} km/h` : '38 km/h'}`
                : ''
            }
            status={status === 'EN_ROUTE' || status === 'DISPATCHED' ? 'active' : status === 'ARRIVED' ? 'done' : 'pending'}
            color={getStatusColor('EN_ROUTE')}
          />
          <TimelineItem
            title="3. Đã tiếp cận nạn nhân tại hiện trường"
            time={status === 'ARRIVED' ? 'Đang sơ cứu' : ''}
            status={status === 'ARRIVED' ? 'active' : 'pending'}
            color={getStatusColor('ARRIVED')}
            isLast
          />
        </View>

        {/* Assigned Ambulance & Driver Card */}
        <View style={styles.driverInfoCard}>
          <View style={styles.driverAvatarCircle}>
            <MaterialCommunityIcons name="ambulance" size={22} color="#10B981" />
          </View>

          <View style={styles.driverDetails}>
            <View style={styles.driverNameRow}>
              <Text style={styles.driverName}>{driverName}</Text>
              <View style={styles.plateTag}>
                <Text style={styles.plateTagText}>{vehiclePlate}</Text>
              </View>
            </View>
            <Text style={styles.hospitalText} numberOfLines={1}>
              <Ionicons name="business-outline" size={11} color="#94A3B8" /> {hospitalName}
            </Text>
          </View>

          <TouchableOpacity style={styles.contactDriverBtn} onPress={handleCallDriver}>
            <Ionicons name="call-outline" size={16} color="#34D399" />
            <Text style={styles.contactDriverText}>GỌI XE</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const TimelineItem = ({
  title,
  time,
  status,
  color,
  isLast,
}: {
  title: string;
  time?: string;
  status: 'active' | 'done' | 'pending';
  color: string;
  isLast?: boolean;
}) => (
  <View style={styles.timelineItem}>
    <View style={styles.timelineLeft}>
      <View style={[styles.timelineDot, { backgroundColor: color }]} />
      {!isLast && (
        <View
          style={[
            styles.timelineLine,
            { backgroundColor: status === 'done' ? '#10B981' : '#334155' },
          ]}
        />
      )}
    </View>
    <View style={styles.timelineRight}>
      <Text
        style={[
          styles.timelineTitle,
          { color: status === 'pending' ? '#64748B' : '#F8FAFC', fontWeight: status === 'active' ? '800' : '600' },
        ]}
      >
        {title}
      </Text>
      {time ? <Text style={styles.timelineTime}>{time}</Text> : null}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070A10',
  },
  mapWrapper: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  topFloatHeader: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 40 : 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 999,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  topCallIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  topCallIdText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emergency115Btn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  emergency115Text: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    elevation: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  etaBlock: {
    flex: 1,
    marginRight: 12,
  },
  etaLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  etaValue: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  progressRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 5,
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
    width: 32,
    textAlign: 'right',
  },
  callDriverFab: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  timeline: {
    marginBottom: 16,
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 44,
  },
  timelineLeft: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 3,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 3,
  },
  timelineRight: {
    flex: 1,
    marginLeft: 10,
  },
  timelineTitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  timelineTime: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
  driverInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  driverAvatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  driverDetails: {
    flex: 1,
  },
  driverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  driverName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  plateTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  plateTagText: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '800',
  },
  hospitalText: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
  contactDriverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  contactDriverText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '900',
  },
});
