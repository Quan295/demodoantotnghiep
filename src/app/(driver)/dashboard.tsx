import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  Vibration,
  View
} from 'react-native';

const { width, height } = Dimensions.get('window');

interface LocationLog {
  id: string;
  time: string;
  coords: string;
  status: string;
}

export default function DriverDashboard() {
  const router = useRouter();
  
  const [isAvailable, setIsAvailable] = useState(false);
  const [gpsLogs, setGpsLogs] = useState<LocationLog[]>([]);
  const [showIncomingOrder, setShowIncomingOrder] = useState(false);
  
  const flashAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  const radarScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (showIncomingOrder) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(radarScale, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(radarScale, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();

      if (Platform.OS !== 'web') Vibration.vibrate([0, 500, 200, 500], true);
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
          Animated.timing(flashAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
        ])
      ).start();
    } else {
      Animated.timing(slideAnim, { toValue: height, duration: 300, useNativeDriver: true }).start();
      if (Platform.OS !== 'web') Vibration.cancel();
    }
  }, [showIncomingOrder]);

  const handleAcceptOrder = () => {
    setShowIncomingOrder(false);
    router.push({
      pathname: '/(driver)/navigation',
      params: {
        victimLat: 21.0091,
        victimLng: 105.8247,
        victimName: 'Nguyễn Văn A',
        victimAddress: '12 Chùa Bộc, Đống Đa, Hà Nội',
      }
    });
  };

  const flashBgColor = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#111827', '#450a0a'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#090B0F', '#111827']} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          
          <View style={styles.header}>
            <View>
              <View style={styles.unitBadge}>
                <Text style={styles.unitText}>UNIT: AMB-042</Text>
              </View>
              <Text style={styles.welcomeText}>Bác sĩ Hùng</Text>
              <Text style={styles.vehicleText}>Đội 115 Đống Đa • Trực tuyến</Text>
            </View>
            <TouchableOpacity style={styles.profileCircle}>
              <MaterialCommunityIcons name="account-circle-outline" size={32} color="#98A2B3" />
            </TouchableOpacity>
          </View>

          <View style={styles.statusSection}>
            <TouchableOpacity 
              activeOpacity={0.9}
              onPress={() => setIsAvailable(!isAvailable)}
              style={styles.statusCardWrapper}
            >
              <LinearGradient
                colors={isAvailable ? ['rgba(50, 213, 131, 0.15)', 'rgba(50, 213, 131, 0.05)'] : ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']}
                style={styles.statusCard}
              >
                <View style={styles.statusInfo}>
                  <View style={[styles.statusIndicator, { backgroundColor: isAvailable ? '#32D583' : '#475467' }]}>
                    {isAvailable && <View style={styles.indicatorPing} />}
                  </View>
                  <View>
                    <Text style={[styles.statusTitle, { color: isAvailable ? '#32D583' : '#98A2B3' }]}>
                      {isAvailable ? 'ĐANG SẴN SÀNG' : 'NGOẠI TUYẾN'}
                    </Text>
                    <Text style={styles.statusSub}>Chạm để thay đổi trạng thái</Text>
                  </View>
                </View>
                <Switch
                  value={isAvailable}
                  onValueChange={setIsAvailable}
                  trackColor={{ false: '#333', true: '#32D583' }}
                  thumbColor="#FFF"
                />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <StatCard icon="clipboard-list" value="12" label="Ca cứu trợ" color="#F04438" />
            <StatCard icon="clock" value="8.5" label="Giờ trực" color="#F79009" />
            <StatCard icon="star" value="4.9" label="Đánh giá" color="#A78BFA" />
          </View>

          <View style={styles.logContainer}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="broadcast" size={18} color="#475467" />
              <Text style={styles.sectionTitle}>POSTGIS SYNC LOG</Text>
            </View>
            <FlatList
              data={gpsLogs}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={styles.logItem}>
                  <View style={styles.logIcon}>
                    <Ionicons name="location" size={16} color="#475467" />
                  </View>
                  <View style={styles.logContent}>
                    <Text style={styles.logTime}>{item.time}</Text>
                    <Text style={styles.logCoords}>{item.coords}</Text>
                  </View>
                  <View style={styles.logStatus}>
                    <Text style={styles.logStatusText}>ACTIVE</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconCircle}>
                    <MaterialCommunityIcons name="satellite-variant" size={32} color="#1F2A37" />
                  </View>
                  <Text style={styles.emptyText}>Hệ thống PostGIS đang chờ kết nối...</Text>
                </View>
              }
            />
          </View>

          {showIncomingOrder && (
            <Animated.View style={[styles.orderOverlay, { backgroundColor: flashBgColor, transform: [{ translateY: slideAnim }] }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.orderHeader}>
                <Animated.View style={[styles.emergencyIcon, { transform: [{ scale: radarScale }] }]}>
                  <MaterialCommunityIcons name="alarm-light" size={32} color="#FFF" />
                </Animated.View>
                <View>
                  <Text style={styles.orderTitle}>YÊU CẦU CỨU TRỢ!</Text>
                  <Text style={styles.orderSubTitle}>Khoảng cách: 1.2 km • 4 phút</Text>
                </View>
              </View>
              
              <View style={styles.orderInfoCard}>
                <InfoRow icon="map-marker-radius" label="ĐỊA ĐIỂM" value="12 Chùa Bộc, Đống Đa, Hà Nội" />
                <InfoRow icon="account-alert" label="NẠN NHÂN" value="Nguyễn Văn A (45 tuổi)" />
                <InfoRow icon="alert-octagon" label="SỰ CỐ" value="Tai nạn giao thông - Chấn thương chân" />
              </View>

              <View style={styles.orderActions}>
                <TouchableOpacity 
                  style={styles.declineBtn} 
                  onPress={() => setShowIncomingOrder(false)}
                >
                  <Text style={styles.declineText}>BỎ QUA</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.acceptBtn} 
                  onPress={handleAcceptOrder}
                >
                  <Text style={styles.acceptText}>NHẬN CA</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const StatCard = ({ icon, value, label, color }: any) => (
  <View style={styles.statCard}>
    <View style={[styles.statIconWrapper, { backgroundColor: `${color}10` }]}>
      <FontAwesome5 name={icon} size={14} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const InfoRow = ({ icon, label, value }: any) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconBox}>
      <MaterialCommunityIcons name={icon} size={20} color="#98A2B3" />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  unitBadge: {
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  unitText: {
    color: '#A78BFA',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  welcomeText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
  },
  vehicleText: {
    color: '#475467',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  profileCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statusSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  statusCardWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicatorPing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(50, 213, 131, 0.2)',
    position: 'absolute',
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statusSub: {
    color: '#475467',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  statCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    padding: 16,
    width: (width - 64) / 3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    color: '#475467',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  logContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    color: '#475467',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  logIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logContent: {
    flex: 1,
    marginLeft: 16,
  },
  logTime: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  logCoords: {
    color: '#475467',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  logStatus: {
    backgroundColor: 'rgba(50, 213, 131, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  logStatusText: {
    color: '#32D583',
    fontSize: 9,
    fontWeight: '900',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    color: '#475467',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  orderOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    elevation: 30,
    borderWidth: 1,
    borderColor: 'rgba(240, 68, 56, 0.2)',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 16,
  },
  emergencyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#F04438',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#F04438',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  orderTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  orderSubTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 2,
    fontWeight: '600',
  },
  orderInfoCard: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 32,
    gap: 16,
  },
  infoIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  infoValue: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  orderActions: {
    flexDirection: 'row',
    gap: 12,
  },
  declineBtn: {
    flex: 1,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineText: {
    color: '#FFF',
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: 13,
  },
  acceptBtn: {
    flex: 2,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#32D583',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#32D583',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  acceptText: {
    color: '#022C22',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
});

