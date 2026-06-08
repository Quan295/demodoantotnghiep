import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { SOSButton } from '@/components/SOSButton';

export default function SOSScreen() {
  const router = useRouter();
  
  // App states
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  
  // Developer simulation states (for graduation demo)
  const [simulateGpsError, setSimulateGpsError] = useState(false);
  const [simulateNetworkError, setSimulateNetworkError] = useState(false);
  const [showSimControls, setShowSimControls] = useState(false);

  // Function to handle SOS trigger
  const handleSOSTrigger = async () => {
    setLoading(true);
    setStatusText('Đang khởi động module định vị GPS...');

    try {
      // 1. Get GPS coordinates
      let locationData = null;
      
      if (simulateGpsError) {
        // Mocking GPS Off exception (EX01.1)
        throw new Error('GPS_DISABLED');
      }

      // Real GPS request
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('PERMISSION_DENIED');
      }

      // Check if location services are enabled
      let isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        throw new Error('GPS_DISABLED');
      }

      setStatusText('Đang lấy vị trí GPS chính xác cao (<10m)...');
      
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });

      locationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };

      // 2. Send SOS Request with Retry logic (EX01.2)
      setStatusText('Đang truyền tín hiệu cứu nạn khẩn cấp...');
      await sendSOSWithRetry(locationData);

    } catch (error: any) {
      console.log('SOS Error: ', error.message);
      setLoading(false);
      
      if (error.message === 'GPS_DISABLED' || error.message === 'PERMISSION_DENIED') {
        // EX01.1: GPS Off / Permission Denied
        handleGpsException();
      } else if (error.message === 'NETWORK_FAILED') {
        // EX01.2: Network Timeout
        handleNetworkException();
      } else {
        Alert.alert('Lỗi không xác định', 'Đã xảy ra lỗi khi kích hoạt SOS. Vui lòng gọi trực tiếp 115!');
      }
    }
  };

  // GPS Exception Flow (EX01.1)
  const handleGpsException = () => {
    Alert.alert(
      'CẢNH BÁO: Không Có GPS',
      'Ứng dụng không thể truy cập định vị GPS. Hệ thống sẽ sử dụng vị trí mạng ước lượng hoặc bạn cần bật GPS ngay.',
      [
        {
          text: 'GỌI 115 NGAY',
          onPress: () => callHotline(),
          style: 'destructive',
        },
        {
          text: 'Dùng Vị Trí Mạng Ước Lượng',
          onPress: () => {
            // Fallback: Mock network location (IP/Cell Tower)
            const mockLocation = {
              latitude: 21.028511, // Hanoi Coordinates as fallback
              longitude: 105.804817,
              accuracy: 2500, // 2.5km accuracy
            };
            setLoading(true);
            setStatusText('Đang kết nối bằng định vị ước lượng...');
            setTimeout(() => {
              sendSOSWithRetry(mockLocation);
            }, 1000);
          }
        }
      ]
    );
  };

  // Network Exception Flow (EX01.2)
  const handleNetworkException = () => {
    Alert.alert(
      'MẤT KẾT NỐI MẠNG',
      'Không thể truyền tín hiệu SOS về trung tâm cứu hộ sau 3 lần thử lại. Vui lòng gọi điện trực tiếp!',
      [
        {
          text: 'GỌI 115 KHẨN CẤP',
          onPress: () => callHotline(),
          style: 'destructive',
        },
        { text: 'Đóng', style: 'cancel' }
      ]
    );
  };

  // Mock server sending with 3-times retry logic
  const sendSOSWithRetry = async (location: any) => {
    let retries = 0;
    const maxRetries = 3;
    
    const trySend = async (): Promise<boolean> => {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (simulateNetworkError) {
            reject(new Error('CONN_ERROR'));
          } else {
            resolve(true);
          }
        }, 1200); // 1.2 seconds per connection request
      });
    };

    while (retries < maxRetries) {
      try {
        setStatusText(`Đang truyền tín hiệu... (Thử lại ${retries + 1}/${maxRetries})`);
        await trySend();
        
        // Success!
        setLoading(false);
        // Navigate to tracking screen and pass location data
        router.push({
          pathname: '/(citizen)/tracking',
          params: { 
            lat: location.latitude, 
            lng: location.longitude, 
            acc: location.accuracy 
          }
        });
        return;
      } catch (err) {
        retries++;
        if (retries >= maxRetries) {
          throw new Error('NETWORK_FAILED');
        }
      }
    }
  };

  const callHotline = () => {
    const phone = '115';
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Không thể thực hiện cuộc gọi', 'Thiết bị của bạn không hỗ trợ chức năng gọi điện trực tiếp.');
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C0E12" />
      <SafeAreaView style={styles.safeArea}>
        
        {/* Top bar with back button & simulation settings */}
        <View style={styles.topBar}>
          <TouchableOpacity 
            onPress={() => router.replace('/')} 
            style={[styles.topButton, { backgroundColor: '#151B26' }]}
          >
            <Ionicons name="arrow-back" size={20} color="#F9FAFB" />
          </TouchableOpacity>

          <Text style={styles.screenTitle}>Báo Cáo Khẩn Cấp</Text>

          <TouchableOpacity 
            onPress={() => setShowSimControls(!showSimControls)} 
            style={[
              styles.topButton, 
              { backgroundColor: showSimControls ? '#F04438' : '#151B26' }
            ]}
          >
            <Ionicons name="options-outline" size={20} color="#F9FAFB" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer}>
          {/* Simulation Dashboard */}
          {showSimControls && (
            <View style={styles.simPanel}>
              <View style={styles.simPanelHeader}>
                <MaterialCommunityIcons name="test-tube" size={18} color="#F04438" />
                <Text style={styles.simPanelTitle}>MÔ PHỎNG LỖI ĐỒ ÁN (EXCEPTIONS)</Text>
              </View>

              <View style={styles.simOption}>
                <Text style={styles.simLabel}>Mô phỏng tắt GPS (EX01.1):</Text>
                <TouchableOpacity 
                  onPress={() => setSimulateGpsError(!simulateGpsError)}
                  style={[
                    styles.simToggle, 
                    { backgroundColor: simulateGpsError ? '#F04438' : '#344054' }
                  ]}
                >
                  <Text style={styles.simToggleText}>{simulateGpsError ? 'ĐANG BẬT LỖI' : 'TẮT LỖI'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.simOption}>
                <Text style={styles.simLabel}>Mô phỏng mất mạng (EX01.2):</Text>
                <TouchableOpacity 
                  onPress={() => setSimulateNetworkError(!simulateNetworkError)}
                  style={[
                    styles.simToggle, 
                    { backgroundColor: simulateNetworkError ? '#F04438' : '#344054' }
                  ]}
                >
                  <Text style={styles.simToggleText}>{simulateNetworkError ? 'ĐANG BẬT LỖI' : 'TẮT LỖI'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.simTip}>
                * Sử dụng để trình diễn các luồng ngoại lệ trực tiếp trước hội đồng chấm.
              </Text>
            </View>
          )}

          {/* SOS Trigger Area */}
          <View style={styles.sosContainer}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#F04438" />
                <Text style={styles.loadingStatusText}>{statusText}</Text>
                <Text style={styles.loadingSubText}>Vui lòng giữ điện thoại ở khu vực thoáng đãng để GPS đạt độ chính xác tốt nhất.</Text>
                
                <TouchableOpacity style={styles.cancelLoadingButton} onPress={() => setLoading(false)}>
                  <Text style={styles.cancelLoadingText}>Hủy Yêu Cầu</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.instructionContainer}>
                  <Text style={styles.instructionTitle}>Gặp Sự Cố Khẩn Cấp?</Text>
                  <Text style={styles.instructionDesc}>
                    Ấn giữ nút tròn bên dưới trong vòng 2 giây. Vị trí chính xác của bạn sẽ được gửi thẳng đến trung tâm điều phối 115 để điều xe cứu thương.
                  </Text>
                </View>

                <SOSButton onTrigger={handleSOSTrigger} />

                {/* Direct Dial Alternative */}
                <View style={styles.phoneDialContainer}>
                  <Text style={styles.orText}>HOẶC GỌI TRỰC TIẾP</Text>
                  <TouchableOpacity 
                    activeOpacity={0.8}
                    style={styles.hotlineButton} 
                    onPress={callHotline}
                  >
                    <Ionicons name="call" size={20} color="#FFF" />
                    <Text style={styles.hotlineText}>GỌI NGAY ĐƯỜNG DÂY NÓNG 115</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0E12',
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2A37',
  },
  topButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenTitle: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  simPanel: {
    backgroundColor: '#151B26',
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#1F2A37',
  },
  simPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  simPanelTitle: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  simOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  simLabel: {
    color: '#D0D5DD',
    fontSize: 12,
    fontWeight: '600',
  },
  simToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    width: 100,
    alignItems: 'center',
  },
  simToggleText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  simTip: {
    color: '#98A2B3',
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 6,
  },
  sosContainer: {
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 24,
  },
  instructionContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  instructionTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
  },
  instructionDesc: {
    color: '#98A2B3',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  loadingContainer: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingStatusText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 24,
    textAlign: 'center',
  },
  loadingSubText: {
    color: '#667085',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
  cancelLoadingButton: {
    marginTop: 40,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1F2A37',
  },
  cancelLoadingText: {
    color: '#D0D5DD',
    fontSize: 13,
    fontWeight: '700',
  },
  phoneDialContainer: {
    marginTop: 30,
    width: '100%',
    alignItems: 'center',
  },
  orText: {
    color: '#475467',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 16,
  },
  hotlineButton: {
    flexDirection: 'row',
    backgroundColor: '#D92D20',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  hotlineText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
