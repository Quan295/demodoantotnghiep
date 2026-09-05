import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from '@expo/vector-icons';
import * as Location from 'expo-location';
import { api } from '@/services/api';
import { globalConfig } from '@/services/config';
import { CallStatusResponse, EmergencyCall } from '@/types';
import { resolveEmergencyStatus } from '@/utils/statusHelper';
import PaymentInvoiceModal from '@/components/PaymentInvoiceModal';
import { EmergencyRecorder, RecorderStatus } from '@/components/EmergencyRecorder';

const { width } = Dimensions.get('window');

type SubmitFlowStatus =
  | 'none'
  | 'uploading'
  | 'submitting'
  | 'waiting_ai'
  | 'success'
  | 'error';

export default function SOSScreen() {
  const router = useRouter();

  // Navigation Tab: 'sos' | 'history' | 'tips'
  const [activeTab, setActiveTab] = useState<'sos' | 'history' | 'tips'>('sos');

  // Location & Form State
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationLoading, setLocationLoading] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Recorder State
  const [recorderStatus, setRecorderStatus] = useState<RecorderStatus>('idle');
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [durationMillis, setDurationMillis] = useState<number>(0);

  // Flow State for Voice SOS
  const [flowStatus, setFlowStatus] = useState<SubmitFlowStatus>('none');
  const [flowError, setFlowError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  // History Calls State (from GET /calls/me & GET /calls/my-calls)
  const [myCalls, setMyCalls] = useState<EmergencyCall[]>([]);
  const [refreshingCalls, setRefreshingCalls] = useState<boolean>(false);

  // Detail / Status Modal State (from GET /calls/{id} & GET /calls/{id}/status)
  const [selectedCallId, setSelectedCallId] = useState<string | number | null>(null);
  const [selectedCallDetails, setSelectedCallDetails] = useState<EmergencyCall | null>(null);
  const [selectedCallStatus, setSelectedCallStatus] = useState<CallStatusResponse | null>(null);
  const [loadingStatusModal, setLoadingStatusModal] = useState<boolean>(false);
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const [selectedInvoiceCallId, setSelectedInvoiceCallId] = useState<string | number | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState<boolean>(false);

  // Animations
  const pulseSOSAnim = useRef(new Animated.Value(1)).current;
  const flowBusy = useMemo(
    () => flowStatus === 'uploading' || flowStatus === 'submitting' || flowStatus === 'waiting_ai',
    [flowStatus]
  );

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseSOSAnim, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseSOSAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseSOSAnim]);

  // Fetch Current Device GPS Location
  const getCurrentLocation = useCallback(async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Cấp quyền vị trí', 'Vui lòng cấp quyền định vị GPS để đội cấp cứu xác định vị trí hiện trường của bạn.');
        setLocation(null);
        return;
      }
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert('Chưa bật GPS', 'Vui lòng bật dịch vụ định vị (Vị trí/GPS) trên thiết bị.');
        setLocation(null);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc);
    } catch (error) {
      console.warn('Location error:', error);
      // Tuyệt đối không tự tạo dữ liệu giả lưu vào DB
      setLocation(null);
    } finally {
      setLocationLoading(false);
    }
  }, []);

  useEffect(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

  // 1. API: POST /calls/sos (Gửi định vị cấp cứu 1-chạm)
  const handleSOS = async () => {
    if (!location?.coords?.latitude || !location?.coords?.longitude) {
      Alert.alert(
        'Chưa có tọa độ GPS',
        'Vui lòng bật GPS trên máy và bấm "Định vị lại" để hệ thống xác định vị trí hiện trường chính xác.',
        [
          { text: 'Lấy lại vị trí', onPress: () => getCurrentLocation() },
          { text: 'Đóng', style: 'cancel' }
        ]
      );
      return;
    }

    setLoading(true);
    try {
      const sosKey = `sos-call-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      const payload = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        description: description.trim() || 'Yêu cầu cứu hộ khẩn cấp 1-chạm (Location SOS)',
      };

      console.log('[SOSScreen] Calling POST /calls/sos with Idempotency-Key:', sosKey, payload);
      const callResult = await api.createSosCall(payload, sosKey);
      setDescription('');

      const callId =
        (callResult as any)?.callId ??
        (callResult as any)?.id ??
        (callResult as any)?.emergencyCallId ??
        (callResult as any)?.data?.callId ??
        (callResult as any)?.data?.id;
      if (!callId) {
        throw new Error('Máy chủ không trả về mã cuộc gọi (callId)');
      }

      Alert.alert(
        'ĐÃ GỬI YÊU CẦU CẤP CỨU! 🚨',
        'Tín hiệu cấp cứu đã được chuyển đến trung tâm điều phối 115. Đội ngũ y tế đang được điều động khẩn cấp.',
        [
          {
            text: 'THEO DÕI XE CỨU THƯƠNG',
            onPress: () => {
              router.push({
                pathname: '/(citizen)/tracking',
                params: {
                  lat: location.coords.latitude.toString(),
                  lng: location.coords.longitude.toString(),
                  id: String(callId),
                },
              });
            },
          },
          { text: 'Đóng' },
        ]
      );
    } catch (error: any) {
      Alert.alert('Gửi SOS thất bại', error.message || 'Vui lòng kiểm tra kết nối và thử lại');
    } finally {
      setLoading(false);
    }
  };

  // 2. API: POST /calls/voice (Gọi cấp cứu bằng giọng nói + MinIO Upload)
  const handleSubmitVoiceEmergency = async () => {
    if (!location) {
      Alert.alert('Chưa có vị trí', 'Vui lòng lấy vị trí trước khi gửi cuộc gọi cấp cứu');
      getCurrentLocation();
      return;
    }
    if (!audioUri || recorderStatus !== 'recorded') {
      Alert.alert('Chưa có bản ghi âm', 'Vui lòng nhấn nút ghi âm và mô tả tình trạng cấp cứu trước khi gửi.');
      return;
    }
    if (flowBusy) return;

    setFlowError(null);
    const key = idempotencyKey || `voice-call-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    setIdempotencyKey(key);

    try {
      setFlowStatus('uploading');
      const uploaded = await api.uploadRecording(audioUri, key);
      if (!uploaded?.objectKey) {
        throw new Error('Backend không trả về objectKey sau khi upload');
      }

      setFlowStatus('submitting');
      const result = await api.createVoiceCall(
        {
          audioObjectKey: uploaded.objectKey,
          location: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          description: description.trim() || 'Cuộc gọi cấp cứu bằng giọng nói (Voice SOS)',
        },
        key
      );

      setFlowStatus('waiting_ai');
      await new Promise(resolve => setTimeout(resolve, 1500));
      setFlowStatus('success');

      const callId =
        (result as any)?.callId ??
        (result as any)?.id ??
        (result as any)?.emergencyCallId ??
        (result as any)?.data?.callId ??
        (result as any)?.data?.id;
      if (!callId) {
        throw new Error('Máy chủ không trả về mã cuộc gọi (callId)');
      }

      Alert.alert(
        'GỬI CUỘC GỌI THÀNH CÔNG! 🎉',
        'AI và Điều phối viên 115 đã nhận bản ghi âm và đang điều phối xe cứu thương phù hợp nhất cho bạn.',
        [
          {
            text: 'THEO DÕI HÀNH TRÌNH',
            onPress: () => {
              router.push({
                pathname: '/(citizen)/tracking',
                params: {
                  lat: location.coords.latitude.toString(),
                  lng: location.coords.longitude.toString(),
                  id: String(callId),
                },
              });
            },
          },
          {
            text: 'Gửi ca mới',
            onPress: () => {
              setAudioUri(null);
              setDurationMillis(0);
              setRecorderStatus('idle');
              setIdempotencyKey(null);
              setFlowStatus('none');
              setDescription('');
            },
          },
        ]
      );
    } catch (e: any) {
      console.error('[Voice SOS] submit failed:', e?.message || e);
      setFlowError(e?.message || 'Gửi cuộc gọi cấp cứu thất bại');
      setFlowStatus('error');
      Alert.alert('Gửi thất bại', e?.message || 'Vui lòng kiểm tra mạng hoặc thử lại sau');
    }
  };

  // 3. API: GET /calls/me & GET /calls/my-calls (Lấy lịch sử cuộc gọi)
  const fetchMyCalls = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshingCalls(true);
      else setLoading(true);

      let calls: EmergencyCall[] = [];
      try {
        calls = await api.getMyEmergencyCalls();
      } catch {
        calls = await api.getMyCalls();
      }

      if (Array.isArray(calls)) {
        const normalized = calls.map((c: any, index: number) => ({
          ...c,
          id: c.id ?? c.callId ?? c.requestId ?? c.emergencyCallId ?? `call-${index}`,
        }));
        setMyCalls(normalized);
      }
    } catch (error: any) {
      console.warn('Fetch calls error:', error);
    } finally {
      setLoading(false);
      setRefreshingCalls(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchMyCalls();
    }
  }, [activeTab, fetchMyCalls]);

  // 4. API: GET /calls/{id}/status & GET /calls/{id} (Chi tiết & Trạng thái cuộc gọi)
  const handleOpenCallStatusModal = async (callId: string | number) => {
    setSelectedCallId(callId);
    setShowStatusModal(true);
    setLoadingStatusModal(true);

    try {
      const [details, statusRes] = await Promise.allSettled([
        api.getCallDetails(callId),
        api.getCallStatus(callId),
      ]);

      if (details.status === 'fulfilled') {
        setSelectedCallDetails(details.value);
      }
      if (statusRes.status === 'fulfilled') {
        setSelectedCallStatus(statusRes.value);
      }
    } catch (e) {
      console.warn('[SOSScreen] Error loading call status details:', e);
    } finally {
      setLoadingStatusModal(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất khỏi ứng dụng?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.logout();
          } catch {}
          router.replace('/');
        },
      },
    ]);
  };

  const getFlowStatusInfo = () => {
    switch (flowStatus) {
      case 'uploading':
        return { label: 'Đang upload file ghi âm lên hệ thống...', icon: 'cloud-upload-outline', color: '#38BDF8' };
      case 'submitting':
        return { label: 'Đang gửi yêu cầu cấp cứu...', icon: 'send-outline', color: '#A78BFA' };
      case 'waiting_ai':
        return { label: 'AI đang phân tích giọng nói & điều phối xe...', icon: 'hourglass-outline', color: '#F59E0B' };
      case 'success':
        return { label: 'Gửi thành công! Đang chuyển tiếp...', icon: 'checkmark-circle-outline', color: '#10B981' };
      case 'error':
        return { label: flowError || 'Gửi thất bại', icon: 'alert-circle-outline', color: '#EF4444' };
      default:
        return null;
    }
  };

  const flowInfo = getFlowStatusInfo();
  const currentUser = globalConfig.getCurrentUser();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#070A10', '#0F172A', '#0B0F19']} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>

          {/* TOP HEADER */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.appBadge}>
                <MaterialCommunityIcons name="heart-pulse" size={14} color="#EF4444" />
                <Text style={styles.appBadgeText}>115 SMART DISPATCH</Text>
              </View>
              <Text style={styles.welcomeText}>
                Xin chào, {currentUser?.name || 'Người Dân'} 👋
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                style={styles.paymentShortcutBtn}
                onPress={() => router.push('/(citizen)/payments' as any)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="receipt-text-check" size={16} color="#10B981" />
                <Text style={styles.paymentShortcutText}>Viện phí</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
                <Ionicons name="log-out-outline" size={20} color="#F87171" />
              </TouchableOpacity>
            </View>
          </View>

          {/* TAB BAR NAVIGATION */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'sos' && styles.tabItemActive]}
              onPress={() => setActiveTab('sos')}
            >
              <MaterialCommunityIcons
                name="alarm-light"
                size={16}
                color={activeTab === 'sos' ? '#EF4444' : '#64748B'}
              />
              <Text style={[styles.tabText, activeTab === 'sos' && styles.tabTextActive]}>
                Cấp Cứu & SOS
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'history' && styles.tabItemActive]}
              onPress={() => setActiveTab('history')}
            >
              <MaterialCommunityIcons
                name="history"
                size={16}
                color={activeTab === 'history' ? '#EF4444' : '#64748B'}
              />
              <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
                Lịch Sử ({myCalls.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'tips' && styles.tabItemActive]}
              onPress={() => setActiveTab('tips')}
            >
              <MaterialCommunityIcons
                name="book-cross"
                size={16}
                color={activeTab === 'tips' ? '#EF4444' : '#64748B'}
              />
              <Text style={[styles.tabText, activeTab === 'tips' && styles.tabTextActive]}>
                Cẩm Nang Sơ Cứu
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: SOS & VOICE EMERGENCY */}
          {activeTab === 'sos' && (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* GPS Location Bar */}
              <View style={styles.locationCard}>
                <View style={styles.locationHeaderRow}>
                  <View style={styles.locationIconBox}>
                    <Ionicons name="location-sharp" size={18} color="#10B981" />
                  </View>
                  <View style={styles.locationInfoGroup}>
                    <Text style={styles.locationLabel}>VỊ TRÍ GPS HIỆN TẠI</Text>
                    <Text style={styles.locationCoords}>
                      {location
                        ? `${location.coords.latitude.toFixed(6)}° N, ${location.coords.longitude.toFixed(6)}° E`
                        : 'Đang xác định tọa độ GPS...'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.refreshLocBtn}
                    onPress={getCurrentLocation}
                    disabled={locationLoading}
                  >
                    {locationLoading ? (
                      <ActivityIndicator size="small" color="#10B981" />
                    ) : (
                      <Ionicons name="refresh" size={16} color="#10B981" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* SECTION 1: ONE-TAP LOCATION SOS */}
              <View style={styles.oneTapCard}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                    <MaterialCommunityIcons name="alarm-light" size={18} color="#EF4444" />
                  </View>
                  <View>
                    <Text style={styles.sectionTitle}>GỬI ĐỊNH VỊ CẤP CỨU 1-CHẠM</Text>
                    <Text style={styles.sectionSubTitle}>Gửi tọa độ GPS hiện trường khẩn cấp</Text>
                  </View>
                </View>

                {/* Optional Note Input */}
                <View style={styles.inputBox}>
                  <Ionicons name="create-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Mô tả sự cố (vd: Tai nạn ngã xe, khó thở, sốt cao...)"
                    placeholderTextColor="#64748B"
                    value={description}
                    onChangeText={setDescription}
                  />
                </View>

                {/* Hero Big SOS Button */}
                <View style={styles.sosButtonContainer}>
                  <Animated.View style={{ transform: [{ scale: pulseSOSAnim }] }}>
                    <TouchableOpacity
                      style={styles.bigSOSButton}
                      onPress={handleSOS}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={['#EF4444', '#DC2626', '#991B1B']}
                        style={styles.bigSOSGradient}
                      >
                        {loading ? (
                          <ActivityIndicator size="large" color="#FFF" />
                        ) : (
                          <>
                            <MaterialCommunityIcons name="alarm-light" size={44} color="#FFF" />
                            <Text style={styles.bigSOSText}>SOS</Text>
                            <Text style={styles.bigSOSSubText}>CHẠM ĐỂ GỬI CẤP CỨU</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              </View>

              {/* SECTION 2: VOICE EMERGENCY CALL */}
              <View style={styles.voiceEmergencyCard}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconCircle}>
                    <MaterialCommunityIcons name="microphone-message" size={18} color="#38BDF8" />
                  </View>
                  <View>
                    <Text style={styles.sectionTitle}>GỌI CẤP CỨU BẰNG GIỌNG NÓI</Text>
                    <Text style={styles.sectionSubTitle}>AI tự động nhận diện giọng nói & điều phối xe</Text>
                  </View>
                </View>

                {/* Recorder Component */}
                <EmergencyRecorder
                  status={recorderStatus}
                  onStatusChange={setRecorderStatus}
                  audioUri={audioUri}
                  onAudioUriChange={setAudioUri}
                  durationMillis={durationMillis}
                  onDurationChange={setDurationMillis}
                  disabled={flowBusy}
                />

                {/* Submit Voice Button */}
                {recorderStatus === 'recorded' && audioUri && (
                  <TouchableOpacity
                    style={[styles.submitVoiceBtn, flowBusy && styles.btnDisabled]}
                    onPress={handleSubmitVoiceEmergency}
                    disabled={flowBusy}
                    activeOpacity={0.8}
                  >
                    {flowBusy ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <FontAwesome5 name="paper-plane" size={15} color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={styles.submitVoiceBtnText}>GỬI GHI ÂM CẤP CỨU NGAY</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Flow Progress Banner */}
                {flowInfo && (
                  <View style={[styles.flowBanner, { borderColor: flowInfo.color }]}>
                    <Ionicons name={flowInfo.icon as any} size={18} color={flowInfo.color} />
                    <Text style={[styles.flowText, { color: flowInfo.color }]}>{flowInfo.label}</Text>
                  </View>
                )}
              </View>
            
            </ScrollView>
          )}

          {/* TAB 2: CALL HISTORY (GET /calls/me & GET /calls/my-calls) */}
          {activeTab === 'history' && (
            <FlatList
              data={myCalls}
              keyExtractor={(item, index) => (item?.id != null ? String(item.id) : `call-key-${index}`)}
              contentContainerStyle={styles.historyListContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshingCalls}
                  onRefresh={() => fetchMyCalls(true)}
                  tintColor="#EF4444"
                />
              }
              renderItem={({ item, index }) => {
                const rawTime = item.createdAt || (item as any).created_at || (item as any).timestamp;
                const formattedTime = rawTime && !Number.isNaN(new Date(rawTime).getTime())
                  ? new Date(rawTime).toLocaleString('vi-VN')
                  : 'Chưa có thời gian';

                const callId = item.id ?? (item as any).callId ?? (index + 1);
                const reqId = (item as any).requestId ?? (item as any).dispatchRequestId ?? (item as any).request?.id;
                const idLabel = reqId ? `CUỘC GỌI #${callId} • YÊU CẦU #${reqId}` : `MÃ CUỘC GỌI: #${callId}`;
                const effectiveStatus = resolveCallListItemStatus(item);

                return (
                  <View style={styles.callHistoryCard}>
                    <View style={styles.callCardHeader}>
                      <View style={styles.callIdBadge}>
                        <Text style={styles.callIdText}>{idLabel}</Text>
                      </View>
                      <View style={[styles.statusBadge, getStatusBadgeStyle(effectiveStatus)]}>
                        <Text style={styles.statusBadgeText}>{getStatusText(effectiveStatus)}</Text>
                      </View>
                    </View>

                    <Text style={styles.callDescriptionText} numberOfLines={2}>
                      {item.description || 'Yêu cầu cứu hộ khẩn cấp 115'}
                    </Text>

                    <View style={styles.callMetaRow}>
                      <View style={styles.metaItem}>
                        <Ionicons name="time-outline" size={13} color="#94A3B8" />
                        <Text style={styles.metaText}>{formattedTime}</Text>
                      </View>
                    {(() => {
                      const ext: any = typeof item.extended_attributes === 'string'
                        ? (() => { try { return JSON.parse(item.extended_attributes); } catch { return {}; } })()
                        : item.extended_attributes || item.extendedAttributes;
                      const plate = ext?.license_plate || ext?.licensePlate || item.assignedVehiclePlate;
                      return plate ? (
                        <View style={styles.metaItem}>
                          <MaterialCommunityIcons name="ambulance" size={13} color="#10B981" />
                          <Text style={[styles.metaText, { color: '#34D399', fontWeight: '800' }]}>
                            Xe: {plate}
                          </Text>
                        </View>
                      ) : null;
                    })()}
                  </View>

                  {/* Actions for each call */}
                  <View style={styles.callActionsRow}>
                    <TouchableOpacity
                      style={styles.viewStatusBtn}
                      onPress={() => handleOpenCallStatusModal(item.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="information-circle-outline" size={13} color="#38BDF8" />
                      <Text style={styles.viewStatusBtnText} numberOfLines={1}>XEM TRẠNG THÁI</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.trackBtn}
                      onPress={() => {
                        const lat = item.latitude?.toString() || item.location?.latitude?.toString();
                        const lng = item.longitude?.toString() || item.location?.longitude?.toString();
                        router.push({
                           pathname: '/(citizen)/tracking',
                           params: {
                             ...(lat ? { lat } : {}),
                             ...(lng ? { lng } : {}),
                             id: String(item.id),
                           },
                         });
                       }}
                      activeOpacity={0.85}
                    >
                      <FontAwesome5 name="map-marked-alt" size={12} color="#022C22" />
                      <Text style={styles.trackBtnText} numberOfLines={1}>THEO DÕI XE</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.invoiceBtn}
                      onPress={async () => {
                        const callId = item.id ?? (item as any).callId;
                        const callStatus = resolveCallListItemStatus(item);

                        // 1. Nếu ca cấp cứu đã ghi nhận COMPLETED -> mở ngay hóa đơn
                        if (callStatus === 'COMPLETED') {
                          setSelectedInvoiceCallId(callId);
                          setShowInvoiceModal(true);
                          return;
                        }

                        // 2. Thử truy vấn API thanh toán xem BE đã tạo hóa đơn cho ca này chưa
                        try {
                          const payment = await api.getReporterPaymentByCallId(callId);
                          if (payment && payment.paymentId) {
                            setSelectedInvoiceCallId(callId);
                            setShowInvoiceModal(true);
                            return;
                          }
                        } catch {
                          // Silent
                        }

                        // 3. Nếu thực sự ca chưa hoàn tất và BE chưa tạo hóa đơn -> Thông báo
                        Alert.alert(
                          'Yêu Cầu Đang Chờ Duyệt & Xử Lý',
                          `Yêu cầu cấp cứu #${callId} hiện đang chờ điều phối viên duyệt hoặc xe đang di chuyển, chưa thể thanh toán vào lúc này.\n\nHóa đơn viện phí sẽ sẵn sàng ngay sau khi hoàn tất ca cấp cứu.`
                        );
                      }}
                    >
                      <MaterialCommunityIcons name="receipt-text" size={13} color="#34D399" />
                      <Text style={styles.invoiceBtnText} numberOfLines={1}>HÓA ĐƠN</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons name="phone-off" size={48} color="#334155" />
                  <Text style={styles.emptyTitle}>Chưa Có Yêu Cầu Cấp Cứu Nào</Text>
                  <Text style={styles.emptySubtitle}>
                    Các yêu cầu cứu hộ qua Voice SOS và Định vị 1-chạm sẽ xuất hiện tại đây.
                  </Text>
                </View>
              }
            />
          )}

          {/* TAB 3: FIRST AID TIPS */}
          {activeTab === 'tips' && (
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              <TipCard
                icon="heart-pulse"
                title="1. Ép Tim Ngoài Lồng Ngực (CPR)"
                desc="Đặt 2 tay giữa ngực nạn nhân, ép sâu 5-6cm với tần số 100-120 lần/phút liên tục cho đến khi đội cứu hộ đến."
                color="#EF4444"
              />
              <TipCard
                icon="brain"
                title="2. Dấu Hiệu Đột Quỵ (Quy Tắc FAST)"
                desc="F (Mặt méo) - A (Yếu tay chân) - S (Nói đớ, ngọng) - T (Thời gian vàng: gọi 115 ngay lập tức trong vòng 3-4.5 giờ)."
                color="#38BDF8"
              />
              <TipCard
                icon="fire"
                title="3. Xử Trí Bỏng Nhiệt"
                desc="Xả nước mát sạch trực tiếp lên vết bỏng 15-20 phút. KHÔNG bôi kem đánh răng, mỡ trăn hay chọc vỡ bọng nước."
                color="#F59E0B"
              />
              <TipCard
                icon="lungs"
                title="4. Hóc Dị Vật & Ngạt Thở (Heimlich)"
                desc="Đứng sau lưng nạn nhân, vòng tay ôm eo, đặt nắm đấm trên rốn và giật mạnh hướng lên trên ra sau."
                color="#10B981"
              />
            </ScrollView>
          )}

          {/* MODAL: CALL STATUS & DETAILS (GET /calls/{id}/status & GET /calls/{id}) */}
          <Modal
            visible={showStatusModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowStatusModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>CHI TIẾT & TRẠNG THÁI</Text>
                    <Text style={styles.modalSubTitle}>
                      Mã cuộc gọi: #{selectedCallId}
                      {(() => {
                        const rId = (selectedCallDetails as any)?.requestId ?? (selectedCallDetails as any)?.dispatchRequestId ?? (selectedCallStatus as any)?.requestId;
                        return rId ? ` • Mã yêu cầu: #${rId}` : '';
                      })()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setShowStatusModal(false)}
                  >
                    <Ionicons name="close" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>

                {loadingStatusModal ? (
                  <View style={styles.modalLoadingBox}>
                    <ActivityIndicator size="large" color="#EF4444" />
                    <Text style={styles.modalLoadingText}>Đang tải trạng thái từ máy chủ...</Text>
                  </View>
                ) : (
                  <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
                    {/* Status Stepper */}
                    {(() => {
                      const currentStep = resolveCallStepIndex(selectedCallStatus, selectedCallDetails?.status);
                      const descText = resolveCallStatusDescription(selectedCallStatus);

                      return (
                        <>
                          <View style={styles.stepperBox}>
                            <StepItem
                              step={1}
                              title="1. Đã Tiếp Nhận Yêu Cầu"
                              active={currentStep >= 0}
                            />
                            <StepItem
                              step={2}
                              title="2. Đã Điều Phối Xe Cấp Cứu"
                              active={currentStep >= 1}
                            />
                            <StepItem
                              step={3}
                              title="3. Xe Đang Di Chuyển Đến Hiện Trường"
                              active={currentStep >= 2}
                            />
                            <StepItem
                              step={4}
                              title="4. Đội Cứu Hộ Đã Tiếp Cận Hiện Trường"
                              active={currentStep >= 3}
                            />
                            <StepItem
                              step={5}
                              title="5. Hoàn Tất Ca Cứu Hộ"
                              active={currentStep >= 4}
                            />
                          </View>

                          {/* Status Description Banner */}
                          <View style={styles.statusDescCard}>
                            <Ionicons name="information-circle" size={20} color="#38BDF8" />
                            <Text style={styles.statusDescText}>{descText}</Text>
                          </View>
                        </>
                      );
                    })()}

                    {/* Assigned Unit Details */}
                    {(() => {
                      const unit = selectedCallStatus?.assignedUnit;
                      const ext: any = typeof unit?.extended_attributes === 'string'
                        ? (() => { try { return JSON.parse(unit.extended_attributes); } catch { return {}; } })()
                        : unit?.extended_attributes || unit?.extendedAttributes;
                      const plate = ext?.license_plate || ext?.licensePlate || unit?.vehiclePlate;

                      if (!plate && !unit?.driverName) return null;

                      return (
                        <View style={styles.assignedUnitCard}>
                          <Text style={styles.assignedCardTitle}>ĐỘI XE CỨU THƯƠNG ĐƯỢC ĐIỀU PHỐI</Text>

                          {plate ? (
                            <View style={styles.unitDetailRow}>
                              <Text style={styles.unitLabel}>Biển số xe:</Text>
                              <Text style={[styles.unitValue, { color: '#34D399' }]}>
                                {plate}
                              </Text>
                            </View>
                          ) : null}
                          <View style={styles.unitDetailRow}>
                            <Text style={styles.unitLabel}>Bác sĩ / Tài xế:</Text>
                            <Text style={styles.unitValue}>
                              {unit?.driverName || 'Bác sĩ Hùng'}
                            </Text>
                          </View>
                          <View style={styles.unitDetailRow}>
                            <Text style={styles.unitLabel}>Đơn vị y tế:</Text>
                            <Text style={styles.unitValue}>
                              {unit?.hospitalName || 'Bệnh viện Cấp Cứu 115'}
                            </Text>
                          </View>
                        </View>
                      );
                    })()}

                    {/* Track Button in Modal */}
                    <TouchableOpacity
                      style={styles.modalTrackBtn}
                      onPress={() => {
                        setShowStatusModal(false);
                        router.push({
                          pathname: '/(citizen)/tracking',
                          params: {
                            id: String(selectedCallId),
                          },
                        });
                      }}
                    >
                      <FontAwesome5 name="map-marked-alt" size={16} color="#022C22" style={{ marginRight: 8 }} />
                      <Text style={styles.modalTrackBtnText}>MỞ BẢN ĐỒ THEO DÕI XE TRỰC TIẾP</Text>
                    </TouchableOpacity>

                    {/* Invoice Button in Modal */}
                    <TouchableOpacity
                      style={styles.modalInvoiceBtn}
                      onPress={() => {
                        setSelectedInvoiceCallId(selectedCallId);
                        setShowInvoiceModal(true);
                      }}
                    >
                      <MaterialCommunityIcons name="receipt-text-check" size={16} color="#10B981" style={{ marginRight: 8 }} />
                      <Text style={styles.modalInvoiceBtnText}>XEM HÓA ĐƠN & CHI PHÍ CẤP CỨU</Text>
                    </TouchableOpacity>
                  </ScrollView>
                )}
              </View>
            </View>
          </Modal>

          {/* Payment & Invoice Modal */}
          <PaymentInvoiceModal
            visible={showInvoiceModal}
            onClose={() => setShowInvoiceModal(false)}
            callId={selectedInvoiceCallId}
          />

        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

function resolveCallStepIndex(callStatusObj?: CallStatusResponse | null, fallbackStatus?: string): number {
  if (!callStatusObj && !fallbackStatus) return 0;
  const status = resolveEmergencyStatus(callStatusObj || { status: fallbackStatus });
  switch (status) {
    case 'COMPLETED':
      return 4; // Step 5: Hoàn tất ca cứu hộ
    case 'ARRIVED_HOSPITAL':
    case 'TRANSPORTING':
    case 'ARRIVED_SCENE':
      return 3; // Step 4: Đội cứu hộ đã tiếp cận hiện trường / đang chuyển viện
    case 'EN_ROUTE':
      return 2; // Step 3: Xe đang di chuyển đến hiện trường
    case 'DISPATCHED':
      return 1; // Step 2: Đã điều phối xe cấp cứu
    default:
      return 0; // Step 1: Đã tiếp nhận yêu cầu
  }
}

function resolveCallStatusDescription(callStatusObj?: CallStatusResponse | null): string {
  const status = resolveEmergencyStatus(callStatusObj);
  switch (status) {
    case 'COMPLETED':
      return 'Ca cứu hộ đã hoàn thành thành công. Bệnh nhân đã được tiếp nhận và xử lý.';
    case 'ARRIVED_HOSPITAL':
      return 'Xe cấp cứu đã đưa bệnh nhân đến bệnh viện an toàn.';
    case 'TRANSPORTING':
      return 'Đội ngũ y tế đang thực hiện chuyển bệnh nhân đến bệnh viện điều trị.';
    case 'ARRIVED_SCENE':
      return 'Đội cứu hộ và y bác sĩ đã có mặt tại hiện trường để sơ cấp cứu.';
    case 'EN_ROUTE':
      return 'Xe cấp cứu đang bật còi ưu tiên di chuyển khẩn cấp đến vị trí của bạn.';
    case 'DISPATCHED':
      return 'Tổng đài 115 đã tiếp nhận và điều phối xe cấp cứu phục vụ ca cứu nạn.';
    default:
      return (callStatusObj as any)?.statusDescription || 'Hệ thống 115 đã tiếp nhận và đang tích cực xử lý ca cấp cứu.';
  }
}

const StepItem = ({ step, title, active }: { step: number; title: string; active: boolean }) => (
  <View style={styles.stepRow}>
    <View style={[styles.stepCircle, active && styles.stepCircleActive]}>
      {active ? (
        <Ionicons name="checkmark-sharp" size={12} color="#FFF" />
      ) : (
        <Text style={styles.stepNum}>{step}</Text>
      )}
    </View>
    <Text style={[styles.stepTitle, active && styles.stepTitleActive]}>{title}</Text>
  </View>
);

const TipCard = ({ icon, title, desc, color }: { icon: any; title: string; desc: string; color: string }) => (
  <View style={styles.tipCard}>
    <View style={[styles.tipIconBox, { backgroundColor: `${color}15` }]}>
      <MaterialCommunityIcons name={icon} size={22} color={color} />
    </View>
    <View style={styles.tipContent}>
      <Text style={[styles.tipTitle, { color }]}>{title}</Text>
      <Text style={styles.tipDesc}>{desc}</Text>
    </View>
  </View>
);

const resolveCallListItemStatus = resolveEmergencyStatus;

const getStatusBadgeStyle = (status: string) => {
  switch ((status || '').toUpperCase()) {
    case 'PENDING':
    case 'RECEIVED':
      return { backgroundColor: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.3)' };
    case 'ASSIGNED':
    case 'DISPATCHED':
      return { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)' };
    case 'EN_ROUTE':
    case 'RUNNING':
      return { backgroundColor: 'rgba(249, 115, 22, 0.15)', borderColor: 'rgba(249, 115, 22, 0.3)' };
    case 'ARRIVED':
    case 'ARRIVED_SCENE':
    case 'TRANSPORTING':
    case 'ARRIVED_HOSPITAL':
      return { backgroundColor: 'rgba(167, 139, 250, 0.15)', borderColor: 'rgba(167, 139, 250, 0.3)' };
    case 'COMPLETED':
      return { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' };
    case 'CANCELLED':
      return { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' };
    default:
      return { backgroundColor: 'rgba(148, 163, 184, 0.15)', borderColor: 'rgba(148, 163, 184, 0.3)' };
  }
};

const getStatusText = (status: string) => {
  switch ((status || '').toUpperCase()) {
    case 'PENDING':
    case 'RECEIVED':
      return 'ĐÃ TIẾP NHẬN';
    case 'ASSIGNED':
    case 'DISPATCHED':
      return 'ĐÃ ĐIỀU PHỐI XE';
    case 'EN_ROUTE':
    case 'RUNNING':
      return 'XE ĐANG ĐẾN';
    case 'ARRIVED':
    case 'ARRIVED_SCENE':
      return 'ĐÃ ĐẾN HIỆN TRƯỜNG';
    case 'TRANSPORTING':
      return 'ĐANG CHUYỂN VIỆN';
    case 'ARRIVED_HOSPITAL':
      return 'ĐÃ TỚI BỆNH VIỆN';
    case 'COMPLETED':
      return 'HOÀN THÀNH';
    case 'CANCELLED':
      return 'ĐÃ HỦY';
    default:
      return 'ĐÃ TIẾP NHẬN';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070A10',
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 36 : 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerLeft: {
    flex: 1,
  },
  appBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  appBadgeText: {
    color: '#F87171',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  welcomeText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
  },
  paymentShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
  },
  paymentShortcutText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    gap: 8,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  tabItemActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  tabText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#F87171',
    fontWeight: '800',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  locationCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationInfoGroup: {
    flex: 1,
  },
  locationLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  locationCoords: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  refreshLocBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceEmergencyCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  sectionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sectionSubTitle: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  submitVoiceBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#38BDF8',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 14,
    elevation: 4,
  },
  submitVoiceBtnText: {
    color: '#082F49',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  flowBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
  },
  flowText: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  oneTapCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  textInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 12,
  },
  sosButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  bigSOSButton: {
    width: width * 0.52,
    height: width * 0.52,
    borderRadius: (width * 0.52) / 2,
    elevation: 16,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  bigSOSGradient: {
    flex: 1,
    borderRadius: (width * 0.52) / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  bigSOSText: {
    color: '#FFF',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 4,
  },
  bigSOSSubText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  // Tab 2 History Styles
  historyListContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  callHistoryCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  callCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  callIdBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  callIdText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    color: '#F8FAFC',
    fontSize: 9,
    fontWeight: '900',
  },
  callDescriptionText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  callMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  callActionsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  viewStatusBtn: {
    flex: 1.25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  viewStatusBtnText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  trackBtn: {
    flex: 1.05,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#10B981',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 8,
    elevation: 3,
  },
  trackBtnText: {
    color: '#022C22',
    fontSize: 10,
    fontWeight: '900',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
    gap: 10,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Tab 3 Tips Styles
  tipCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 14,
  },
  tipIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  tipDesc: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '900',
  },
  modalSubTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoadingBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  modalLoadingText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  modalScrollView: {
    gap: 14,
  },
  stepperBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 14,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#10B981',
  },
  stepNum: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
  },
  stepTitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  stepTitleActive: {
    color: '#F8FAFC',
    fontWeight: '800',
  },
  statusDescCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    marginBottom: 14,
  },
  statusDescText: {
    color: '#E0F2FE',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
    fontWeight: '600',
  },
  assignedUnitCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 16,
  },
  assignedCardTitle: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  unitDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  unitLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  unitValue: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  modalTrackBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 4,
    marginBottom: 10,
  },
  modalTrackBtnText: {
    color: '#022C22',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalInvoiceBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingVertical: 13,
    borderRadius: 14,
    marginBottom: 20,
  },
  modalInvoiceBtnText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  invoiceBtn: {
    flex: 0.85,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  invoiceBtnText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
  },
});
