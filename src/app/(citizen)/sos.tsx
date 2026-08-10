import { api } from '@/services/api';
import { EmergencyRecorder, RecorderStatus } from '@/components/EmergencyRecorder';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface EmergencyCall {
  id: string;
  status: string;
  description?: string;
  createdAt: string;
  latitude?: number;
  longitude?: number;
}

type SubmitFlowStatus =
  | 'none'
  | 'uploading'
  | 'submitting'
  | 'waiting_ai'
  | 'success'
  | 'error';

const SOSScreen = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [description, setDescription] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [myCalls, setMyCalls] = useState<EmergencyCall[]>([]);
  const [activeTab, setActiveTab] = useState<'sos' | 'history'>('sos');

  // Recorder state
  const [recorderStatus, setRecorderStatus] = useState<RecorderStatus>('idle');
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [durationMillis, setDurationMillis] = useState(0);

  // Flow state for submit flow
  const [flowStatus, setFlowStatus] = useState<SubmitFlowStatus>('none');
  const [flowError, setFlowError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [lastCallResult, setLastCallResult] = useState<any>(null);

  const flowBusy = useMemo(
    () => flowStatus === 'uploading' || flowStatus === 'submitting' || flowStatus === 'waiting_ai',
    [flowStatus],
  );

  const getCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Bạn cần cấp quyền vị trí để sử dụng tính năng này');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc);
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Lỗi', 'Không thể lấy vị trí hiện tại');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSOS = async () => {
    if (!location) {
      Alert.alert('Lỗi', 'Vui lòng lấy vị trí trước khi gửi SOS');
      return;
    }

    setLoading(true);
    try {
      const callResult = await api.createSosCall({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        description: description.trim() || undefined,
      });
      setDescription('');
      const callId = (callResult as any)?.id;
      Alert.alert('Thành công', 'Yêu cầu cứu hộ đã được gửi!', [
        {
          text: 'Theo dõi xe cứu thương',
          onPress: () => {
            router.push({
              pathname: '/(citizen)/tracking',
              params: {
                lat: location.coords.latitude.toString(),
                lng: location.coords.longitude.toString(),
                ...(callId ? { id: callId, missionId: callId } : {}),
              },
            });
          },
        },
        { text: 'Đóng' },
      ]);
    } catch (error: any) {
      Alert.alert('Gửi SOS thất bại', error.message || 'Vui lòng thử lại sau');
    } finally {
      setLoading(false);
    }
  };

  // Flow chính cho Ghi âm → Upload MinIO → Gọi POST /calls/voice → Đợi AI
  const handleSubmitVoiceEmergency = async () => {
    if (!location) {
      Alert.alert('Lỗi', 'Vui lòng lấy vị trí trước khi gửi cuộc gọi cấp cứu');
      return;
    }
    if (!audioUri || recorderStatus !== 'recorded') {
      Alert.alert('Lỗi', 'Vui lòng ghi âm trước khi gửi');
      return;
    }
    if (flowBusy) return;

    setFlowError(null);
    setLastCallResult(null);

    if (!idempotencyKey) {
      setIdempotencyKey(`voice-call-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
    }

    try {
      setFlowStatus('uploading');
      const uploaded = await api.uploadRecording(audioUri, idempotencyKey ?? undefined);
      if (!uploaded?.objectKey) {
        throw new Error('Backend không trả về objectKey sau khi upload');
      }

      setFlowStatus('submitting');
      const result = await api.createVoiceCall({
        audioObjectKey: uploaded.objectKey,
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        description: description.trim() || undefined,
      });
      setLastCallResult(result);

      setFlowStatus('waiting_ai');
      // Giả lập thời gian AI xử lý
      await new Promise(resolve => setTimeout(resolve, 2000));

      setFlowStatus('success');

      const callId = (result as any)?.id;
      Alert.alert(
        'Gửi thành công 🎉',
        'Hệ thống đã nhận và đang phân tích cuộc gọi cấp cứu.\nĐiều phối viên sẽ liên hệ và điều phối đội cứu hộ cho bạn sớm nhất!',
        [
          {
            text: 'Theo dõi cuộc gọi',
            onPress: () => {
              router.push({
                pathname: '/(citizen)/tracking',
                params: {
                  lat: location.coords.latitude.toString(),
                  lng: location.coords.longitude.toString(),
                  ...(callId ? { id: callId, missionId: callId } : {}),
                },
              });
            },
          },
          {
            text: 'Gửi lại mới',
            onPress: () => {
              setAudioUri(null);
              setDurationMillis(0);
              setRecorderStatus('idle');
              setIdempotencyKey(null);
              setFlowStatus('none');
              setDescription('');
            },
          },
        ],
      );
    } catch (e: any) {
      console.error('[Voice SOS] submit failed:', e?.message || e);
      setFlowError(e?.message || 'Gửi cuộc gọi cấp cứu thất bại');
      setFlowStatus('error');
      Alert.alert('Gửi thất bại', e?.message || 'Vui lòng kiểm tra mạng hoặc thử lại sau');
    }
  };

  const resetFlow = () => {
    setAudioUri(null);
    setDurationMillis(0);
    setRecorderStatus('idle');
    setIdempotencyKey(null);
    setFlowStatus('none');
    setFlowError(null);
    setLastCallResult(null);
  };

  const fetchMyCalls = async () => {
    setLoading(true);
    try {
      const calls = await api.getMyCalls();
      setMyCalls(Array.isArray(calls) ? calls : []);
    } catch (error: any) {
      console.error('Fetch calls error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      router.replace('/');
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchMyCalls();
    }
  }, [activeTab]);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const renderCallItem = ({ item }: { item: EmergencyCall }) => (
    <TouchableOpacity
      style={styles.callItem}
      activeOpacity={0.7}
      onPress={() => {
        const lat = typeof item.latitude === 'number' ? item.latitude.toString() : undefined;
        const lng = typeof item.longitude === 'number' ? item.longitude.toString() : undefined;
        const statusLower = item.status.toLowerCase();
        if (statusLower === 'completed' || statusLower === 'cancelled') {
          return;
        }
        router.push({
          pathname: '/(citizen)/tracking',
          params: {
            ...(lat ? { lat } : {}),
            ...(lng ? { lng } : {}),
            id: item.id,
            missionId: item.id,
          },
        });
      }}
    >
      <View style={styles.callHeader}>
        <Text style={styles.callId}>Cuộc gọi #{item.id}</Text>
        <View style={[styles.callStatus, getStatusStyle(item.status)]}>
          <Text style={styles.callStatusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>
      {item.description && (
        <Text style={styles.callDescription}>{item.description}</Text>
      )}
      <Text style={styles.callTime}>
        {new Date(item.createdAt).toLocaleString('vi-VN')}
      </Text>
    </TouchableOpacity>
  );

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
      case 'received':
        return styles.statusPending;
      case 'assigned':
      case 'confirmed':
        return styles.statusAssigned;
      case 'completed':
        return styles.statusCompleted;
      default:
        return styles.statusPending;
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
      case 'received':
        return 'Đang chờ';
      case 'assigned':
      case 'confirmed':
        return 'Đã điều phối';
      case 'completed':
        return 'Hoàn thành';
      default:
        return status;
    }
  };

  const getFlowStatusInfo = () => {
    switch (flowStatus) {
      case 'uploading':
        return { label: 'Đang upload file ghi âm lên hệ thống', icon: 'cloud-upload-outline', color: '#3b82f6' };
      case 'submitting':
        return { label: 'Đang gửi yêu cầu cấp cứu', icon: 'send-outline', color: '#8b5cf6' };
      case 'waiting_ai':
        return { label: 'AI đang phân tích giọng nói...', icon: 'hourglass-outline', color: '#f59e0b' };
      case 'success':
        return { label: 'Gửi thành công!', icon: 'checkmark-circle-outline', color: '#10b981' };
      case 'error':
        return { label: flowError || 'Gửi thất bại', icon: 'alert-circle-outline', color: '#ef4444' };
      default:
        return null;
    }
  };

  const flowInfo = getFlowStatusInfo();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ứng Dụng Cứu Hộ</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sos' && styles.activeTab]}
          onPress={() => setActiveTab('sos')}
        >
          <Text style={[styles.tabText, activeTab === 'sos' && styles.activeTabText]}>
            SOS
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            Lịch sử
          </Text>
        </TouchableOpacity>
      </View>

      {/* SOS Tab Content */}
      {activeTab === 'sos' && (
        <ScrollView style={styles.content}>
          <View style={styles.sosSection}>
            <View style={styles.locationContainer}>
              <TouchableOpacity
                style={styles.locationButton}
                onPress={getCurrentLocation}
                disabled={locationLoading}
              >
                <Ionicons name="location-sharp" size={20} color="#10b981" />
                <Text style={styles.locationButtonText}>
                  {locationLoading
                    ? 'Đang lấy vị trí...'
                    : location
                    ? 'Đã lấy vị trí'
                    : 'Lấy vị trí hiện tại'}
                </Text>
              </TouchableOpacity>
              {location && (
                <Text style={styles.locationText}>
                  Vĩ độ: {location.coords.latitude.toFixed(6)}
                  {'\n'}Kinh độ: {location.coords.longitude.toFixed(6)}
                </Text>
              )}
            </View>

            {/* Emergency Voice Recorder */}
            <View style={styles.voiceSectionHeader}>
              <Ionicons name="mic-circle" size={20} color="#10b981" />
              <Text style={styles.voiceSectionTitle}>Gọi cấp cứu bằng giọng nói</Text>
            </View>

            <EmergencyRecorder
              status={recorderStatus}
              onStatusChange={setRecorderStatus}
              audioUri={audioUri}
              onAudioUriChange={setAudioUri}
              durationMillis={durationMillis}
              onDurationChange={setDurationMillis}
              disabled={flowBusy}
            />

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Mô tả tình trạng khẩn cấp (tùy chọn)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Nhập mô tả..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                editable={!flowBusy}
              />
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Số điện thoại liên hệ (tùy chọn)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Nhập số điện thoại..."
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                editable={!flowBusy}
              />
            </View>

            {/* Flow status indicator */}
            {flowInfo && (
              <View style={[styles.flowContainer, { borderLeftColor: flowInfo.color }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {flowBusy ? (
                    <ActivityIndicator size="small" color={flowInfo.color} />
                  ) : (
                    <Ionicons name={flowInfo.icon as any} size={18} color={flowInfo.color} />
                  )}
                  <Text style={[styles.flowLabel, { color: flowInfo.color }]}>
                    {flowInfo.label}
                  </Text>
                </View>
                {lastCallResult?.id && (
                  <Text style={styles.flowSub}>
                    Mã cuộc gọi: #{lastCallResult.id}
                  </Text>
                )}
              </View>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.sosButton}
                onPress={handleSOS}
                disabled={loading || !location || flowBusy}
              >
                <Ionicons name="warning" size={24} color="#FFF" />
                <Text style={styles.sosButtonText}>
                  {loading ? 'Đang gửi...' : 'Gửi SOS'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.callButton,
                  (flowBusy || !audioUri || recorderStatus !== 'recorded') && styles.callButtonDisabled,
                ]}
                onPress={handleSubmitVoiceEmergency}
                disabled={flowBusy || loading || !location || !audioUri || recorderStatus !== 'recorded'}
              >
                <Ionicons
                  name={flowBusy ? 'hourglass' : 'send'} size={24} color="#FFF" />
                <Text style={styles.sosButtonText}>
                  {flowStatus === 'uploading'
                    ? 'Upload...'
                    : flowStatus === 'submitting'
                    ? 'Gửi...'
                    : flowStatus === 'waiting_ai'
                    ? 'AI xử lý...'
                    : 'Gửi bằng giọng nói'}
                </Text>
              </TouchableOpacity>
            </View>

            {(flowStatus === 'success' || flowStatus === 'error') && (
              <TouchableOpacity
              style={styles.resetBtn}
              onPress={resetFlow}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh-outline" size={18} color="#4b5563" />
              <Text style={styles.resetBtnText}>Bắt đầu lại</Text>
            </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      {/* History Tab Content */}
      {activeTab === 'history' && (
        <View style={styles.historyContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#10b981" />
            </View>
          ) : myCalls.length > 0 ? (
            <FlatList
              data={myCalls}
              keyExtractor={(item) => item.id}
              renderItem={renderCallItem}
              contentContainerStyle={styles.callList}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="time-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>Chưa có lịch sử cuộc gọi</Text>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    backgroundColor: '#10b981',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#10b981',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#10b981',
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  sosSection: {
    padding: 20,
  },
  locationContainer: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  locationButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  locationText: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 18,
  },
  voiceSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  voiceSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  inputSection: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9fafb',
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  sosButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#ef4444',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
    opacity: 1,
  },
  callButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#10b981',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  callButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowColor: '#9ca3af',
  },
  sosButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resetBtn: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignSelf: 'center',
    minWidth: 200,
  },
  resetBtnText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  flowContainer: {
      backgroundColor: '#FFF',
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
      borderLeftWidth: 4,
      gap: 6,
  },
  flowLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  flowSub: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  historyContainer: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callList: {
    gap: 12,
  },
  callItem: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  callHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  callId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  callStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusPending: {
    backgroundColor: '#fef3c7',
  },
  statusAssigned: {
    backgroundColor: '#dbeafe',
  },
  statusCompleted: {
    backgroundColor: '#d1fae5',
  },
  callStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
  },
  callDescription: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 8,
  },
  callTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
  },
});

export default SOSScreen;
