import { LatLng } from '@/types';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import MapView, { Circle, Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

class MapErrorBoundary extends React.Component<
  { fallback?: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, info: any) {
    console.warn('[AmbulanceMap] Map rendering failed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <View style={styles.errorFallbackContainer}>
            <MaterialCommunityIcons name="map-marker-alert" size={36} color="#F04438" />
            <Text style={styles.errorFallbackTitle}>Không thể tải bản đồ</Text>
            <Text style={styles.errorFallbackSubtitle}>
              Vui lòng kiểm tra Google Maps API Key và kết nối mạng
            </Text>
          </View>
        )
      );
    }
    return this.props.children;
  }
}

export interface AmbulanceMapProps {
  victimLocation?: LatLng;
  ambulanceLocation?: LatLng;
  hospitalLocation?: LatLng;
  route?: LatLng[];
  style?: any;
  destinationType?: 'SCENE' | 'HOSPITAL';
  followAmbulance?: boolean;
}

// Hàm kiểm tra tính hợp lệ tuyệt đối của tọa độ để tránh crash Native Android
const isValidCoord = (c?: LatLng | null): c is LatLng => {
  return !!(
    c &&
    typeof c.lat === 'number' &&
    typeof c.lng === 'number' &&
    !isNaN(c.lat) &&
    !isNaN(c.lng) &&
    c.lat >= -90 &&
    c.lat <= 90 &&
    c.lng >= -180 &&
    c.lng <= 180
  );
};

// Kiểu bản đồ tối (Dark Mode) chuẩn Google Maps native, không cần dùng tile ngoài, không bao giờ dính watermark API KEY REQUIRED
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#181e28' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#181e28' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#273549' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#334155' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f8fafc' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b1120' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] }
];

export default function AmbulanceMap({
  victimLocation,
  ambulanceLocation,
  hospitalLocation,
  route,
  style,
  destinationType = 'SCENE',
  followAmbulance = true,
}: AmbulanceMapProps) {
  const mapRef = useRef<MapView | null>(null);

  const rawTarget = destinationType === 'HOSPITAL' && hospitalLocation ? hospitalLocation : victimLocation;
  const validTarget = isValidCoord(rawTarget) ? rawTarget : undefined;
  const validAmbulance = isValidCoord(ambulanceLocation) ? ambulanceLocation : undefined;

  const initialRegion = useMemo(() => {
    // Ưu tiên vị trí xe hoặc vị trí sự cố từ DB
    const centerLat = validTarget?.lat ?? validAmbulance?.lat ?? 21.0285;
    const centerLng = validTarget?.lng ?? validAmbulance?.lng ?? 105.8542;

    if (validTarget && validAmbulance) {
      const minLat = Math.min(validTarget.lat, validAmbulance.lat);
      const maxLat = Math.max(validTarget.lat, validAmbulance.lat);
      const minLng = Math.min(validTarget.lng, validAmbulance.lng);
      const maxLng = Math.max(validTarget.lng, validAmbulance.lng);
      const latDelta = Math.max((maxLat - minLat) * 2.2, 0.015);
      const lngDelta = Math.max((maxLng - minLng) * 2.2, 0.015);

      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: isNaN(latDelta) ? 0.015 : latDelta,
        longitudeDelta: isNaN(lngDelta) ? 0.015 : lngDelta,
      };
    }

    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    };
  }, [validTarget, validAmbulance]);

  // Tự động focus camera vào vị trí xe từ DB hoặc GPS khi dữ liệu được nạp
  useEffect(() => {
    if (!mapRef.current) return;
    const focusTarget = (followAmbulance && validAmbulance) ? validAmbulance : validTarget;
    if (!focusTarget || typeof focusTarget.lat !== 'number' || isNaN(focusTarget.lat)) return;

    try {
      mapRef.current.animateToRegion(
        {
          latitude: focusTarget.lat,
          longitude: focusTarget.lng,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        800
      );
    } catch {}
  }, [validAmbulance?.lat, validAmbulance?.lng, validTarget?.lat, validTarget?.lng, followAmbulance]);

  const polylineCoords = useMemo(() => {
    if (route && route.length > 0) {
      const validRoute = route.filter(isValidCoord);
      if (validRoute.length > 1) {
        return validRoute.map(p => ({ latitude: p.lat, longitude: p.lng }));
      }
    }
    if (validAmbulance && validTarget) {
      return [
        { latitude: validAmbulance.lat, longitude: validAmbulance.lng },
        { latitude: validTarget.lat, longitude: validTarget.lng },
      ];
    }
    return [];
  }, [route, validAmbulance, validTarget]);

  return (
    <View style={[styles.container, style]}>
      <MapErrorBoundary>
        <MapView
          ref={mapRef}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          style={styles.map}
          initialRegion={initialRegion}
          customMapStyle={darkMapStyle}
          rotateEnabled={false}
          pitchEnabled={false}
          showsPointsOfInterest={false}
          showsBuildings={false}
          showsCompass={false}
          showsScale={false}
          showsTraffic={false}
          showsIndoors={false}
        >
          {/* Destination: Incident Scene (Victim) or Hospital - CHỈ render khi có tọa độ hợp lệ */}
          {validTarget && (
            destinationType === 'HOSPITAL' ? (
              <Marker
                coordinate={{ latitude: validTarget.lat, longitude: validTarget.lng }}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={10}
              >
                <View style={styles.hospitalMarker}>
                  <MaterialCommunityIcons name="hospital-building" size={16} color="#FFF" />
                </View>
              </Marker>
            ) : (
              <>
                <Circle
                  center={{ latitude: validTarget.lat, longitude: validTarget.lng }}
                  radius={70}
                  strokeWidth={2}
                  strokeColor="rgba(240,68,56,0.6)"
                  fillColor="rgba(240,68,56,0.08)"
                  zIndex={5}
                />
                <Marker
                  coordinate={{ latitude: validTarget.lat, longitude: validTarget.lng }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  zIndex={10}
                >
                  <View style={styles.victimMarkerOuter}>
                    <View style={styles.victimPingA} />
                    <View style={styles.victimPingB} />
                    <View style={styles.victimMarkerInner} />
                  </View>
                </Marker>
              </>
            )
          )}

          {/* Ambulance Marker & Dynamic Route - CHỈ render khi có tọa độ xe hợp lệ */}
          {validAmbulance && (
            <>
              <Marker
                coordinate={{ latitude: validAmbulance.lat, longitude: validAmbulance.lng }}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={20}
              >
                <View style={styles.ambulanceMarker}>
                  <FontAwesome5 name="ambulance" size={13} color="#FFF" />
                </View>
              </Marker>
              {polylineCoords.length > 1 && (
                <Polyline
                  coordinates={polylineCoords}
                  strokeColor={destinationType === 'HOSPITAL' ? '#38BDF8' : '#F04438'}
                  strokeWidth={4}
                  lineDashPattern={[6, 8]}
                  zIndex={8}
                />
              )}
            </>
          )}
        </MapView>
      </MapErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0D1117',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  victimMarkerOuter: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  victimPingA: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(240,68,56,0.2)',
  },
  victimPingB: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(240,68,56,0.3)',
  },
  victimMarkerInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F04438',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    zIndex: 2,
  },
  hospitalMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0284C7',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  ambulanceMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  errorFallbackContainer: {
    flex: 1,
    backgroundColor: '#0D1117',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(240, 68, 56, 0.2)',
    borderRadius: 12,
  },
  errorFallbackTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  errorFallbackSubtitle: {
    color: '#98A2B3',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
});
