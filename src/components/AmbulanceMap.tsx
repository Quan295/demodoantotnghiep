import { LatLng } from '@/types';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

export interface AmbulanceMapProps {
  victimLocation?: LatLng;
  ambulanceLocation?: LatLng;
  hospitalLocation?: LatLng;
  route?: LatLng[];
  style?: any;
  destinationType?: 'SCENE' | 'HOSPITAL';
  followAmbulance?: boolean;
}

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

const LEAFLET_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #0D1117; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    
    /* Sleek Dark Mode OSM tiles without any API key or watermarks */
    .leaflet-tile-pane {
      filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7);
    }
    .leaflet-control-attribution, .leaflet-control-zoom {
      display: none !important;
    }

    /* Ambulance Marker */
    .ambulance-badge {
      width: 36px;
      height: 36px;
      background: #10B981;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(16,185,129,0.6);
      font-size: 16px;
      user-select: none;
      transition: transform 0.2s ease;
    }

    /* Incident Scene Marker */
    .victim-marker-wrap {
      position: relative;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .victim-ping {
      position: absolute;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(240,68,56,0.25);
      animation: victim-pulse 1.6s cubic-bezier(0, 0.2, 0.8, 1) infinite;
    }
    .victim-core {
      position: relative;
      width: 18px;
      height: 18px;
      background: #F04438;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 2px 10px rgba(240,68,56,0.8);
      z-index: 2;
    }

    /* Hospital Marker */
    .hospital-badge {
      width: 36px;
      height: 36px;
      background: #0284C7;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(2,132,199,0.6);
      font-size: 16px;
      user-select: none;
    }

    @keyframes victim-pulse {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map;
    var ambulanceMarker = null;
    var targetMarker = null;
    var targetCircle = null;
    var routePolyline = null;
    var hasCenteredInitially = false;

    function initMap() {
      map = L.map('map', {
        center: [21.0285, 105.8542],
        zoom: 15,
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      window.mapReady = true;
    }

    var ambulanceIcon = L.divIcon({
      className: '',
      html: '<div class="ambulance-badge">🚑</div>',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    var victimIcon = L.divIcon({
      className: '',
      html: '<div class="victim-marker-wrap"><div class="victim-ping"></div><div class="victim-core"></div></div>',
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    var hospitalIcon = L.divIcon({
      className: '',
      html: '<div class="hospital-badge">🏥</div>',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    window.updateEmergencyMap = function(data) {
      if (!map) return;

      var validTarget = data.validTarget;
      var validAmbulance = data.validAmbulance;
      var destinationType = data.destinationType || 'SCENE';
      var followAmbulance = data.followAmbulance !== false;
      var polylineCoords = data.polylineCoords || [];

      // 1. Target Marker (Victim or Hospital)
      if (validTarget) {
        var targetLatLng = [validTarget.lat, validTarget.lng];
        var isHospital = destinationType === 'HOSPITAL';
        var iconToUse = isHospital ? hospitalIcon : victimIcon;

        if (!targetMarker) {
          targetMarker = L.marker(targetLatLng, { icon: iconToUse, zIndexOffset: 100 }).addTo(map);
        } else {
          targetMarker.setLatLng(targetLatLng);
          targetMarker.setIcon(iconToUse);
        }

        if (!isHospital) {
          if (!targetCircle) {
            targetCircle = L.circle(targetLatLng, {
              radius: 70,
              color: 'rgba(240,68,56,0.6)',
              weight: 2,
              fillColor: '#F04438',
              fillOpacity: 0.08
            }).addTo(map);
          } else {
            targetCircle.setLatLng(targetLatLng);
          }
        } else if (targetCircle) {
          map.removeLayer(targetCircle);
          targetCircle = null;
        }
      } else {
        if (targetMarker) { map.removeLayer(targetMarker); targetMarker = null; }
        if (targetCircle) { map.removeLayer(targetCircle); targetCircle = null; }
      }

      // 2. Ambulance Marker
      if (validAmbulance) {
        var ambLatLng = [validAmbulance.lat, validAmbulance.lng];
        if (!ambulanceMarker) {
          ambulanceMarker = L.marker(ambLatLng, { icon: ambulanceIcon, zIndexOffset: 200 }).addTo(map);
        } else {
          ambulanceMarker.setLatLng(ambLatLng);
        }
      } else if (ambulanceMarker) {
        map.removeLayer(ambulanceMarker);
        ambulanceMarker = null;
      }

      // 3. Polyline Route
      if (polylineCoords.length > 1) {
        var latlngs = polylineCoords.map(function(p) { return [p.lat, p.lng]; });
        var routeColor = destinationType === 'HOSPITAL' ? '#38BDF8' : '#F04438';
        if (!routePolyline) {
          routePolyline = L.polyline(latlngs, {
            color: routeColor,
            weight: 4,
            opacity: 0.9,
            dashArray: '6, 10'
          }).addTo(map);
        } else {
          routePolyline.setLatLngs(latlngs);
          routePolyline.setStyle({ color: routeColor });
        }
      } else if (routePolyline) {
        map.removeLayer(routePolyline);
        routePolyline = null;
      }

      // 4. Viewport Camera auto-bounds / follow
      var allPoints = [];
      if (validAmbulance) allPoints.push([validAmbulance.lat, validAmbulance.lng]);
      if (validTarget) allPoints.push([validTarget.lat, validTarget.lng]);

      if (!hasCenteredInitially) {
        if (allPoints.length > 1) {
          var bounds = L.latLngBounds(allPoints);
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
          hasCenteredInitially = true;
        } else if (allPoints.length === 1) {
          map.setView(allPoints[0], 15);
          hasCenteredInitially = true;
        }
      } else {
        if (followAmbulance && validAmbulance) {
          map.panTo([validAmbulance.lat, validAmbulance.lng], { animate: true, duration: 0.5 });
        }
      }
    };

    document.addEventListener('DOMContentLoaded', initMap);
    setTimeout(function() { if (!map) initMap(); }, 300);
  </script>
</body>
</html>
`;

export default function AmbulanceMap({
  victimLocation,
  ambulanceLocation,
  hospitalLocation,
  route,
  style,
  destinationType = 'SCENE',
  followAmbulance = true,
}: AmbulanceMapProps) {
  const webViewRef = useRef<WebView | null>(null);
  const [isReady, setIsReady] = useState(false);

  const rawTarget = destinationType === 'HOSPITAL' && hospitalLocation ? hospitalLocation : victimLocation;
  const validTarget = isValidCoord(rawTarget) ? rawTarget : undefined;
  const validAmbulance = isValidCoord(ambulanceLocation) ? ambulanceLocation : undefined;

  const polylineCoords = useMemo(() => {
    if (route && route.length > 1) {
      const validRoute = route.filter(isValidCoord);
      if (validRoute.length > 1) return validRoute;
    }
    if (validAmbulance && validTarget) {
      return [validAmbulance, validTarget];
    }
    return [];
  }, [route, validAmbulance, validTarget]);

  const payload = useMemo(() => {
    return {
      validTarget,
      validAmbulance,
      destinationType,
      followAmbulance,
      polylineCoords,
    };
  }, [validTarget, validAmbulance, destinationType, followAmbulance, polylineCoords]);

  // Gửi cập nhật vị trí thời gian thực tới Leaflet trong WebView mà không cần reload trang
  useEffect(() => {
    if (!isReady || !webViewRef.current) return;
    const jsCode = `
      if (window.updateEmergencyMap) {
        window.updateEmergencyMap(${JSON.stringify(payload)});
      }
      true;
    `;
    webViewRef.current.injectJavaScript(jsCode);
  }, [isReady, payload]);

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: LEAFLET_HTML }}
        style={styles.webView}
        containerStyle={styles.container}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scalesPageToFit={false}
        scrollEnabled={false}
        bounces={false}
        androidLayerType="hardware"
        onLoadEnd={() => {
          setIsReady(true);
          const initialCode = `
            if (window.updateEmergencyMap) {
              window.updateEmergencyMap(${JSON.stringify(payload)});
            }
            true;
          `;
          webViewRef.current?.injectJavaScript(initialCode);
        }}
      />
      {!isReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#10B981" />
          <Text style={styles.loadingText}>Đang tải bản đồ...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0D1117',
    overflow: 'hidden',
  },
  webView: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0D1117',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0D1117',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 12,
  },
});
