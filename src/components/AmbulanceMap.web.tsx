import React, { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap } from 'react-leaflet';
import { LatLng } from '@/types';
import 'leaflet/dist/leaflet.css';

// Fix default icon paths for Leaflet on web
const ambulanceIcon = L.divIcon({
  className: 'ambulance-marker',
  html: `<div style="
    background: #32D583;
    width: 36px;
    height: 36px;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 3px solid #FFFFFF;
    box-shadow: 0 4px 12px rgba(50,213,131,0.5);
    font-size: 16px;
    color: #FFF;
  ">🚑</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const victimIcon = L.divIcon({
  className: 'victim-marker',
  html: `<div style="position: relative; width: 40px; height: 40px;">
    <div style="
      position: absolute;
      top: 0; left: 0;
      width: 40px; height: 40px;
      border-radius: 20px;
      background: rgba(240,68,56,0.25);
      animation: pulse 1.5s infinite;
    "></div>
    <div style="
      position: absolute;
      top: 10px; left: 10px;
      width: 20px; height: 20px;
      border-radius: 10px;
      background: #F04438;
      border: 3px solid #FFF;
      box-shadow: 0 2px 8px rgba(240,68,56,0.6);
    "></div>
  </div>
  <style>@keyframes pulse { 0% {transform: scale(1); opacity: 0.8;} 50% {transform: scale(1.5); opacity: 0.2;} 100% {transform: scale(1); opacity: 0.8;} }</style>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

function AutoBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points);
    if (points.length === 1) {
      map.setView(points[0], 15, { animate: true });
    } else {
      map.fitBounds(bounds.pad(0.4), { animate: true, maxZoom: 16 });
    }
  }, [points, map]);
  return null;
}

export interface AmbulanceMapProps {
  victimLocation: LatLng;
  ambulanceLocation?: LatLng;
  route?: LatLng[];
  style?: React.CSSProperties;
  className?: string;
}

export default function AmbulanceMap({
  victimLocation,
  ambulanceLocation,
  route,
  style,
  className,
}: AmbulanceMapProps) {
  const center: [number, number] = useMemo(() => {
    if (ambulanceLocation) {
      return [
        (victimLocation.lat + ambulanceLocation.lat) / 2,
        (victimLocation.lng + ambulanceLocation.lng) / 2,
      ];
    }
    return [victimLocation.lat, victimLocation.lng];
  }, [victimLocation, ambulanceLocation]);

  const allPoints: [number, number][] = useMemo(() => {
    const pts: [number, number][] = [[victimLocation.lat, victimLocation.lng]];
    if (ambulanceLocation) pts.push([ambulanceLocation.lat, ambulanceLocation.lng]);
    return pts;
  }, [victimLocation, ambulanceLocation]);

  const polylineCoords: [number, number][] = useMemo(() => {
    if (route && route.length > 0) {
      return route.map(p => [p.lat, p.lng]);
    }
    if (ambulanceLocation) {
      return [
        [ambulanceLocation.lat, ambulanceLocation.lng],
        [victimLocation.lat, victimLocation.lng],
      ];
    }
    return [];
  }, [route, ambulanceLocation, victimLocation]);

  // Dark / custom OSM tile (CartoDB Voyager dark-like) — falls back to standard OSM
  const tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  const tileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0D1117', ...style }} className={className}>
      <MapContainer
        center={center}
        zoom={15}
        style={{ width: '100%', height: '100%', background: '#0D1117' }}
        zoomControl={false}
      >
        <TileLayer
          url={tileUrl}
          attribution={tileAttribution}
          maxZoom={19}
        />
        <AutoBounds points={allPoints} />

        {/* Victim marker + radius circle */}
        <Marker
          position={[victimLocation.lat, victimLocation.lng]}
          icon={victimIcon}
        />
        <Circle
          center={[victimLocation.lat, victimLocation.lng]}
          radius={80}
          pathOptions={{ color: '#F04438', fillColor: '#F04438', fillOpacity: 0.08, weight: 2, dashArray: '4 6' }}
        />

        {/* Ambulance marker + route */}
        {ambulanceLocation && (
          <>
            <Marker
              position={[ambulanceLocation.lat, ambulanceLocation.lng]}
              icon={ambulanceIcon}
            />
            {polylineCoords.length > 0 && (
              <Polyline
                positions={polylineCoords}
                pathOptions={{ color: '#F04438', weight: 4, opacity: 0.9, dashArray: '6 10' }}
              />
            )}
          </>
        )}
      </MapContainer>
    </div>
  );
}
