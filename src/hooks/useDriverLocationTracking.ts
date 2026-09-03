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
  dbLocation?: LatLng | null; // Tọa độ thực tế lấy từ DB (driverResource.latitude, driverResource.longitude)
}

export interface DriverLocationTrackingResult {
  position: LatLng | undefined;
  latitude: number | undefined;
  longitude: number | undefined;
  speed: number;
  heading: number;
  accuracy: number;
  gpsStatus: 'idle' | 'requesting' | 'tracking' | 'denied' | 'disabled' | 'error';
  isTracking: boolean;
  hasRealGps: boolean;
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
  dbLocation,
}: DriverLocationTrackingOptions = {}): DriverLocationTrackingResult {
  // Cờ đánh dấu đã bắt được GPS thật từ phần cứng thiết bị hay chưa
  // Khi chưa có GPS thật: TUYỆT ĐỐI KHÔNG tự tạo dữ liệu fake rồi lưu vào DB
  const hasRealGpsRef = useRef<boolean>(false);
  const [hasRealGps, setHasRealGps] = useState<boolean>(false);

  // Tọa độ khởi tạo: lấy từ DB nếu có, không tự gán mặc định về Chùa Bộc
  const [coords, setCoords] = useState<{
    latitude: number | undefined;
    longitude: number | undefined;
    speed: number;
    heading: number;
    accuracy: number;
  }>({
    latitude: dbLocation?.lat,
    longitude: dbLocation?.lng,
    speed: 0,
    heading: 90,
    accuracy: 5,
  });

  const [gpsStatus, setGpsStatus] = useState<'idle' | 'requesting' | 'tracking' | 'denied' | 'disabled' | 'error'>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncInProgress, setSyncInProgress] = useState<boolean>(false);

  const locationUpdateInFlight = useRef<boolean>(false);
  const lastSyncTimestampRef = useRef<number>(0);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // Khi DB trả về vị trí xe từ backend mà thiết bị chưa bật/chưa có GPS thật:
  // Cập nhật tọa độ hiển thị theo DB
  useEffect(() => {
    if (!hasRealGpsRef.current && dbLocation && typeof dbLocation.lat === 'number' && typeof dbLocation.lng === 'number') {
      setCoords(prev => ({
        ...prev,
        latitude: dbLocation.lat,
        longitude: dbLocation.lng,
      }));
    }
  }, [dbLocation?.lat, dbLocation?.lng]);

  // Kiểm tra tính hợp lệ của tọa độ GPS
  const isValidCoords = (lat?: number, lng?: number, acc?: number) => {
    if (typeof lat !== 'number' || typeof lng !== 'number') return false;
    if (isNaN(lat) || isNaN(lng)) return false;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
    if (acc !== undefined && acc > 100) return false; // Bỏ qua sóng GPS quá nhiễu
    return true;
  };

  // Cập nhật vị trí lên máy chủ:
  // NGUYÊN TẮC QUAN TRỌNG: CHỈ gửi khi có tọa độ GPS thật từ thiết bị, KHÔNG tự chế fake data lưu vào DB
  const sendLocationUpdate = useCallback(async (
    lat: number,
    lng: number,
    spd = 0,
    hdg = 0,
    acc = 5
  ): Promise<boolean> => {
    if (!hasRealGpsRef.current) {
      console.log('[GPS Tracking] Chưa có GPS thực từ thiết bị, bỏ qua cập nhật lên DB');
      return false;
    }

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

      console.log('[GPS Tracking] Sending PATCH /driver-resource/location with REAL GPS:', payload);
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

  // Kiểm tra và xin quyền vị trí
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      setGpsStatus('requesting');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsStatus('denied');
        return false;
      }
      return true;
    } catch (e) {
      console.warn('[GPS Tracking] Permission error:', e);
      setGpsStatus('error');
      return false;
    }
  }, []);

  // Kích hoạt đồng bộ thủ công
  const manualSync = useCallback(async (): Promise<boolean> => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Yêu cầu quyền GPS',
          'Vui lòng cấp quyền định vị vị trí trong Cài đặt để đồng bộ GPS xe cứu thương.',
          [
            { text: 'Để sau', style: 'cancel' },
            {
              text: 'Mở Cài Đặt',
              onPress: () => {
                if (Platform.OS === 'ios') Linking.openURL('app-settings:');
                else Linking.openSettings();
              },
            },
          ]
        );
        return false;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setGpsStatus('disabled');
        Alert.alert('Chưa bật GPS', 'Vui lòng bật định vị GPS trong cài đặt máy.');
        return false;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (loc?.coords) {
        const { latitude, longitude, speed, heading, accuracy } = loc.coords;
        hasRealGpsRef.current = true;
        setHasRealGps(true);
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
      }
      return false;
    } catch (e: any) {
      console.warn('[GPS Tracking] Manual sync error:', e);
      setSyncError(e?.message || 'Không thể lấy GPS hiện tại');
      return false;
    }
  }, [requestPermissions, sendLocationUpdate]);

  // Vòng đời lắng nghe GPS
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

      // 1. Kiểm tra xem dịch vụ vị trí trên máy có bật không
      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          if (isMounted) {
            setGpsStatus('disabled');
            console.log('[GPS Tracking] GPS trên thiết bị chưa bật, sử dụng vị trí từ DB');
          }
          return;
        }
      } catch (err) {
        console.warn('[GPS Tracking] Check services error:', err);
      }

      // 2. Xin quyền vị trí
      const hasPermission = await requestPermissions();
      if (!hasPermission || !isMounted) {
        console.log('[GPS Tracking] Không có quyền GPS, sử dụng vị trí từ DB');
        return;
      }

      try {
        // 3. Lấy vị trí GPS thật ban đầu
        const initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (initialLoc?.coords && isMounted) {
          const { latitude, longitude, speed, heading, accuracy } = initialLoc.coords;
          hasRealGpsRef.current = true;
          setHasRealGps(true);
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

        // 4. Bật watcher GPS liên tục
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval,
            distanceInterval,
          },
          async (location) => {
            if (!isMounted) return;
            const { latitude, longitude, speed, heading, accuracy } = location.coords;

            hasRealGpsRef.current = true;
            setHasRealGps(true);

            setCoords({
              latitude,
              longitude,
              speed: speed ?? 0,
              heading: heading ?? 0,
              accuracy: accuracy ?? 5,
            });

            // Gửi lên backend (tối thiểu 2 giây một lần để chống tràn mạng)
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
        if (isMounted) {
          setGpsStatus('error');
          // Không crash, không gán tọa độ giả, vẫn giữ nguyên tọa độ từ DB
        }
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

  // Tọa độ có hiệu lực: ưu tiên GPS thật nếu có, nếu không thì lấy DB
  const effectiveLat = coords.latitude ?? dbLocation?.lat;
  const effectiveLng = coords.longitude ?? dbLocation?.lng;

  const position: LatLng | undefined =
    typeof effectiveLat === 'number' && typeof effectiveLng === 'number' && !isNaN(effectiveLat) && !isNaN(effectiveLng)
      ? { lat: effectiveLat, lng: effectiveLng }
      : undefined;

  return {
    position,
    latitude: effectiveLat,
    longitude: effectiveLng,
    speed: coords.speed,
    heading: coords.heading,
    accuracy: coords.accuracy,
    gpsStatus,
    isTracking: gpsStatus === 'tracking',
    hasRealGps,
    lastSyncedAt,
    syncError,
    syncInProgress,
    manualSync,
    retryPermissions: requestPermissions,
  };
}
