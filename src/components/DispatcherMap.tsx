import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

export interface DispatcherMapProps {
  cases: Array<{
    id: string | number;
    type: string;
    priority: string;
    address?: string;
    coordinates?: { latitude?: number; longitude?: number };
  }>;
  style?: any;
}

const DISPATCHER_MAP_HTML = `
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
    
    .leaflet-tile-pane {
      filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7);
    }
    .leaflet-control-attribution, .leaflet-control-zoom {
      display: none !important;
    }

    .case-marker {
      position: relative;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .case-pulse {
      position: absolute;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      animation: case-pulse-anim 1.8s infinite;
    }
    .case-pulse.critical {
      background: rgba(240, 68, 56, 0.4);
    }
    .case-pulse.warning {
      background: rgba(247, 144, 9, 0.4);
    }
    .case-core {
      position: relative;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2px solid #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      color: #FFF;
      z-index: 2;
    }
    .case-core.critical {
      background: #F04438;
      box-shadow: 0 0 10px rgba(240,68,56,0.8);
    }
    .case-core.warning {
      background: #F79009;
      box-shadow: 0 0 10px rgba(247,144,9,0.8);
    }

    @keyframes case-pulse-anim {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map;
    var markersLayer;

    function initMap() {
      map = L.map('map', {
        center: [21.015, 105.82],
        zoom: 13,
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      markersLayer = L.layerGroup().addTo(map);
    }

    window.updateCases = function(casesList) {
      if (!map || !markersLayer) return;
      markersLayer.clearLayers();

      var points = [];
      casesList.forEach(function(c) {
        if (!c.coordinates || typeof c.coordinates.latitude !== 'number' || typeof c.coordinates.longitude !== 'number') return;
        var lat = c.coordinates.latitude;
        var lng = c.coordinates.longitude;
        var isCritical = c.priority === 'Khẩn cấp';
        var iconHtml = '<div class="case-marker">' +
          '<div class="case-pulse ' + (isCritical ? 'critical' : 'warning') + '"></div>' +
          '<div class="case-core ' + (isCritical ? 'critical' : 'warning') + '">' + (isCritical ? '🚨' : '⚠️') + '</div>' +
          '</div>';

        var customIcon = L.divIcon({
          className: '',
          html: iconHtml,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        var m = L.marker([lat, lng], { icon: customIcon }).addTo(markersLayer);
        if (c.address) {
          m.bindPopup('<b style="color:#000">' + (c.type || 'Sự cố') + '</b><br/><span style="color:#333;font-size:12px">' + c.address + '</span>');
        }
        points.push([lat, lng]);
      });

      if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
      } else if (points.length === 1) {
        map.setView(points[0], 14);
      }
    };

    document.addEventListener('DOMContentLoaded', initMap);
    setTimeout(function() { if (!map) initMap(); }, 300);
  </script>
</body>
</html>
`;

export default function DispatcherMap({ cases, style }: DispatcherMapProps) {
  const webViewRef = useRef<WebView | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isReady || !webViewRef.current) return;
    const jsCode = `
      if (window.updateCases) {
        window.updateCases(${JSON.stringify(cases || [])});
      }
      true;
    `;
    webViewRef.current.injectJavaScript(jsCode);
  }, [isReady, cases]);

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: DISPATCHER_MAP_HTML }}
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
            if (window.updateCases) {
              window.updateCases(${JSON.stringify(cases || [])});
            }
            true;
          `;
          webViewRef.current?.injectJavaScript(initialCode);
        }}
      />
      {!isReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#A78BFA" />
          <Text style={styles.loadingText}>Đang tải bản đồ điều phối...</Text>
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
