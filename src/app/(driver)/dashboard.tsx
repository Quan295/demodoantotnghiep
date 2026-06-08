import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  FlatList,
  StatusBar,
  Alert,
  Vibration,
  Platform,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';

interface LocationLog {
  id: string;
  time: string;
  coords: string;
  status: string;
}

export default function DriverDashboard() {
  const router = useRouter();
  
  // State variables
  const [isAvailable, setIsAvailable] = useState(false);
  const [driverLocation, setDriverLocation] = useState<Location.LocationObject | null>(null);
  const [gpsLogs, setGpsLogs] = useState<LocationLog[]>([]);
  const [showIncomingOrder, setShowIncomingOrder] = useState(false);
  
  // Animation values
  const flashAnim = useRef(new Animated.Value(0)).current;

  // Timers
  const locationInterval = useRef<any>(null);
  const orderSimulationTimeout = useRef<any>(null);

  // Red Alert Flash Animation
  useEffect(() => {
    let flashLoop: Animated.CompositeAnimation | null = null;
    if (showIncomingOrder) {
      if (Platform.OS !== 'web') {
        Vibration.vibrate([0, 500, 200, 500], true); // Constant vibration
      }
      flashLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(flashAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: false,
          }),
          Animated.timing(flashAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: false,
          }),
        ])
      );
      flashLoop.start();
    } else {
      if (Platform.OS !== 'web') {
        Vibration.cancel();
      }
      flashAnim.setValue(0);
    }

    return () => {
      if (flashLoop) flashLoop.stop();
      if (Platform.OS !== 'web') {
        Vibration.cancel();
      }
    };
  }, [showIncomingOrder]);

  // Handle availability toggle
  useEffect(() => {
    if (isAvailable) {
      // 1. Start periodic GPS tracking (every 5 seconds)
      startGpsTracking();
      
      // 2. Schedule simulated dispatch call after 6 seconds
      orderSimulationTimeout.current = setTimeout(() => {
        setShowIncomingOrder(true);
      }, 6000);
      
    } else {
      // Stop tracking
      stopGpsTracking();
      if (orderSimulationTimeout.current) {
        clearTimeout(orderSimulationTimeout.current);
      }
    }

    return () => {
      stopGpsTracking();
      if (orderSimulationTimeout.current) {
        clearTimeout(orderSimulationTimeout.current);
      }
    };
  }, [isAvailable]);

  const startGpsTracking = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền định vị bị từ chối', 'Ứng dụng cần quyền định vị để cập nhật vị trí xe cứu thương.');
        setIsAvailable(false);
        return;
      }

      // Initial location fetch
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setDriverLocation(loc);
      addGpsLog(loc.coords.latitude, loc.coords.longitude);

      // Loop tracking every 5 seconds
      locationInterval.current = setInterval(async () => {
        const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setDriverLocation(currentLoc);
        addGpsLog(currentLoc.coords.latitude, currentLoc.coords.longitude);
      }, 5000);

    } catch (error) {
      console.log('Error in driver GPS tracking:', error);
      // Fallback if location fails (e.g. mock locations)
      const mockLat = 21.034567;
      const mockLng = 105.812345;
      addGpsLog(mockLat, mockLng);
      locationInterval.current = setInterval(() => {
        addGpsLog(mockLat + (Math.random() - 0.5) * 0.0002, mockLng + (Math.random() - 0.5) * 0.0002);
      }, 5000);
    }
  };

  const stopGpsTracking = () => {
    if (locationInterval.current) {
      clearInterval(locationInterval.current);
      locationInterval.current = null;
    }
  };

  const addGpsLog = (lat: number, lng: number) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const newLog: LocationLog = {
      id: Math.random().toString(),
      time: timeStr,
      coords: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      status: 'SENT_OK (PostGIS Update)',
    };
    setGpsLogs(prev => [newLog, ...prev].slice(0, 15)); // Keep last 15 logs
  };

  const handleAcceptOrder = () => {
    setShowIncomingOrder(false);
    setIsAvailable(false); // Set status to busy during ride
    
    // Navigate to navigation screen with mock case parameters
    router.push({
      pathname: '/(driver)/navigation',
      params: {
        victimLat: 21.028511, // Hanoi coordinates for victim
        victimLng: 105.804817,
        victimName: 'Nguyễn Văn A',
        victimPhone: '0987.654.321',
        victimAddress: '12 Chùa Bộc, Đống Đa, Hà Nội',
        victimInjury: 'Tai nạn giao thông - Chấn thương chân, chảy máu nhiều',
      }
    });
  };

  const handleDeclineOrder = () => {
    setShowIncomingOrder(false);
    if (Platform.OS !== 'web') {
      Vibration.cancel();
    }
    // Re-schedule simulation for demo
    orderSimulationTimeout.current = setTimeout(() => {
      setShowIncomingOrder(true);
    }, 10000);
  };

  // Interpolate flashing color for emergency incoming order
  const flashBgColor = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#1E1616', '#3D1515'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C0E12" />
      <SafeAreaView style={styles.safeArea}>
        
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.replace('/')} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Hệ Máy Tài Xế</Text>
            <Text style={styles.headerSubtitle}>Xe Cứu Thương #115-A</Text>
          </View>
          <View style={styles.driverAvatar}>
            <Text style={styles.avatarText}>TX</Text>
          </View>
        </View>

        {/* Main Status Control Panel */}
        <View style={styles.statusPanel}>
          <View style={styles.panelRow}>
            <View style={styles.panelLabelContainer}>
              <MaterialCommunityIcons 
                name={isAvailable ? "check-circle" : "close-circle"} 
                size={22} 
                color={isAvailable ? "#32D583" : "#98A2B3"} 
              />
              <Text style={styles.panelTitle}>Trạng Thái Hoạt Động</Text>
            </View>
            <Switch
              trackColor={{ false: '#344054', true: '#32D583' }}
              thumbColor={isAvailable ? '#FFF' : '#98A2B3'}
              onValueChange={setIsAvailable}
              value={isAvailable}
            />
          </View>
          
          <Text style={[styles.statusValueText, { color: isAvailable ? '#32D583' : '#98A2B3' }]}>
            {isAvailable ? 'SẴN SÀNG NHẬN LỆNH (AVAILABLE)' : 'ĐANG TẮT ĐỊNH VỊ (OFFLINE)'}
          </Text>

          <Text style={styles.panelDesc}>
            Khi ở trạng thái sẵn sàng, điện thoại của bạn sẽ định kỳ gửi GPS định vị về máy chủ mỗi 5 giây để PostGIS tính toán xe cứu thương tối ưu nhất cho nạn nhân.
          </Text>
        </View>

        {/* Live GPS Console Logs */}
        <View style={styles.consoleContainer}>
          <View style={styles.consoleHeader}>
            <Ionicons name="terminal-outline" size={16} color="#475467" />
            <Text style={styles.consoleTitle}>GPS POSITION LOG CONSOLE</Text>
          </View>

          {gpsLogs.length === 0 ? (
            <View style={styles.emptyConsole}>
              <Text style={styles.emptyConsoleText}>
                {isAvailable ? 'Đang kết nối GPS...' : 'Hãy gạt công tắc sẵn sàng phía trên để khởi động tracking...'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={gpsLogs}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={styles.logRow}>
                  <Text style={styles.logTime}>[{item.time}]</Text>
                  <Text style={styles.logCoords}>GPS: {item.coords}</Text>
                  <Text style={styles.logStatus}>{item.status}</Text>
                </View>
              )}
              style={styles.logList}
            />
          )}
        </View>

        {/* Incoming Dispatch Emergency Modal/Alert */}
        {showIncomingOrder && (
          <Animated.View style={[styles.emergencyOverlay, { backgroundColor: flashBgColor }]}>
            <View style={styles.emergencyCard}>
              
              {/* Pulsing Bell Icon */}
              <View style={styles.emergencyIconContainer}>
                <MaterialCommunityIcons name="bell-ring" size={44} color="#F04438" />
              </View>

              <Text style={styles.emergencyTitle}>LỆNH ĐIỀU PHỐI KHẨN CẤP!</Text>
              <Text style={styles.emergencySubtitle}>Từ Trung tâm Điều phối 115</Text>
              
              <View style={styles.divider} />

              {/* Case Details */}
              <View style={styles.detailsList}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>NẠN NHÂN</Text>
                  <Text style={styles.detailValue}>Nguyễn Văn A (Nam, ~30 tuổi)</Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>SỰ CỐ Y TẾ</Text>
                  <Text style={[styles.detailValue, { color: '#F04438', fontWeight: '800' }]}>
                    Tai nạn giao thông - Chấn thương chân, chảy máu nhiều
                  </Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>ĐỊA CHỈ</Text>
                  <Text style={styles.detailValue}>12 Chùa Bộc, Đống Đa, Hà Nội</Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>BÁN KÍNH TÍNH TOÁN (POSTGIS)</Text>
                  <Text style={styles.detailValue}>Tìm thấy xe bạn ở cự ly gần nhất (~1.2 km)</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.emergencyActions}>
                <TouchableOpacity 
                  activeOpacity={0.8}
                  style={styles.declineButton} 
                  onPress={handleDeclineOrder}
                >
                  <Text style={styles.declineText}>TỪ CHỐI</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  activeOpacity={0.8}
                  style={styles.acceptButton} 
                  onPress={handleAcceptOrder}
                >
                  <Text style={styles.acceptText}>TIẾP NHẬN</Text>
                </TouchableOpacity>
              </View>

            </View>
          </Animated.View>
        )}

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2A37',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#151B26',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#98A2B3',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  driverAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D92D20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  statusPanel: {
    backgroundColor: '#151B26',
    margin: 20,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1F2A37',
  },
  panelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panelLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  panelTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  statusValueText: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  panelDesc: {
    color: '#667085',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
  },
  consoleContainer: {
    flex: 1,
    backgroundColor: '#07090D',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2A37',
  },
  consoleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2A37',
    paddingBottom: 10,
    marginBottom: 10,
  },
  consoleTitle: {
    color: '#475467',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  emptyConsole: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyConsoleText: {
    color: '#475467',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  logList: {
    flex: 1,
  },
  logRow: {
    flexDirection: 'row',
    marginVertical: 4,
    flexWrap: 'wrap',
  },
  logTime: {
    color: '#32D583',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginRight: 6,
  },
  logCoords: {
    color: '#FFF',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginRight: 6,
    flex: 1,
  },
  logStatus: {
    color: '#98A2B3',
    fontSize: 10,
    fontStyle: 'italic',
  },
  emergencyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    paddingHorizontal: 24,
  },
  emergencyCard: {
    width: '100%',
    backgroundColor: '#151B26',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F04438',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  emergencyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(240, 68, 56, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emergencyTitle: {
    color: '#F04438',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  emergencySubtitle: {
    color: '#98A2B3',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#1F2A37',
    width: '100%',
    marginVertical: 18,
  },
  detailsList: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  detailItem: {
    width: '100%',
  },
  detailLabel: {
    color: '#475467',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  detailValue: {
    color: '#F9FAFB',
    fontSize: 13,
    fontWeight: '600',
  },
  emergencyActions: {
    flexDirection: 'row',
    gap: 14,
    width: '100%',
  },
  declineButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1F2A37',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  declineText: {
    color: '#D0D5DD',
    fontSize: 13,
    fontWeight: '800',
  },
  acceptButton: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F04438',
    alignItems: 'center',
    elevation: 3,
  },
  acceptText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
