import { LatLng } from '@/types';
import { FontAwesome5 } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, Polyline, UrlTile } from 'react-native-maps';

export interface AmbulanceMapProps {
  victimLocation: LatLng;
  ambulanceLocation?: LatLng;
  route?: LatLng[];
  style?: any;
}

export default function AmbulanceMap({
  victimLocation,
  ambulanceLocation,
  route,
  style,
}: AmbulanceMapProps) {
  const region = useMemo(() => {
    let minLat = victimLocation.lat;
    let maxLat = victimLocation.lat;
    let minLng = victimLocation.lng;
    let maxLng = victimLocation.lng;
    if (ambulanceLocation) {
      minLat = Math.min(minLat, ambulanceLocation.lat);
      maxLat = Math.max(maxLat, ambulanceLocation.lat);
      minLng = Math.min(minLng, ambulanceLocation.lng);
      maxLng = Math.max(maxLng, ambulanceLocation.lng);
    }
    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    const latDelta = Math.max((maxLat - minLat) * 2.2, 0.015);
    const lngDelta = Math.max((maxLng - minLng) * 2.2, 0.015);
    return { latitude: midLat, longitude: midLng, latitudeDelta: latDelta, longitudeDelta: lngDelta };
  }, [victimLocation, ambulanceLocation]);

  const polylineCoords = useMemo(() => {
    if (route && route.length > 0) {
      return route.map(p => ({ latitude: p.lat, longitude: p.lng }));
    }
    if (ambulanceLocation) {
      return [
        { latitude: ambulanceLocation.lat, longitude: ambulanceLocation.lng },
        { latitude: victimLocation.lat, longitude: victimLocation.lng },
      ];
    }
    return [];
  }, [route, ambulanceLocation, victimLocation]);

  // OpenStreetMap-compatible dark tiles via CartoDB (same as web version)
  const tileUrl = 'https://${s}.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}${r}.png';

  return (
    <View style={[styles.container, style]}>
      <MapView
        style={styles.map}
        initialRegion={region}
        region={region}
        rotateEnabled={false}
        pitchEnabled={false}
        showsPointsOfInterest={false}
        showsBuildings={false}
        showsCompass={false}
        showsScale={false}
        showsTraffic={false}
        showsIndoors={false}
      >
        {/* OSM Custom Tiles (CartoDB Dark - OpenStreetMap data) */}
        <UrlTile
          urlTemplate={tileUrl}
          maximumZ={19}
          minimumZ={3}
          tileSize={256}
          opacity={1}
        />

        {/* Victim pulse circle */}
        <Circle
          center={{ latitude: victimLocation.lat, longitude: victimLocation.lng }}
          radius={80}
          strokeWidth={2}
          strokeColor="rgba(240,68,56,0.6)"
          fillColor="rgba(240,68,56,0.08)"
        />

        {/* Victim Marker */}
        <Marker
          coordinate={{ latitude: victimLocation.lat, longitude: victimLocation.lng }}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.victimMarkerOuter}>
            <View style={styles.victimPingA} />
            <View style={styles.victimPingB} />
            <View style={styles.victimMarkerInner} />
          </View>
        </Marker>

        {/* Ambulance Marker & Route */}
        {ambulanceLocation && (
          <>
            <Marker
              coordinate={{ latitude: ambulanceLocation.lat, longitude: ambulanceLocation.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.ambulanceMarker}>
                <FontAwesome5 name="ambulance" size={14} color="#FFF" />
              </View>
            </Marker>
            {polylineCoords.length > 0 && (
              <Polyline
                coordinates={polylineCoords}
                strokeColor="#F04438"
                strokeWidth={4}
                lineDashPattern={[6, 10]}
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
    backgroundColor: 'rgba(240,68,56,0.18)',
  },
  victimPingB: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(240,68,56,0.28)',
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
  ambulanceMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#32D583',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#32D583',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});
