import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Linking,
  Dimensions,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// Safely import MapView only on Native platforms
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
if (Platform.OS !== 'web') {
  const MapModule = require('react-native-maps');
  MapView = MapModule.default;
  Marker = MapModule.Marker;
  Polyline = MapModule.Polyline;
}

const { width, height } = Dimensions.get('window');

type CaseStatus = 'PENDING' | 'DISPATCHED' | 'ARRIVED';

export default function TrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Default coordinates (Hanoi center) or passed coords
  const victimLat = params.lat ? parseFloat(params.lat as string) : 21.028511;
  const victimLng = params.lng ? parseFloat(params.lng as string) : 105.804817;
  const accuracy = params.acc ? parseFloat(params.acc as string) : 10;

  // States
  const [status, setStatus] = useState<CaseStatus>('PENDING');
  const [eta, setEta] = useState<number>(0); // in minutes
  const [ambulancePos, setAmbulancePos] = useState({
    latitude: victimLat + 0.012, // Spawn ambulance 1.2km away
    longitude: victimLng + 0.008,
  });
  
  // Simulated animation values for Web fallback
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ambProgress = useRef(new Animated.Value(0)).current;

  // Heartbeat animation for status dot
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Dispatch and Movement Simulation
  useEffect(() => {
    // Stage 1: PENDING (5 seconds)
    // Stage 2: DISPATCHED (Ambulance moves towards victim, 15 seconds simulation)
    // Stage 3: ARRIVED
    
    let moveInterval: any;
    
    const dispatchTimeout = setTimeout(() => {
      setStatus('DISPATCHED');
      setEta(8); // 8 minutes initial ETA
      
      const steps = 150; // Update every 100ms for 15s
      let currentStep = 0;
      
      // Starting point of ambulance
      const startLat = victimLat + 0.012;
      const startLng = victimLng + 0.008;
      
      moveInterval = setInterval(() => {
        currentStep++;
        const progress = currentStep / steps;
        
        // Linear interpolation towards victim location
        const nextLat = startLat + (victimLat - startLat) * progress;
        const nextLng = startLng + (victimLng - startLng) * progress;
        
        setAmbulancePos({
          latitude: nextLat,
          longitude: nextLng,
        });

        // Update ETA countdown based on progress
        const remainingEta = Math.ceil(8 * (1 - progress));
        setEta(remainingEta > 0 ? remainingEta : 1);
        
        if (currentStep >= steps) {
          clearInterval(moveInterval);
          setStatus('ARRIVED');
          setEta(0);
        }
      }, 100);
      
    }, 4000);

    return () => {
      clearTimeout(dispatchTimeout);
      if (moveInterval) clearInterval(moveInterval);
    };
  }, [victimLat, victimLng]);

  const callHotline = () => {
    Linking.openURL('tel:115').catch(() => {});
  };

  const getStatusDetails = () => {
    switch (status) {
      case 'PENDING':
        return {
          title: 'Đang Tìm Kiếm Xe Cứu Thương',
          desc: 'Tín hiệu đã được truyền đi. Đang tính toán PostGIS để điều xe tối ưu nhất ở gần bạn...',
          color: '#F04438',
          icon: 'radio-outline',
        };
      case 'DISPATCHED':
        return {
          title: 'Xe Cứu Thương Đang Đến',
          desc: 'Xe cứu thương biển số 29-A1 115.88 đã nhận lệnh. Đội y tá: Bác sĩ Lê Văn M, Tài xế Nguyễn Văn A.',
          color: '#12B76A',
          icon: 'navigate-circle-outline',
        };
      case 'ARRIVED':
        return {
          title: 'Xe Cứu Thương Đã Đến!',
          desc: 'Kíp cấp cứu đã có mặt tại điểm hẹn. Vui lòng quan sát xung quanh và giữ liên lạc.',
          color: '#32D583',
          icon: 'checkmark-circle',
        };
    }
  };

  const statusDetails = getStatusDetails();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C0E12" />
      <SafeAreaView style={styles.safeArea}>
        
        {/* Top Header */}
        <View style={styles.topBar}>
          <TouchableOpacity 
            onPress={() => router.replace('/(citizen)/sos')} 
            style={styles.topButton}
          >
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Theo Dõi Hành Trình</Text>
          <TouchableOpacity onPress={callHotline} style={[styles.topButton, { backgroundColor: '#F04438' }]}>
            <Ionicons name="call" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Map View Section */}
        <View style={styles.mapContainer}>
          {Platform.OS !== 'web' && MapView ? (
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: (victimLat + ambulancePos.latitude) / 2,
                longitude: (victimLng + ambulancePos.longitude) / 2,
                latitudeDelta: Math.abs(victimLat - ambulancePos.latitude) * 2.5 || 0.03,
                longitudeDelta: Math.abs(victimLng - ambulancePos.longitude) * 2.5 || 0.03,
              }}
              theme="dark"
            >
              {/* Victim Marker */}
              <Marker
                coordinate={{ latitude: victimLat, longitude: victimLng }}
                title="Vị trí của bạn"
                description="Đang chờ cứu hộ"
              >
                <View style={styles.victimMarkerOutline}>
                  <View style={styles.victimMarker} />
                </View>
              </Marker>

              {/* Ambulance Marker */}
              {status !== 'PENDING' && (
                <Marker
                  coordinate={ambulancePos}
                  title="Xe Cứu Thương 115"
                  description={`ETA: ${eta} phút`}
                >
                  <View style={styles.ambulanceMarker}>
                    <FontAwesome5 name="ambulance" size={14} color="#FFF" />
                  </View>
                </Marker>
              )}

              {/* Route Polyline */}
              {status !== 'PENDING' && (
                <Polyline
                  coordinates={[
                    { latitude: ambulancePos.latitude, longitude: ambulancePos.longitude },
                    { latitude: victimLat, longitude: victimLng }
                  ]}
                  strokeColor="#F04438"
                  strokeWidth={4}
                  lineDashPattern={[5, 5]}
                />
              )}
            </MapView>
          ) : (
            /* Web Fallback Interface (Mock Radar/Map UI) */
            <View style={[styles.mapWebFallback, { backgroundColor: '#111622' }]}>
              {/* Grid Lines */}
              <View style={styles.gridLinesHorizontal} />
              <View style={styles.gridLinesVertical} />
              
              {/* Radar Sweeper */}
              {status === 'PENDING' && <View style={styles.radarSweeper} />}

              {/* Victim Node */}
              <View style={[styles.fallbackMarker, { top: '50%', left: '50%' }]}>
                <Animated.View style={[styles.markerRing, { transform: [{ scale: pulseAnim }] }]} />
                <View style={styles.markerDot} />
                <Text style={styles.markerLabel}>BẠN (SOS)</Text>
              </View>

              {/* Ambulance Node */}
              {status !== 'PENDING' && (
                <View 
                  style={[
                    styles.fallbackMarker, 
                    { 
                      // Move top/left dynamically based on simulated coordinates
                      top: `${50 + (ambulancePos.latitude - victimLat) * 3000}%`,
                      left: `${50 + (ambulancePos.longitude - victimLng) * 3000}%`,
                    }
                  ]}
                >
                  <View style={[styles.markerDotAmbulance]}>
                    <FontAwesome5 name="ambulance" size={10} color="#FFF" />
                  </View>
                  <Text style={[styles.markerLabel, { color: '#32D583' }]}>XE 115 ({eta}m)</Text>
                </View>
              )}

              {status === 'PENDING' ? (
                <Text style={styles.radarText}>ĐANG QUÉT VỊ TRÍ GẦN NHẤT BẰNG POSTGIS...</Text>
              ) : (
                <Text style={styles.radarText}>ĐÃ THIẾT LẬP KẾT NỐI REALTIME (WEBSOCKET)</Text>
              )}
            </View>
          )}
        </View>

        {/* Bottom Status Card */}
        <View style={styles.statusCard}>
          {/* Status Indicator */}
          <View style={styles.statusHeader}>
            <View style={styles.statusTitleContainer}>
              <Animated.View 
                style={[
                  styles.statusDot, 
                  { 
                    backgroundColor: statusDetails.color,
                    transform: [{ scale: pulseAnim }]
                  }
                ]} 
              />
              <Text style={[styles.statusTitle, { color: statusDetails.color }]}>
                {statusDetails.title}
              </Text>
            </View>
            
            {status === 'DISPATCHED' && (
              <View style={styles.etaContainer}>
                <Text style={styles.etaNumber}>{eta}</Text>
                <Text style={styles.etaLabel}>PHÚT</Text>
              </View>
            )}
          </View>

          {/* Description */}
          <Text style={styles.statusDesc}>{statusDetails.desc}</Text>

          {/* Action Footer */}
          <View style={styles.divider} />
          
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>SỰ CỐ</Text>
              <Text style={styles.infoValue}>Emergency #829</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>ĐỊNH VỊ GPS</Text>
              <Text style={styles.infoValue}>
                {victimLat.toFixed(5)}, {victimLng.toFixed(5)} (±{accuracy.toFixed(0)}m)
              </Text>
            </View>
          </View>

          {status === 'ARRIVED' && (
            <TouchableOpacity 
              style={styles.doneButton} 
              onPress={() => router.replace('/')}
            >
              <Text style={styles.doneButtonText}>QUAY LẠI TRANG CHỦ</Text>
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2A37',
  },
  topButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#151B26',
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapWebFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  gridLinesHorizontal: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  gridLinesVertical: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  radarSweeper: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 1.5,
    borderColor: 'rgba(240, 68, 56, 0.2)',
    backgroundColor: 'rgba(240, 68, 56, 0.02)',
  },
  fallbackMarker: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -40 }, { translateY: -40 }],
    width: 80,
    height: 80,
  },
  markerRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F04438',
    backgroundColor: 'rgba(240, 68, 56, 0.2)',
  },
  markerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F04438',
  },
  markerDotAmbulance: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#32D583',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  markerLabel: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 4,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  radarText: {
    position: 'absolute',
    bottom: 15,
    color: '#475467',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  victimMarkerOutline: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(240, 68, 56, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F04438',
  },
  victimMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F04438',
  },
  ambulanceMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#32D583',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  statusCard: {
    backgroundColor: '#151B26',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1F2A37',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusDesc: {
    color: '#98A2B3',
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#1F2A37',
    marginVertical: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    color: '#475467',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  infoValue: {
    color: '#F9FAFB',
    fontSize: 12,
    fontWeight: '700',
  },
  etaContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(50, 213, 131, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(50, 213, 131, 0.2)',
  },
  etaNumber: {
    color: '#32D583',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 22,
  },
  etaLabel: {
    color: '#32D583',
    fontSize: 8,
    fontWeight: '800',
  },
  doneButton: {
    backgroundColor: '#1F2A37',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  doneButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
