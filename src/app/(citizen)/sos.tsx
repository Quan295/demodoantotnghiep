import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

const SOSScreen = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [description, setDescription] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [myCalls, setMyCalls] = useState<EmergencyCall[]>([]);
  const [activeTab, setActiveTab] = useState<'sos' | 'history'>('sos');

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

  const handleVoiceCall = async () => {
    setLoading(true);
    try {
      await api.createVoiceCall({
        phoneNumber: phoneNumber.trim() || undefined,
        description: description.trim() || undefined,
      });
      Alert.alert('Thành công', 'Yêu cầu gọi cấp cứu đã được gửi!');
    } catch (error: any) {
      Alert.alert('Gửi thất bại', error.message || 'Vui lòng thử lại sau');
    } finally {
      setLoading(false);
    }
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
        return styles.statusPending;
      case 'assigned':
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
        return 'Đang chờ';
      case 'assigned':
        return 'Đã điều phối';
      case 'completed':
        return 'Hoàn thành';
      default:
        return status;
    }
  };

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

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Mô tả tình trạng khẩn cấp</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Nhập mô tả..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
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
              />
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.sosButton}
                onPress={handleSOS}
                disabled={loading || !location}
              >
                <Ionicons name="warning" size={24} color="#FFF" />
                <Text style={styles.sosButtonText}>
                  {loading ? 'Đang gửi...' : 'Gửi SOS'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.callButton}
                onPress={handleVoiceCall}
                disabled={loading}
              >
                <Ionicons name="call" size={24} color="#FFF" />
                <Text style={styles.sosButtonText}>
                  {loading ? 'Đang gửi...' : 'Gọi Cấp Cứu'}
                </Text>
              </TouchableOpacity>
            </View>
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
  sosButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
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
