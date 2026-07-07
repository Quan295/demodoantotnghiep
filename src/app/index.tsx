import { useTheme } from '@/hooks/use-theme';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    Vibration,
    View
} from 'react-native';

const { width, height } = Dimensions.get('window');

type Role = 'reporter' | 'driver' | 'dispatcher' | 'admin' | 'provider' | null;

export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const logoPulse = useRef(new Animated.Value(1)).current;
  const [selectedRole, setSelectedRole] = useState<Role>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

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
    setSelectedRole(role);
  };

  const handleLogin = async () => {
    setLoading(true);
    if (Platform.OS !== 'web') {
      Vibration.vibrate(50);
    }
    
    // Giả lập kiểm tra tài khoản
    await new Promise(resolve => setTimeout(resolve, 1500));
    setLoading(false);
    
    // Logic điều hướng dựa trên Role
    if (selectedRole === 'reporter') {
      router.push('/(citizen)/sos');
    } else if (selectedRole === 'driver') {
      router.push('/(driver)/dashboard');
    } else if (selectedRole === 'dispatcher') {
      router.push('/(dispatcher)/dashboard');
    } else if (selectedRole === 'admin') {
      router.push('/(admin)/dashboard');
    } else if (selectedRole === 'provider') {
      router.push('/(provider)/dashboard');
    }
  };

  const fillMockData = () => {
    if (selectedRole === 'reporter') {
      setPhone('0987654321');
      setPassword('123456');
    } else if (selectedRole === 'driver') {
      setUsername('DRIVER-001');
      setPassword('driver123');
    } else if (selectedRole === 'dispatcher') {
      setUsername('dispatcher');
      setPassword('dispatcher123');
    } else if (selectedRole === 'admin') {
      setUsername('admin');
      setPassword('admin123');
    } else if (selectedRole === 'provider') {
      setUsername('PROV-001');
      setPassword('provider123');
    }
  };

  const getRoleInfo = () => {
    switch (selectedRole) {
      case 'reporter':
        return {
          icon: 'ambulance',
          color: '#F04438',
          title: 'Cổng Người Báo Cáo',
          gradient: ['#F04438', '#D92D20'],
          inputPlaceholder: 'Số điện thoại hoặc Email'
        };
      case 'driver':
        return {
          icon: 'userMd',
          color: '#32D583',
          title: 'Cổng Đội Cứu Hộ',
          gradient: ['#32D583', '#064E3B'],
          inputPlaceholder: 'Mã số định danh'
        };
      case 'dispatcher':
        return {
          icon: 'headset',
          color: '#A78BFA',
          title: 'Cổng Điều Phối',
          gradient: ['#A78BFA', '#7C3AED'],
          inputPlaceholder: 'Tài khoản hệ thống'
        };
      case 'admin':
        return {
          icon: 'shieldAlt',
          color: '#F59E0B',
          title: 'Cổng Quản Trị',
          gradient: ['#F59E0B', '#D97706'],
          inputPlaceholder: 'Tài khoản Admin'
        };
      case 'provider':
        return {
          icon: 'truckMedical',
          color: '#10B981',
          title: 'Cổng Nhà Cung Cấp',
          gradient: ['#10B981', '#059669'],
          inputPlaceholder: 'Mã Nhà Cung Cấp'
        };
      default:
        return null;
    }
  };

  const roleInfo = getRoleInfo();

  if (selectedRole && roleInfo) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        
        <View style={styles.bgContainer}>
          <LinearGradient colors={['#090B0F', '#0D1117', '#151B26']} style={StyleSheet.absoluteFill} />
          <View style={styles.glowTop} />
          <View style={styles.glowCenter} />
        </View>

        <SafeAreaView style={styles.safeArea}>
          <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.loginHeader}>
              <TouchableOpacity 
                onPress={() => setSelectedRole(null)} 
                style={styles.backBtn}
              >
                <Ionicons name="chevron-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.loginTitleText}>{roleInfo.title}</Text>
                <Text style={styles.loginSubtitleText}>Vui lòng nhập thông tin để tiếp tục</Text>
              </View>
            </View>

            <View style={styles.roleIconLargeContainer}>
              <LinearGradient colors={roleInfo.gradient} style={styles.roleIconLargeGradient}>
                <FontAwesome5 name={roleInfo.icon} size={32} color="#FFF" />
              </LinearGradient>
              <View style={[styles.roleIconGlow, { backgroundColor: roleInfo.color }]} />
            </View>

            <View style={styles.loginForm}>
              <View style={styles.inputContainer}>
                <View style={styles.inputIconBox}>
                  <Ionicons name={selectedRole === 'citizen' ? 'person' : 'fingerPrint'} size={20} color={roleInfo.color} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder={roleInfo.inputPlaceholder}
                  placeholderTextColor="#475467"
                  value={selectedRole === 'citizen' ? phone : username}
                  onChangeText={selectedRole === 'citizen' ? setPhone : setUsername}
                  autoFocus
                />
              </View>

              <View style={styles.inputContainer}>
                <View style={styles.inputIconBox}>
                  <Ionicons name="lock-closed" size={20} color={roleInfo.color} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Mật khẩu bảo mật"
                  placeholderTextColor="#475467"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity style={styles.forgotBtn}>
                <Text style={[styles.forgotText, { color: roleInfo.color }]}>Quên mật khẩu?</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.loginBtn, { backgroundColor: roleInfo.color }]}
                onPress={handleLogin}
                disabled={loading}
              >
                <LinearGradient colors={roleInfo.gradient} style={styles.loginBtnGradient}>
                  {loading ? (
                    <Animated.View style={{ transform: [{ scale: logoPulse }] }}>
                      <Ionicons name="sync" size={20} color="#FFF" />
                    </Animated.View>
                  ) : (
                    <Text style={styles.loginBtnText}>ĐĂNG NHẬP HỆ THỐNG</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.mockDataBtn}
                onPress={fillMockData}
              >
                <Text style={styles.mockDataText}>Dùng tài khoản Demo</Text>
              </TouchableOpacity>

              <View style={styles.loginFooter}>
                <Text style={styles.footerText}>Bạn chưa có tài khoản?</Text>
                <TouchableOpacity>
                  <Text style={[styles.footerText, { color: roleInfo.color }]}>Đăng ký</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <View style={styles.bgContainer}>
        <LinearGradient colors={['#090B0F', '#0D1117', '#151B26']} style={StyleSheet.absoluteFill} />
        <View style={styles.glowTop} />
        <View style={styles.glowCenter} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
        >
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

          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>Phản ứng nhanh,{'\n'}Cứu hộ thông minh</Text>
            <Text style={styles.heroDesc}>
              Hệ thống kết nối trực tiếp nạn nhân, đội cứu hộ và trung tâm điều phối 115 bằng công nghệ AI và định vị PostGIS.
            </Text>
          </View>

          <View style={styles.roleGrid}>
            <Text style={styles.gridLabel}>CHỌN VAI TRÒ CỦA BẠN</Text>
            
            <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={() => handleSelectRole('reporter')}
              style={styles.glassCard}
            >
              <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']} style={styles.glassGradient}>
                <View style={styles.roleIconBox}>
                  <LinearGradient colors={['#F04438', '#D92D20']} style={styles.iconInner}>
                    <FontAwesome5 name="ambulance" size={20} color="#FFF" />
                  </LinearGradient>
                </View>
                <View style={styles.roleTextContainer}>
                  <Text style={styles.roleTitle}>Người Báo Cáo</Text>
                  <Text style={styles.roleDesc}>Yêu cầu cứu trợ SOS khẩn cấp</Text>
                </View>
                <View style={styles.arrowBox}>
                  <Ionicons name="arrow-forward" size={18} color="#F04438" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={() => handleSelectRole('driver')}
              style={styles.glassCard}
            >
              <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']} style={styles.glassGradient}>
                <View style={styles.roleIconBox}>
                  <LinearGradient colors={['#32D583', '#064E3B']} style={styles.iconInner}>
                    <FontAwesome5 name="userMd" size={20} color="#FFF" />
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

            <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={() => handleSelectRole('dispatcher')}
              style={styles.glassCard}
            >
              <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']} style={styles.glassGradient}>
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

            <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={() => handleSelectRole('provider')}
              style={styles.glassCard}
            >
              <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']} style={styles.glassGradient}>
                <View style={styles.roleIconBox}>
                  <LinearGradient colors={['#10B981', '#059669']} style={styles.iconInner}>
                    <FontAwesome5 name="truckMedical" size={20} color="#FFF" />
                  </LinearGradient>
                </View>
                <View style={styles.roleTextContainer}>
                  <Text style={styles.roleTitle}>Nhà Cung Cấp</Text>
                  <Text style={styles.roleDesc}>Quản lý xe, xem doanh thu, hiệu suất</Text>
                </View>
                <View style={styles.arrowBox}>
                  <Ionicons name="arrow-forward" size={18} color="#10B981" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={() => handleSelectRole('admin')}
              style={styles.glassCard}
            >
              <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']} style={styles.glassGradient}>
                <View style={styles.roleIconBox}>
                  <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.iconInner}>
                    <FontAwesome5 name="shieldAlt" size={20} color="#FFF" />
                  </LinearGradient>
                </View>
                <View style={styles.roleTextContainer}>
                  <Text style={styles.roleTitle}>Quản Trị Viên</Text>
                  <Text style={styles.roleDesc}>Quản lý hệ thống, thống kê toàn bộ</Text>
                </View>
                <View style={styles.arrowBox}>
                  <Ionicons name="arrow-forward" size={18} color="#F59E0B" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>

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
    borderColor: 'rgba(255,255,255,0.1)',
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
    backgroundColor: 'rgba(255,255,255,0.05)',
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
    backgroundColor: 'rgba(255,255,255,0.05)',
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
    backgroundColor: 'rgba(255,255,255,0.1)',
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
  loginHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 4,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitleContainer: {
    marginLeft: 20,
  },
  loginTitleText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  loginSubtitleText: {
    color: '#475467',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  roleIconLargeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    marginBottom: 20,
  },
  roleIconLargeGradient: {
    width: 80,
    height: 80,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    zIndex: 2,
  },
  roleIconGlow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0.3,
    blurRadius: 40,
    zIndex: 1,
  },
  loginForm: {
    marginTop: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  inputIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    paddingRight: 8,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '700',
  },
  loginBtn: {
    borderRadius: 26,
    overflow: 'hidden',
    height: 64,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  loginBtnGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  loginFooter: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  footerText: {
    color: '#475467',
    fontSize: 14,
    fontWeight: '700',
  },
  mockDataBtn: {
    marginTop: 16,
    alignItems: 'center',
    padding: 8,
  },
  mockDataText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
