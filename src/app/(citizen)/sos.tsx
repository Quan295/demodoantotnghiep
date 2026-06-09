import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function SOSScreen() {
  const router = useRouter();
  
  // App states
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [isPressing, setIsPressing] = useState(false);
  
  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const radarAnim = useRef(new Animated.Value(0)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const blipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation for the button
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();

    // Radar scanning (rings)
    const radar = Animated.loop(
      Animated.timing(radarAnim, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
    );
    radar.start();

    // Radar rotation (scanner line)
    const rotation = Animated.loop(
      Animated.timing(rotationAnim, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true })
    );
    rotation.start();

    // Blips (dots appearing)
    const blips = Animated.loop(
      Animated.sequence([
        Animated.timing(blipAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(blipAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    );
    blips.start();

    return () => {
      pulse.stop();
      radar.stop();
      rotation.stop();
      blips.stop();
    };
  }, []);

  const handlePressIn = () => {
    setIsPressing(true);
    Animated.parallel([
      Animated.timing(progressAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
      Animated.spring(scaleAnim, { toValue: 0.85, useNativeDriver: true })
    ]).start(({ finished }) => {
      if (finished) handleSOSTrigger();
    });
    if (Platform.OS !== 'web') Vibration.vibrate([0, 100, 100, 100], true);
  };

  const handlePressOut = () => {
    setIsPressing(false);
    Animated.parallel([
      Animated.timing(progressAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true })
    ]).start();
    if (Platform.OS !== 'web') Vibration.cancel();
  };

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleSOSTrigger = async () => {
    if (Platform.OS !== 'web') Vibration.vibrate(500);
    triggerShake();
    setLoading(true);
    setStatusText('Đang quét tín hiệu GPS vệ tinh...');

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('PERMISSION_DENIED');

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });

      setStatusText('Đang truyền tọa độ khẩn cấp...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      setLoading(false);
      router.push({
        pathname: '/(citizen)/tracking',
        params: { 
          lat: position.coords.latitude, 
          lng: position.coords.longitude, 
          acc: position.coords.accuracy 
        }
      });

    } catch (error: any) {
      setLoading(false);
      Alert.alert('Lỗi Kết Nối', 'Vui lòng gọi 115 ngay!', [{ text: 'GỌI 115', onPress: () => Linking.openURL('tel:115') }]);
    }
  };

  const rotate = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const radarOpacity = radarAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.6, 0.3, 0],
  });

  const radarScale = radarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.5],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#090B0F', '#151B26']} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.replace('/')} style={styles.closeBtn}>
              <Ionicons name="chevron-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>CRISIS COMMAND CENTER</Text>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.infoBox}>
              <View style={styles.alertIconBox}>
                <MaterialCommunityIcons name="broadcast" size={40} color="#F04438" />
              </View>
              <Text style={styles.mainTitle}>Tình Trạng Khẩn Cấp?</Text>
              <Text style={styles.subTitle}>
                Nhấn giữ nút SOS để kích hoạt quy trình ứng cứu đa tầng qua vệ tinh.
              </Text>
            </View>

            <View style={styles.radarContainer}>
              {/* Background Grid */}
              <View style={styles.gridOverlay}>
                {[...Array(6)].map((_, i) => (
                  <View key={`ring-${i}`} style={[styles.staticRing, { width: (i + 1) * 50, height: (i + 1) * 50, borderRadius: ((i + 1) * 50) / 2 }]} />
                ))}
                <View style={styles.crosshairV} />
                <View style={styles.crosshairH} />
              </View>

              {/* Radar Rings Animation */}
              <Animated.View style={[styles.radarRing, { transform: [{ scale: radarScale }], opacity: radarOpacity }]} />
              
              {/* Rotating Scanner Line */}
              <Animated.View style={[styles.scannerContainer, { transform: [{ rotate }] }]}>
                <LinearGradient
                  colors={['rgba(240, 68, 56, 0.5)', 'transparent']}
                  style={styles.scannerLine}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </Animated.View>

              {/* Blips (Random signals) */}
              <Animated.View style={[styles.blip, { top: 80, left: 100, opacity: blipAnim }]} />
              <Animated.View style={[styles.blip, { bottom: 100, right: 70, opacity: blipAnim }]} />

              {/* SOS Main Button */}
              <Animated.View style={{ transform: [{ translateX: shakeAnim }, { scale: scaleAnim }] }}>
                <TouchableOpacity 
                  activeOpacity={1}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  style={styles.sosButton}
                >
                  <LinearGradient
                    colors={isPressing ? ['#D92D20', '#B42318'] : ['#F04438', '#D92D20']}
                    style={styles.sosGradient}
                  >
                    {loading ? (
                      <ActivityIndicator size="large" color="#FFF" />
                    ) : (
                      <>
                        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                          <Text style={styles.sosText}>SOS</Text>
                        </Animated.View>
                        <Text style={styles.sosSubText}>GIỮ 2S ĐỂ GỬI</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              {isPressing && !loading && (
                <View style={styles.pressProgressContainer}>
                  <Animated.View style={[styles.pressProgressBar, { width: progressWidth }]} />
                </View>
              )}
            </View>

            <View style={styles.statusBox}>
              {loading ? (
                <View style={styles.scanningBox}>
                  <ActivityIndicator color="#F04438" size="small" />
                  <Text style={styles.statusText}>{statusText}</Text>
                </View>
              ) : (
                <View style={styles.readyBox}>
                  <View style={styles.dot} />
                  <Text style={styles.readyText}>Tín hiệu ổn định (Ready)</Text>
                </View>
              )}
            </View>

            <View style={styles.gridContainer}>
              <Text style={styles.gridLabel}>LOẠI HÌNH KHẨN CẤP</Text>
              <View style={styles.actionGrid}>
                <QuickCard icon="car-crash" label="Tai nạn" color="#F04438" />
                <QuickCard icon="heartbeat" label="Đột quỵ" color="#F04438" />
                <QuickCard icon="fire" label="Hỏa hoạn" color="#F79009" />
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity 
            style={styles.callFab}
            onPress={() => Linking.openURL('tel:115')}
          >
            <LinearGradient colors={['#F04438', '#B42318']} style={styles.fabGradient}>
              <Ionicons name="call" size={24} color="#FFF" />
              <Text style={styles.fabText}>GỌI 115 TRỰC TIẾP</Text>
            </LinearGradient>
          </TouchableOpacity>

        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const QuickCard = ({ icon, label, color }: any) => (
  <TouchableOpacity style={styles.quickCard}>
    <View style={[styles.quickIconBox, { backgroundColor: `${color}15` }]}>
      <FontAwesome5 name={icon} size={18} color={color} />
    </View>
    <Text style={styles.quickLabel}>{label}</Text>
  </TouchableOpacity>
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
    paddingHorizontal: 20,
    height: 60,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#475467',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.5,
  },
  scrollContent: {
    padding: 24,
    alignItems: 'center',
  },
  infoBox: {
    alignItems: 'center',
    marginBottom: 40,
  },
  alertIconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(240, 68, 56, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(240, 68, 56, 0.2)',
  },
  mainTitle: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  subTitle: {
    color: '#98A2B3',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  radarContainer: {
    width: 320,
    height: 320,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  staticRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  crosshairV: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  crosshairH: {
    position: 'absolute',
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  radarRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: 'rgba(240, 68, 56, 0.3)',
  },
  scannerContainer: {
    position: 'absolute',
    width: 300,
    height: 300,
    justifyContent: 'center',
  },
  scannerLine: {
    width: 150,
    height: 150,
    borderTopLeftRadius: 150,
  },
  blip: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F04438',
    shadowColor: '#F04438',
    shadowRadius: 4,
    shadowOpacity: 1,
  },
  sosButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    elevation: 20,
    shadowColor: '#F04438',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    overflow: 'hidden',
    borderWidth: 8,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sosGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosText: {
    color: '#FFF',
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sosSubText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontWeight: '900',
    marginTop: 4,
  },
  pressProgressContainer: {
    position: 'absolute',
    bottom: 20,
    width: 140,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  pressProgressBar: {
    height: '100%',
    backgroundColor: '#FFF',
  },
  statusBox: {
    height: 40,
    justifyContent: 'center',
    marginBottom: 40,
  },
  readyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(50, 213, 131, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(50, 213, 131, 0.1)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#32D583',
    marginRight: 10,
  },
  readyText: {
    color: '#32D583',
    fontSize: 12,
    fontWeight: '800',
  },
  scanningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusText: {
    color: '#F04438',
    fontSize: 13,
    fontWeight: '800',
  },
  gridContainer: {
    width: '100%',
  },
  gridLabel: {
    color: '#475467',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 16,
    textAlign: 'center',
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  quickIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickLabel: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  callFab: {
    position: 'absolute',
    bottom: 30,
    left: 24,
    right: 24,
    height: 64,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 10,
  },
  fabGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  fabText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
});

