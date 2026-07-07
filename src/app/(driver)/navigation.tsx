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
  Alert,
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

const { width } = Dimensions.get('window');

type MissionStatus = 'EN_ROUTE' | 'ARRIVED_SCENE';

export default function NavigationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Route params details
  const victimLat = params.victimLat ? parseFloat(params.victimLat as string) : 21.028511;
  const victimLng = params.victimLng ? parseFloat(params.victimLng as string) : 105.804817;
  const victimName = (params.victimName as string) || 'Nguyễn Văn A';
  const victimPhone = (params.victimPhone as string) || '0987.654.321';
  const victimAddress = (params.victimAddress as string) || '12 Chùa Bộc, Đống Đa, Hà Nội';
  const victimInjury = (params.victimInjury as string) || 'Tai nạn giao thông - Chấn thương chân';

  // Driver starting simulated coords (1.2km away)
  const [driverPos, setDriverPos] = useState({
    latitude: victimLat + 0.008,
    longitude: victimLng + 0.006,
  });

  const [status, setStatus] = useState<MissionStatus>('EN_ROUTE');
  const [distance, setDistance] = useState<number>(1.2); // km
  const [eta, setEta] = useState<number>(8); // minutes

  // Simulate ambulance moving slowly towards patient during the trip
  useEffect(() => {
    if (status !== 'EN_ROUTE') return;

    let step = 0;
    const totalSteps = 120; // 1 minute simulation or updates
    const startLat = victimLat + 0.008;
    const startLng = victimLng + 0.006;

    const interval = setInterval(() => {
      step++;
      const progress = step / totalSteps;

      // Move ambulance closer to victim location (stop at 90% progress until "Arrived" clicked)
      const maxProgress = Math.min(progress, 0.9);
      const curLat = startLat + (victimLat - startLat) * maxProgress;
      const curLng = startLng + (victimLng - startLng) * maxProgress;

      setDriverPos({ latitude: curLat, longitude: curLng });

      // Update distance & ETA values
      const currentDist = Math.max(1.2 * (1 - maxProgress), 0.1);
      setDistance(currentDist);
      setEta(Math.ceil(8 * (1 - maxProgress)));

      if (step >= totalSteps) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status, victimLat, victimLng]);

  const handleArrivedScene = () => {
    setStatus('ARRIVED_SCENE');
    setDistance(0);
    setEta(0);
    setDriverPos({ latitude: victimLat, longitude: victimLng });
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
            // Success navigation back
            router.replace('/(driver)/dashboard');
          }
        }
      ]
    );
  };

  const openGoogleMaps = () => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${victimLat},${victimLng}`;
    const label = `Nạn nhân: ${victimName}`;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C0E12" />
      <SafeAreaView style={styles.safeArea}>
        
        {/* Floating Top Header (Patient Details) */}
        <View style={styles.topFloatCard}>
          <View style={styles.topCardRow}>
            <View style={styles.locationBadge}>
              <MaterialCommunityIcons name="map-marker-distance" size={14} color="#FFF" />
              <Text style={styles.badgeText}>{distance.toFixed(1)} km ({eta} ph)</Text>
            </View>
            <TouchableOpacity onPress={openGoogleMaps} style={styles.googleMapsBtn}>
              <Text style={styles.googleMapsBtnText}>MỞ BẢN ĐỒ NGOÀI</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.addressText}>{victimAddress}</Text>
          <Text style={styles.injuryText} numberOfLines={1}>
            Sự cố: {victimInjury}
          </Text>
        </View>

        {/* Map Area */}
        <View style={styles.mapContainer}>
          {Platform.OS !== 'web' && MapView ? (
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: (victimLat + driverPos.latitude) / 2,
                longitude: (victimLng + driverPos.longitude) / 2,
                latitudeDelta: Math.abs(victimLat - driverPos.latitude) * 2.2 || 0.02,
                longitudeDelta: Math.abs(victimLng - driverPos.longitude) * 2.2 || 0.02,
              }}
              theme="dark"
            >
              {/* Victim Location Marker */}
              <Marker
                coordinate={{ latitude: victimLat, longitude: victimLng }}
                title="NẠN NHÂN"
                description={victimName}
              >
                <View style={styles.victimMarkerOuter}>
                  <View style={styles.victimMarkerInner} />
                </View>
              </Marker>

              {/* Driver Location Marker */}
              <Marker
                coordinate={driverPos}
                title="XE CỦA BẠN"
              >
                <View style={styles.ambulanceMarker}>
                  <FontAwesome5 name="ambulance" size={14} color="#FFF" />
                </View>
              </Marker>

              {/* Route Polyline */}
              <Polyline
                coordinates={[
                  { latitude: driverPos.latitude, longitude: driverPos.longitude },
                  { latitude: victimLat, longitude: victimLng }
                ]}
                strokeColor="#F04438"
                strokeWidth={5}
              />
            </MapView>
          ) : (
            /* Web Fallback Map */
            <View style={[styles.mapWebFallback, { backgroundColor: '#111622' }]}>
              <View style={styles.gridLinesHorizontal} />
              <View style={styles.gridLinesVertical} />

              {/* Simulated Route Line */}
              <View style={styles.fallbackRouteLine} />

              {/* Victim Marker */}
              <View style={[styles.fallbackMarker, { top: '35%', left: '65%' }]}>
                <View style={styles.victimMarkerOuter}>
                  <View style={styles.victimMarkerInner} />
                </View>
                <Text style={styles.markerLabel}>NẠN NHÂN (SOS)</Text>
              </View>

              {/* Driver Marker */}
              <View 
                style={[
                  styles.fallbackMarker, 
                  { 
                    top: `${70 - (70 - 35) * (1.2 - distance) / 1.2}%`, 
                    left: `${25 + (65 - 25) * (1.2 - distance) / 1.2}%` 
                  }
                ]}
              >
                <View style={styles.ambulanceMarker}>
                  <FontAwesome5 name="ambulance" size={12} color="#FFF" />
                </View>
                <Text style={[styles.markerLabel, { color: '#32D583' }]}>BẠN</Text>
              </View>

              <Text style={styles.gpsSimLabel}>BẢN ĐỒ CHỈ ĐƯỜNG MÔ PHỎNG (WEB DEV MODE)</Text>
            </View>
          )}
        </View>

        {/* Bottom Floating Mission Control Card */}
        <View style={styles.bottomStatusCard}>
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
              <FontAwesome5 name="flagCheckered" size={14} color="#FFF" style={styles.btnIcon} />
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
    top: 15,
    left: 15,
    right: 15,
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
  mapContainer: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapWebFallback: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  gridLinesHorizontal: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  gridLinesVertical: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  fallbackRouteLine: {
    position: 'absolute',
    top: '35%',
    left: '25%',
    width: '40%',
    height: '35%',
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderColor: 'rgba(240, 68, 56, 0.4)',
    borderStyle: 'dashed',
  },
  fallbackMarker: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -40 }, { translateY: -20 }],
    width: 80,
  },
  markerLabel: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
  },
  gpsSimLabel: {
    position: 'absolute',
    bottom: 15,
    color: '#475467',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    width: '100%',
    textAlign: 'center',
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
    bottom: 20,
    left: 20,
    right: 20,
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
