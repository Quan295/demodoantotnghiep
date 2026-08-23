import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import { api } from '@/services/api';
import { LatLng } from '@/types';

export interface DriverLocationTrackingOptions {
  enabled?: boolean;
  missionId?: string | number | null;
  timeInterval?: number; // default 3000ms
  distanceInterval?: number; // default 5m
}

export interface DriverLocationTrackingResult {
  position: LatLng;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number;
  gpsStatus: 'idle' | 'requesting' | 'tracking' | 'denied' | 'error';
  isTracking: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
  syncInProgress: boolean;
  manualSync: () => Promise<boolean>;
  retryPermissions: () => Promise<boolean>;
}

export function useDriverLocationTracking({
  enabled = true,
  missionId,
  timeInterval = 3000,
  distanceInterval = 5,
}: DriverLocationTrackingOptions = {}): DriverLocationTrackingResult {
  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    accuracy: number;
  }>({
    latitude: 21.0091,
    longitude: 105.8247,
    speed: 0,
    heading: 90,
    accuracy: 5,
  });

  const [gpsStatus, setGpsStatus] = useState<'idle' | 'requesting' | 'tracking' | 'denied' | 'error'>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncInProgress, setSyncInProgress] = useState<boolean>(false);

  const locationUpdateInFlight = useRef<boolean>(false);
  const lastSyncTimestampRef = useRef<number>(0);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // Validate coordinates before sending to backend
  const isValidCoords = (lat: number, lng: number, acc: number) => {
    if (typeof lat !== 'number' || typeof lng !== 'number') return false;
    if (isNaN(lat) || isNaN(lng)) return false;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
    if (acc > 100) return false; // Ignore very noisy GPS readings
    return true;
  };

  // Safe PATCH location update with in-flight guard to avoid request collisions
  const sendLocationUpdate = useCallback(async (
    lat: number,
    lng: number,
    spd = 0,
    hdg = 0,
    acc = 5
  ): Promise<boolean> => {
    if (!isValidCoords(lat, lng, acc)) {
      console.warn('[GPS Tracking] Invalid coordinates skipped:', { lat, lng, acc });
      return false;
    }

    if (locationUpdateInFlight.current) {
      console.log('[GPS Tracking] Previous location sync still in flight, skipping overlapping tick');
      return false;
    }

    locationUpdateInFlight.current = true;
    setSyncInProgress(true);

    try {
      const payload = {
        latitude: lat,
        longitude: lng,
        speed: Math.max(0, spd),
        heading: Math.max(0, hdg),
        accuracy: Math.max(1, acc),
      };

      console.log('[GPS Tracking] Sending PATCH /driver-resource/location:', payload);
      await api.updateDriverResourceLocation(payload);

      const timeStr = new Date().toLocaleTimeString('vi-VN');
      setLastSyncedAt(timeStr);
      setSyncError(null);
      lastSyncTimestampRef.current = Date.now();
      return true;
    } catch (err: any) {
      console.warn('[GPS Tracking] Location sync failed:', err?.message || err);
      setSyncError(err?.message || 'Lỗi đồng bộ máy chủ');
      return false;
    } finally {
      locationUpdateInFlight.current = false;
      setSyncInProgress(false);
    }
  }, []);

  // Permission request with user-friendly alert
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      setGpsStatus('requesting');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsStatus('denied');
        Alert.alert(
          'Yêu Cầu Quyền Định Vị GPS',
          'Không thể theo dõi hành trình xe cứu thương vì ứng dụng chưa được cấp quyền vị trí. Vui lòng cấp quyền trong Cài đặt.',
          [
            { text: 'Để sau', style: 'cancel' },
            {
              text: 'Mở Cài Đặt',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              },
            },
          ]
        );
        return false;
      }
      return true;
    } catch (e) {
      console.warn('[GPS Tracking] Permission error:', e);
      setGpsStatus('error');
      return false;
    }
  }, []);

  // Manual Trigger
  const manualSync = useCallback(async (): Promise<boolean> => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return false;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude, speed, heading, accuracy } = loc.coords;

      setCoords({
        latitude,
        longitude,
        speed: speed ?? 0,
        heading: heading ?? 0,
        accuracy: accuracy ?? 5,
      });

      return await sendLocationUpdate(
        latitude,
        longitude,
        speed ?? 0,
        heading ?? 0,
        accuracy ?? 5
      );
    } catch (e: any) {
      console.warn('[GPS Tracking] Manual sync error:', e);
      setSyncError(e?.message || 'Không thể lấy GPS hiện tại');
      return false;
    }
  }, [requestPermissions, sendLocationUpdate]);

  // Main GPS Watcher lifecycle
  useEffect(() => {
    let isMounted = true;

    async function startWatcher() {
      if (!enabled) {
        if (subscriptionRef.current) {
          subscriptionRef.current.remove();
          subscriptionRef.current = null;
        }
        setGpsStatus('idle');
        return;
      }

      const hasPermission = await requestPermissions();
      if (!hasPermission || !isMounted) return;

      try {
        // 1. Get initial fresh position immediately
        const initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (initialLoc?.coords && isMounted) {
          const { latitude, longitude, speed, heading, accuracy } = initialLoc.coords;
          setCoords({
            latitude,
            longitude,
            speed: speed ?? 0,
            heading: heading ?? 0,
            accuracy: accuracy ?? 5,
          });

          sendLocationUpdate(
            latitude,
            longitude,
            speed ?? 0,
            heading ?? 0,
            accuracy ?? 5
          );
        }

        // 2. Start continuous GPS watcher
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval,
            distanceInterval,
          },
          async (location) => {
            if (!isMounted) return;
            const { latitude, longitude, speed, heading, accuracy } = location.coords;

            // Update local coords immediately for smooth local UI/Marker
            setCoords({
              latitude,
              longitude,
              speed: speed ?? 0,
              heading: heading ?? 0,
              accuracy: accuracy ?? 5,
            });

            // Sync to backend with throttle protection (minimum 2s between syncs)
            const now = Date.now();
            if (now - lastSyncTimestampRef.current >= 2000) {
              await sendLocationUpdate(
                latitude,
                longitude,
                speed ?? 0,
                heading ?? 0,
                accuracy ?? 5
              );
            }
          }
        );

        if (isMounted) {
          subscriptionRef.current = sub;
          setGpsStatus('tracking');
        } else {
          sub.remove();
        }
      } catch (err: any) {
        console.warn('[GPS Tracking] Watcher startup error:', err);
        if (isMounted) setGpsStatus('error');
      }
    }

    startWatcher();

    return () => {
      isMounted = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
    };
  }, [enabled, missionId, timeInterval, distanceInterval, requestPermissions, sendLocationUpdate]);

  return {
    position: { lat: coords.latitude, lng: coords.longitude },
    latitude: coords.latitude,
    longitude: coords.longitude,
    speed: coords.speed,
    heading: coords.heading,
    accuracy: coords.accuracy,
    gpsStatus,
    isTracking: gpsStatus === 'tracking',
    lastSyncedAt,
    syncError,
    syncInProgress,
    manualSync,
    retryPermissions: requestPermissions,
  };
}
