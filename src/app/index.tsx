import { useTheme } from '@/hooks/use-theme';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useRef } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const logoPulse = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, { toValue: 1.2, duration: 1500, useNativeDriver: true }),
        Animated.timing(logoPulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleSelectRole = (role: 'citizen' | 'driver' | 'dispatcher') => {
    if (Platform.OS !== 'web') {
      Vibration.vibrate(50);
    }
    if (role === 'citizen') {
      router.push('/(citizen)/sos');
    } else if (role === 'driver') {
      router.push('/(driver)/dashboard');
    } else {
      router.push('/(dispatcher)/dashboard');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Immersive Background */}
      <View style={styles.bgContainer}>
        <LinearGradient
          colors={['#090B0F', '#0D1117', '#151B26']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.glowTop} />
        <View style={styles.glowCenter} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
        >
          {/* Brand Header */}
          <View style={styles.brandHeader}>
            <View style={styles.logoBox}>
              <LinearGradient
                colors={['#F04438', '#B42318']}
                style={styles.logoGradient}
              >
                <MaterialCommunityIcons name="heart-flash" size={40} color="#FFF" />
              </LinearGradient>
              <Animated.View style={[styles.logoPulseRing, { transform: [{ scale: logoPulse }], opacity: logoPulse.interpolate({ inputRange: [1, 1.2], outputRange: [0.3, 0] }) }]} />
            </View>
            <View style={styles.brandTextWrapper}>
              <Text style={styles.brandMain}>115 SMART</Text>
              <Text style={styles.brandSub}>DISPATCH SYSTEM</Text>
            </View>
          </View>

          {/* Hero Section */}
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>Phản ứng nhanh,{'\n'}Cứu hộ thông minh</Text>
            <Text style={styles.heroDesc}>
              Hệ thống kết nối trực tiếp nạn nhân, đội cứu hộ và trung tâm điều phối 115 bằng công nghệ AI và định vị PostGIS.
            </Text>
          </View>

          {/* Floating Role Grid */}
          <View style={styles.roleGrid}>
            <Text style={styles.gridLabel}>TRUY CẬP HỆ THỐNG</Text>
            
            {/* Role: Citizen */}
            <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={() => handleSelectRole('citizen')}
              style={styles.glassCard}
            >
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.03)']}
                style={styles.glassGradient}
              >
                <View style={styles.roleIconBox}>
                  <LinearGradient colors={['#F04438', '#D92D20']} style={styles.iconInner}>
                    <FontAwesome5 name="ambulance" size={20} color="#FFF" />
                  </LinearGradient>
                </View>
                <View style={styles.roleTextContainer}>
                  <Text style={styles.roleTitle}>Người Dân</Text>
                  <Text style={styles.roleDesc}>Yêu cầu cứu trợ SOS khẩn cấp</Text>
                </View>
                <View style={styles.arrowBox}>
                  <Ionicons name="arrow-forward" size={18} color="#F04438" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Role: Driver */}
            <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={() => handleSelectRole('driver')}
              style={styles.glassCard}
            >
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.03)']}
                style={styles.glassGradient}
              >
                <View style={styles.roleIconBox}>
                  <LinearGradient colors={['#32D583', '#064E3B']} style={styles.iconInner}>
                    <FontAwesome5 name="user-md" size={20} color="#FFF" />
                  </LinearGradient>
                </View>
                <View style={styles.roleTextContainer}>
                  <Text style={styles.roleTitle}>Đội Cứu Hộ</Text>
                  <Text style={styles.roleDesc}>Nhận lệnh và định vị hiện trường</Text>
                </View>
                <View style={styles.arrowBox}>
                  <Ionicons name="arrow-forward" size={18} color="#32D583" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Role: Dispatcher */}
            <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={() => handleSelectRole('dispatcher')}
              style={styles.glassCard}
            >
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.03)']}
                style={styles.glassGradient}
              >
                <View style={styles.roleIconBox}>
                  <LinearGradient colors={['#A78BFA', '#7C3AED']} style={styles.iconInner}>
                    <FontAwesome5 name="headset" size={20} color="#FFF" />
                  </LinearGradient>
                </View>
                <View style={styles.roleTextContainer}>
                  <Text style={styles.roleTitle}>Điều Phối Viên</Text>
                  <Text style={styles.roleDesc}>Trung tâm điều hành & Phân tích AI</Text>
                </View>
                <View style={styles.arrowBox}>
                  <Ionicons name="arrow-forward" size={18} color="#A78BFA" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Tech Footer */}
          <View style={styles.techFooter}>
            <View style={styles.techLine} />
            <View style={styles.techList}>
              <TechBadge label="PostGIS" icon="database" />
              <TechBadge label="AI Voice" icon="robot" />
              <TechBadge label="Live Maps" icon="map-marker-path" />
            </View>
            <Text style={styles.copyright}>© 2026 Smart Emergency Solutions</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const TechBadge = ({ label, icon }: any) => (
  <View style={styles.techBadgeWrapper}>
    <MaterialCommunityIcons name={icon} size={14} color="#475467" />
    <Text style={styles.techBadgeText}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090B0F',
  },
  bgContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glowTop: {
    position: 'absolute',
    top: -height * 0.2,
    right: -width * 0.3,
    width: width,
    height: width,
    borderRadius: width / 2,
    backgroundColor: 'rgba(240, 68, 56, 0.08)',
    blurRadius: 100,
  },
  glowCenter: {
    position: 'absolute',
    bottom: height * 0.1,
    left: -width * 0.4,
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    backgroundColor: 'rgba(124, 58, 237, 0.05)',
    blurRadius: 100,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 40,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 48,
  },
  logoBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoGradient: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#F04438',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  logoPulseRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(240, 68, 56, 0.2)',
  },
  brandTextWrapper: {
    marginLeft: 18,
  },
  brandMain: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1,
  },
  brandSub: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F04438',
    letterSpacing: 2,
    marginTop: 2,
  },
  heroSection: {
    marginBottom: 48,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFF',
    lineHeight: 42,
    letterSpacing: -1,
  },
  heroDesc: {
    fontSize: 15,
    color: '#98A2B3',
    lineHeight: 24,
    marginTop: 16,
    fontWeight: '500',
  },
  roleGrid: {
    gap: 16,
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#475467',
    letterSpacing: 2.5,
    marginBottom: 8,
  },
  glassCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  glassGradient: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 2,
  },
  iconInner: {
    flex: 1,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  roleTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
  },
  roleDesc: {
    fontSize: 12,
    color: '#98A2B3',
    marginTop: 2,
    fontWeight: '500',
  },
  arrowBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  techFooter: {
    marginTop: 60,
    alignItems: 'center',
  },
  techLine: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 24,
  },
  techList: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },
  techBadgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  techBadgeText: {
    fontSize: 11,
    color: '#475467',
    fontWeight: '700',
  },
  copyright: {
    fontSize: 10,
    color: '#344054',
    fontWeight: '600',
  },
});
