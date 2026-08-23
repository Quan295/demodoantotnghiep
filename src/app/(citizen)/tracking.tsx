import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '@/services/api';
import { CallStatusResponse, CallTrackingResponse, EmergencyCall, LatLng } from '@/types';
import AmbulanceMap from '@/components/AmbulanceMap';

type CaseStatus = 
  | 'PENDING' 
  | 'DISPATCHED' 
  | 'EN_ROUTE' 
  | 'ARRIVED_SCENE' 
  | 'TRANSPORTING' 
  | 'ARRIVED_HOSPITAL' 
  | 'COMPLETED';

export default function TrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const victimLat = params.lat ? parseFloat(params.lat as string) : 21.0091;
  const victimLng = params.lng ? parseFloat(params.lng as string) : 105.8247;
  const callId = params.id as string | undefined;

  const [status, setStatus] = useState<CaseStatus>('PENDING');
  const [eta, setEta] = useState<number>(4);
  const [distance, setDistance] = useState<number>(1.2);
  const [progress, setProgress] = useState<number>(0);
  const [ambulancePos, setAmbulancePos] = useState<LatLng | undefined>(undefined);
  const [callDetail, setCallDetail] = useState<EmergencyCall | null>(null);
  const [callStatusData, setCallStatusData] = useState<CallStatusResponse | null>(null);
  const [trackingData, setTrackingData] = useState<CallTrackingResponse | null>(null);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);

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

  const isNumericCallId = !!(callId && /^\d+$/.test(String(callId).trim()));

  // 1. Initial load for call details and call status (once on mount)
  useEffect(() => {
    let cancelled = false;
    const fetchInitialCallInfo = async () => {
      if (!isNumericCallId || !callId) {
        setLoadingInitial(false);
        return;
      }
      try {
        const [detail, statusRes] = await Promise.allSettled([
          api.getCallDetails(callId),
          api.getCallStatus(callId),
        ]);

        if (cancelled) return;
        if (detail.status === 'fulfilled' && detail.value) {
          setCallDetail(detail.value);
        }
        if (statusRes.status === 'fulfilled' && statusRes.value) {
          setCallStatusData(statusRes.value);
        }
      } catch (e) {
        console.warn('[CitizenTracking] Initial call info load error:', e);
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    };

    fetchInitialCallInfo();
    return () => { cancelled = true; };
  }, [callId, isNumericCallId]);

  // 2. Poll Tracking (GET /calls/{callId}/tracking) every 4 seconds
  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const pollTracking = async () => {
      if (!isNumericCallId || !callId) return;
      try {
        const res: CallTrackingResponse = await api.getCallTracking(callId);
        if (cancelled || !res) return;
        setTrackingData(res);

        // Ambulance Location: Chỉ lấy từ BE thật, KHÔNG tự chế fake fallback
        if (
          typeof res.resourceLatitude === 'number' &&
          typeof res.resourceLongitude === 'number' &&
          !isNaN(res.resourceLatitude) &&
          !isNaN(res.resourceLongitude)
        ) {
          setAmbulancePos({
            lat: res.resourceLatitude,
            lng: res.resourceLongitude,
          });
        } else if (res.tracking?.currentLocation && typeof res.tracking.currentLocation.lat === 'number') {
          setAmbulancePos(res.tracking.currentLocation);
        }

        // ETA & Progress
        if (typeof res.tracking?.estimatedTimeArrival === 'number') {
          setEta(Math.max(0, Math.ceil(res.tracking.estimatedTimeArrival / 60)));
        }
        if (typeof res.tracking?.distanceTraveled === 'number') {
          setDistance(Math.max(0, 1.2 - res.tracking.distanceTraveled));
        }
        if (typeof res.tracking?.progress === 'number') {
          setProgress(res.tracking.progress);
        }

        // Status mapping chi tiết từng giai đoạn cứu thương
        const currentSt = (res.missionStatus || res.dispatchRequestStatus || res.callStatus || '').toUpperCase();
        if (currentSt === 'DISPATCHED' || currentSt === 'ASSIGNED') {
          setStatus('DISPATCHED');
        } else if (currentSt === 'ACCEPTED' || currentSt === 'EN_ROUTE' || currentSt === 'RUNNING') {
          setStatus('EN_ROUTE');
        } else if (currentSt === 'ARRIVED_SCENE' || currentSt === 'ARRIVED') {
          setStatus('ARRIVED_SCENE');
          setEta(0);
          setDistance(0);
          setProgress(100);
        } else if (currentSt === 'TRANSPORTING') {
          setStatus('TRANSPORTING');
        } else if (currentSt === 'ARRIVED_HOSPITAL') {
          setStatus('ARRIVED_HOSPITAL');
          setEta(0);
          setDistance(0);
          setProgress(100);
        } else if (currentSt === 'COMPLETED') {
          setStatus('COMPLETED');
          setEta(0);
          setDistance(0);
          setProgress(100);
        } else {
          setStatus('PENDING');
        }
      } catch (e) {
        console.warn('[CitizenTracking] Tracking poll error:', e);
      }
    };

    pollTracking();
    interval = setInterval(pollTracking, 4000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [callId, isNumericCallId]);

  const driverPhone =
    callStatusData?.assignedUnit?.driverPhone ||
    callDetail?.assignedDriverPhone ||
    null;

  const driverName =
    callStatusData?.assignedUnit?.driverName ||
    callDetail?.assignedDriverName ||
    'Tài xế xe cứu thương 115';

  const extractUnitBadge = () => {
    return (
      trackingData?.resourceCode ||
      (trackingData?.resourceId ? `UNIT #${trackingData.resourceId}` : null) ||
      callStatusData?.assignedUnit?.vehiclePlate ||
      callDetail?.assignedVehiclePlate ||
      'Xe Cứu Thương 115'
    );
  };

  const vehicleBadge = extractUnitBadge();

  const handleCallDriver = () => {
    if (driverPhone) {
      Linking.openURL(`tel:${driverPhone}`).catch(() => {
        Alert.alert('Liên hệ tài xế', `Số điện thoại tài xế cứu thương: ${driverPhone}`);
      });
    } else {
      Linking.openURL('tel:115').catch(() => {
        Alert.alert('Tổng đài 115', 'Hotline Cấp cứu 115: 115');
      });
    }
  };

  const handleCall115 = () => {
    Linking.openURL('tel:115').catch(() => {
      Alert.alert('Tổng đài 115', 'Hotline Cấp cứu 115: 115');
    });
  };

  const victimLocation: LatLng = { lat: victimLat, lng: victimLng };

  const getStatusColor = (s: 'STEP_1' | 'STEP_2' | 'STEP_3' | 'STEP_4') => {
    switch (s) {
      case 'STEP_1':
        return status === 'PENDING' ? '#EF4444' : '#10B981';
      case 'STEP_2':
        if (status === 'DISPATCHED' || status === 'EN_ROUTE') return '#EF4444';
        if (['ARRIVED_SCENE', 'TRANSPORTING', 'ARRIVED_HOSPITAL', 'COMPLETED'].includes(status)) return '#10B981';
        return '#334155';
      case 'STEP_3':
        if (status === 'ARRIVED_SCENE') return '#EF4444';
        if (['TRANSPORTING', 'ARRIVED_HOSPITAL', 'COMPLETED'].includes(status)) return '#10B981';
        return '#334155';
      case 'STEP_4':
        if (status === 'TRANSPORTING' || status === 'ARRIVED_HOSPITAL') return '#F59E0B';
        if (status === 'COMPLETED') return '#10B981';
        return '#334155';
    }
  };

  const getEtaTitle = () => {
    switch (status) {
      case 'PENDING':
        return 'ĐANG ĐIỀU PHỐI XE...';
      case 'DISPATCHED':
        return 'XE ĐÃ ĐƯỢC ĐIỀU PHỐI';
      case 'EN_ROUTE':
        return `${eta} PHÚT (${distance.toFixed(1)} km)`;
      case 'ARRIVED_SCENE':
        return 'ĐÃ ĐẾN HIỆN TRƯỜNG';
      case 'TRANSPORTING':
        return 'ĐANG CHUYỂN ĐẾN BỆNH VIỆN';
      case 'ARRIVED_HOSPITAL':
        return 'ĐÃ ĐẾN BỆNH VIỆN TIẾP NHẬN';
      case 'COMPLETED':
        return 'ĐÃ HOÀN TẤT CA CẤP CỨU';
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Map Area */}
      <View style={styles.mapWrapper}>
        <AmbulanceMap
          victimLocation={victimLocation}
          ambulanceLocation={ambulancePos}
          destinationType={['TRANSPORTING', 'ARRIVED_HOSPITAL', 'COMPLETED'].includes(status) ? 'HOSPITAL' : 'SCENE'}
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
            <Text style={styles.etaLabel}>TRẠNG THÁI TIẾP CẬN</Text>
            <Text style={styles.etaValue}>
              {getEtaTitle()}
            </Text>

            {status === 'EN_ROUTE' && (
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
            time={callDetail?.createdAt ? new Date(callDetail.createdAt).toLocaleTimeString('vi-VN') : 'Đã ghi nhận'}
            status={status === 'PENDING' ? 'active' : 'done'}
            color={getStatusColor('STEP_1')}
          />
          <TimelineItem
            title="2. Xe cứu thương đang di chuyển tới"
            time={status === 'EN_ROUTE' || status === 'DISPATCHED' ? `Đang trên đường đến` : ''}
            status={status === 'EN_ROUTE' || status === 'DISPATCHED' ? 'active' : ['ARRIVED_SCENE', 'TRANSPORTING', 'ARRIVED_HOSPITAL', 'COMPLETED'].includes(status) ? 'done' : 'pending'}
            color={getStatusColor('STEP_2')}
          />
          <TimelineItem
            title="3. Đã tiếp cận hiện trường"
            time={status === 'ARRIVED_SCENE' ? 'Đang sơ cấp cứu' : ''}
            status={status === 'ARRIVED_SCENE' ? 'active' : ['TRANSPORTING', 'ARRIVED_HOSPITAL', 'COMPLETED'].includes(status) ? 'done' : 'pending'}
            color={getStatusColor('STEP_3')}
          />
          <TimelineItem
            title="4. Vận chuyển đến bệnh viện tiếp nhận"
            time={status === 'TRANSPORTING' ? 'Đang di chuyển viện' : status === 'ARRIVED_HOSPITAL' ? 'Đã bàn giao viện' : status === 'COMPLETED' ? 'Đã hoàn tất' : ''}
            status={status === 'TRANSPORTING' || status === 'ARRIVED_HOSPITAL' ? 'active' : status === 'COMPLETED' ? 'done' : 'pending'}
            color={getStatusColor('STEP_4')}
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
                <Text style={styles.plateTagText}>{vehicleBadge}</Text>
              </View>
            </View>
            <Text style={styles.hospitalText} numberOfLines={1}>
              <Ionicons name="shield-checkmark-outline" size={11} color="#94A3B8" /> Đội cấp cứu khẩn cấp 115
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  topCallIdText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
  },
  emergency115Btn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
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
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  etaBlock: {
    flex: 1,
  },
  etaLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
  },
  etaValue: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  progressBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  progressPct: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
  },
  callDriverFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  timeline: {
    paddingVertical: 6,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 36,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 20,
    marginRight: 10,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 3,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    marginVertical: 2,
  },
  timelineRight: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 8,
  },
  timelineTitle: {
    fontSize: 12,
  },
  timelineTime: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  driverInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 10,
  },
  driverAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 12,
    fontWeight: '800',
  },
  plateTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
  },
  contactDriverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  contactDriverText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
  },
});
