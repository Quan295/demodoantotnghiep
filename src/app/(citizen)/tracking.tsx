import { api } from '@/services/api';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Linking,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// Safely import MapView only on Native platforms
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
if (Platform.OS !== 'web') {
  try {
    const MapModule = require('react-native-maps');
    MapView = MapModule.default;
    Marker = MapModule.Marker;
    Polyline = MapModule.Polyline;
  } catch (e) {
    console.warn('Map module load failed', e);
  }
}

const { width, height } = Dimensions.get('window');

type CaseStatus = 'PENDING' | 'DISPATCHED' | 'ARRIVED';

export default function TrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const victimLat = params.lat ? parseFloat(params.lat as string) : 21.028511;
  const victimLng = params.lng ? parseFloat(params.lng as string) : 105.804817;

  const [status, setStatus] = useState<CaseStatus>('PENDING');
  const [eta, setEta] = useState<number>(0);
  const [ambulancePos, setAmbulancePos] = useState({
    latitude: victimLat + 0.012,
    longitude: victimLng + 0.008,
  });
  const [caseDetail, setCaseDetail] = useState<any>(null);
  
  const slideAnim = useRef(new Animated.Value(height * 0.4)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    // Slide up animation
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();

    // Fetch case details from API and poll updates
    const fetchCaseDetail = async () => {
      if (params.id) {
        try {
          const detail = await api.getCallDetail(params.id as string);
          setCaseDetail(detail);
          
          if (detail.status === 'assigned' || detail.status === 'in-progress') {
            setStatus('DISPATCHED');
            setEta(5);
            setAmbulancePos({
              latitude: victimLat + 0.004,
              longitude: victimLng + 0.003,
            });
          } else if (detail.status === 'completed') {
            setStatus('ARRIVED');
            setEta(0);
            setAmbulancePos({
              latitude: victimLat,
              longitude: victimLng,
            });
          } else {
            setStatus('PENDING');
          }
        } catch (error) {
          console.warn('Failed to load case detail in tracking:', error);
        }
      } else {
        // Fallback simulation if no ID was provided
        setStatus('DISPATCHED');
        setEta(8);
      }
    };

    fetchCaseDetail();
    const interval = setInterval(fetchCaseDetail, 4000);

    return () => clearInterval(interval);
  }, [params.id]);

  const getStatusColor = (s: CaseStatus) => {
    if (status === s) return '#F04438';
    if (status === 'ARRIVED' || (status === 'DISPATCHED' && s === 'PENDING')) return '#32D583';
    return '#1F2A37';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <View style={styles.mapWrapper}>
        {Platform.OS !== 'web' && MapView ? (
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: (victimLat + ambulancePos.latitude) / 2,
              longitude: (victimLng + ambulancePos.longitude) / 2,
              latitudeDelta: 0.03,
              longitudeDelta: 0.03,
            }}
            customMapStyle={darkMapStyle}
          >
            <Marker coordinate={{ latitude: victimLat, longitude: victimLng }}>
              <View style={styles.victimMarker}>
                <Animated.View style={[styles.victimPing, { transform: [{ scale: pulseAnim }] }]} />
                <View style={styles.victimDot} />
              </View>
            </Marker>

            {status !== 'PENDING' && (
              <>
                <Marker coordinate={ambulancePos} rotation={45}>
                  <View style={styles.ambMarker}>
                    <FontAwesome5 name="ambulance" size={12} color="#FFF" />
                  </View>
                </Marker>
                <Polyline
                  coordinates={[ambulancePos, { latitude: victimLat, longitude: victimLng }]}
                  strokeColor="#F04438"
                  strokeWidth={3}
                  lineDashPattern={[1, 10]}
                />
              </>
            )}
          </MapView>
        ) : (
          <View style={styles.webMapPlaceholder}>
            <MaterialCommunityIcons name="map-marker-radius" size={48} color="#1F2A37" />
            <Text style={styles.webMapText}>Bản đồ đang hoạt động (Mobile Only)</Text>
          </View>
        )}
      </View>

      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => router.replace('/(citizen)/sos')}
      >
        <Ionicons name="arrow-back" size={24} color="#FFF" />
      </TouchableOpacity>

      <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.sheetHandle} />
        
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.etaLabel}>THỜI GIAN DỰ KIẾN</Text>
            <Text style={styles.etaValue}>{status === 'PENDING' ? '--' : `${eta} PHÚT`}</Text>
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
            time={status === 'DISPATCHED' ? 'Đang di chuyển' : ''} 
            status={status === 'DISPATCHED' ? 'active' : status === 'ARRIVED' ? 'done' : 'pending'} 
            color={getStatusColor('DISPATCHED')}
          />
          <TimelineItem 
            title="Đã đến hiện trường" 
            time="" 
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

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#111827" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#1F2937" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0F172A" }] }
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090B0F',
  },
  mapWrapper: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  webMapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D1117',
  },
  webMapText: {
    color: '#475467',
    marginTop: 12,
    fontSize: 14,
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
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
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
    alignItems: 'center',
    marginBottom: 32,
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
    marginBottom: 32,
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
  victimMarker: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  victimPing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(240, 68, 56, 0.2)',
  },
  victimDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F04438',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  ambMarker: {
    backgroundColor: '#F04438',
    padding: 6,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFF',
  },
});
