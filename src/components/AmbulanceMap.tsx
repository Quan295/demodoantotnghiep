import { LatLng } from '@/types';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import MapView, { Circle, Marker, Polyline, UrlTile } from 'react-native-maps';

export interface AmbulanceMapProps {
  victimLocation: LatLng;
  ambulanceLocation?: LatLng;
  hospitalLocation?: LatLng;
  route?: LatLng[];
  style?: any;
  destinationType?: 'SCENE' | 'HOSPITAL';
  followAmbulance?: boolean;
}

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
  const targetLocation = destinationType === 'HOSPITAL' && hospitalLocation ? hospitalLocation : victimLocation;

  const initialRegion = useMemo(() => {
    const minLat = ambulanceLocation ? Math.min(targetLocation.lat, ambulanceLocation.lat) : targetLocation.lat;
    const maxLat = ambulanceLocation ? Math.max(targetLocation.lat, ambulanceLocation.lat) : targetLocation.lat;
    const minLng = ambulanceLocation ? Math.min(targetLocation.lng, ambulanceLocation.lng) : targetLocation.lng;
    const maxLng = ambulanceLocation ? Math.max(targetLocation.lng, ambulanceLocation.lng) : targetLocation.lng;

    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    const latDelta = Math.max((maxLat - minLat) * 2.2, 0.015);
    const lngDelta = Math.max((maxLng - minLng) * 2.2, 0.015);
    return {
      latitude: midLat || 21.0091,
      longitude: midLng || 105.8247,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, []);

  // Smooth camera animate when ambulance moves without overriding user manual drag
  useEffect(() => {
    if (!followAmbulance || !ambulanceLocation || !mapRef.current) return;
    try {
      mapRef.current.animateToRegion(
        {
          latitude: ambulanceLocation.lat,
          longitude: ambulanceLocation.lng,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        800
      );
    } catch {}
  }, [ambulanceLocation?.lat, ambulanceLocation?.lng, followAmbulance]);

  const polylineCoords = useMemo(() => {
    if (route && route.length > 0) {
      return route.map(p => ({ latitude: p.lat, longitude: p.lng }));
    }
    if (ambulanceLocation && targetLocation) {
      return [
        { latitude: ambulanceLocation.lat, longitude: ambulanceLocation.lng },
        { latitude: targetLocation.lat, longitude: targetLocation.lng },
      ];
    }
    return [];
  }, [route, ambulanceLocation, targetLocation]);

  // CartoDB Dark OpenStreetMap Tiles (corrected syntax with {z}/{x}/{y} directly)
  const tileUrl = 'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        rotateEnabled={false}
        pitchEnabled={false}
        showsPointsOfInterest={false}
        showsBuildings={false}
        showsCompass={false}
        showsScale={false}
        showsTraffic={false}
        showsIndoors={false}
      >
        {/* OSM Custom Dark Tiles */}
        <UrlTile
          urlTemplate={tileUrl}
          maximumZ={19}
          minimumZ={3}
          tileSize={256}
          opacity={1}
          zIndex={1}
        />

        {/* Destination: Incident Scene (Victim) or Hospital */}
        {destinationType === 'HOSPITAL' ? (
          <Marker
            coordinate={{ latitude: targetLocation.lat, longitude: targetLocation.lng }}
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
              center={{ latitude: targetLocation.lat, longitude: targetLocation.lng }}
              radius={70}
              strokeWidth={2}
              strokeColor="rgba(240,68,56,0.6)"
              fillColor="rgba(240,68,56,0.08)"
              zIndex={5}
            />
            <Marker
              coordinate={{ latitude: targetLocation.lat, longitude: targetLocation.lng }}
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
        )}

        {/* Ambulance Marker & Dynamic Route */}
        {ambulanceLocation && (
          <>
            <Marker
              coordinate={{ latitude: ambulanceLocation.lat, longitude: ambulanceLocation.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={20}
            >
              <View style={styles.ambulanceMarker}>
                <FontAwesome5 name="ambulance" size={13} color="#FFF" />
              </View>
            </Marker>
            {polylineCoords.length > 0 && (
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
});
