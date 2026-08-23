import { api } from '@/services/api';
import { mapApiRoleToLocal } from '@/services/config';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView as SafeAreaViewContext } from 'react-native-safe-area-context';

type AuthMode = 
  | 'login' 
  | 'registerPhone' 
  | 'registerOtp' 
  | 'registerDetails' 
  | 'forgotPassword' 
  | 'resetPassword';

export default function AuthScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);

  // Login fields
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerOtp, setRegisterOtp] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerFullName, setRegisterFullName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');

  // Forgot/Reset password fields
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [phoneVerificationToken, setPhoneVerificationToken] = useState('');

  const handleLogin = async () => {
    // Đảm bảo setLoading(false) LUÔN chạy trong mọi trường hợp
    let shouldStopLoading = false;
    try {
      if (!loginUsername || !loginPassword) {
        Alert.alert('Lỗi', 'Vui lòng nhập tên đăng nhập và mật khẩu');
        return;
      }

      setLoading(true);
      shouldStopLoading = true;
      console.log('[Login] Attempting login with:', { loginUsername, passwordLength: loginPassword.length });
      
      const loginData = await api.login(loginUsername.trim(), loginPassword);
      
      console.log('[Login] Login api returned, roles:', loginData?.roles);
      
      if (!loginData) {
        throw new Error('Không nhận được dữ liệu từ server');
      }
      if (!loginData.roles || loginData.roles.length === 0) {
        throw new Error('Tài khoản này chưa được phân quyền');
      }

      const role = mapApiRoleToLocal(loginData.roles[0]);
      console.log('[Login] Mapped role:', role, '| fullName:', loginData.fullName);
      
      let targetRoute: any = '/(citizen)/sos';
      switch (role) {
        case 'admin':
          targetRoute = '/(admin)/dashboard';
          break;
        case 'provider':
          targetRoute = '/(provider)/dashboard';
          break;
        case 'dispatcher':
          targetRoute = '/(dispatcher)/dashboard';
          break;
        case 'driver':
          targetRoute = '/(driver)/dashboard';
          break;
        case 'reporter':
        default:
          targetRoute = '/(citizen)/sos';
          break;
      }
      
      console.log('[Login] Navigating to targetRoute:', targetRoute);
      // Wrap navigation in try-catch để lỗi router không làm kẹt loading
      try {
        router.replace(targetRoute);
      } catch (navError: any) {
        console.warn('[Login] Navigation warning:', navError?.message);
        // Thử lại nếu lỗi
        setTimeout(() => {
          try { router.replace(targetRoute); } catch {}
        }, 200);
      }
    } catch (error: any) {
      console.error('[Login] Login error:', error?.name, error?.message);
      Alert.alert(
        'Đăng nhập thất bại', 
        error?.message || 'Vui lòng kiểm tra tên đăng nhập và mật khẩu, hoặc thử lại sau'
      );
    } finally {
      if (shouldStopLoading) {
        setLoading(false);
      }
    }
  };

  const handleSendOtp = async (phoneNumber: string) => {
    try {
      setLoading(true);
      const res = await api.sendOtp(phoneNumber);
      const rawData = (res as any)?.data ?? res;
      const otpCode = typeof rawData === 'string' || typeof rawData === 'number' 
        ? String(rawData) 
        : (rawData?.otpCode ? String(rawData.otpCode) : '');
      const otpText = otpCode ? `\n\nMã OTP xác thực của bạn: ${otpCode}` : '';

      Alert.alert('Thành công', `Mã OTP đã được gửi đến số điện thoại ${phoneNumber}.${otpText}`);
      if (otpCode) {
        setRegisterOtp(otpCode);
      }
      return true;
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Vui lòng thử lại sau');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (phoneNumber: string, otpCode: string) => {
    try {
      setLoading(true);
      const res = await api.verifyOtp(phoneNumber, otpCode);
      const rawData = (res as any)?.data ?? res;
      const token = typeof rawData === 'string' 
        ? rawData 
        : (rawData?.verificationToken || rawData?.phoneVerificationToken || rawData?.token || '');
      if (token) {
        setPhoneVerificationToken(token);
      }
      Alert.alert('Thành công', 'Xác minh OTP thành công');
      return true;
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Vui lòng thử lại sau');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSendOtp = async () => {
    if (!registerPhone) {
      Alert.alert('Lỗi', 'Vui lòng nhập số điện thoại');
      return;
    }
    const success = await handleSendOtp(registerPhone);
    if (success) {
      setMode('registerOtp');
    }
  };

  const handleRegisterVerifyOtp = async () => {
    if (!registerOtp) {
      Alert.alert('Lỗi', 'Vui lòng nhập mã OTP');
      return;
    }
    const success = await handleVerifyOtp(registerPhone, registerOtp);
    if (success) {
      setMode('registerDetails');
    }
  };

  const handleRegister = async () => {
    if (!registerUsername || !registerPassword || !registerFullName) {
      Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin');
      return;
    }

    try {
      setLoading(true);
      await api.register({
        username: registerUsername,
        password: registerPassword,
        fullName: registerFullName,
        phoneNumber: registerPhone,
        email: registerEmail,
        otpCode: registerOtp,
        verificationToken: phoneVerificationToken || registerOtp,
        phoneVerificationToken: phoneVerificationToken || registerOtp,
      });
      Alert.alert('Thành công', 'Đăng ký tài khoản thành công! Vui lòng đăng nhập');
      resetAuthStates();
      setMode('login');
    } catch (error: any) {
      Alert.alert('Đăng ký thất bại', error.message || 'Vui lòng thử lại sau');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotPhone) {
      Alert.alert('Lỗi', 'Vui lòng nhập số điện thoại hoặc email');
      return;
    }
    try {
      setLoading(true);
      const res = await api.forgotPassword(forgotPhone);
      const rawData = (res as any)?.data ?? res;
      const otpCode = typeof rawData === 'string' || typeof rawData === 'number' 
        ? String(rawData) 
        : (rawData?.otpCode ? String(rawData.otpCode) : '');
      const otpText = otpCode ? `\n\nMã OTP xác thực của bạn: ${otpCode}` : '';

      Alert.alert('Thành công', `Mã xác minh đã được gửi đến số điện thoại của bạn.${otpText}`);
      if (otpCode) {
        setForgotOtp(otpCode);
      }
      setMode('resetPassword');
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Vui lòng thử lại sau');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!forgotOtp || !newPassword) {
      Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin');
      return;
    }

    try {
      setLoading(true);
      await api.resetPassword(forgotPhone, forgotOtp, newPassword);
      Alert.alert('Thành công', 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập');
      resetAuthStates();
      setMode('login');
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Vui lòng thử lại sau');
    } finally {
      setLoading(false);
    }
  };

  const resetAuthStates = () => {
    setLoginUsername('');
    setLoginPassword('');
    setRegisterPhone('');
    setRegisterOtp('');
    setRegisterUsername('');
    setRegisterPassword('');
    setRegisterFullName('');
    setRegisterEmail('');
    setForgotPhone('');
    setForgotOtp('');
    setNewPassword('');
    setPhoneVerificationToken('');
  };

  return (
    <SafeAreaViewContext style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.appName}>Ứng Dụng Cứu Hộ</Text>
          <Text style={styles.subtitle}>
            {mode === 'login' && 'Đăng nhập để tiếp tục'}
            {mode === 'registerPhone' && 'Đăng ký tài khoản'}
            {mode === 'registerOtp' && 'Xác minh OTP'}
            {mode === 'registerDetails' && 'Hoàn thành đăng ký'}
            {mode === 'forgotPassword' && 'Lấy lại mật khẩu'}
            {mode === 'resetPassword' && 'Đặt lại mật khẩu'}
          </Text>
        </View>

        {/* Login Form */}
        {mode === 'login' && (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tên đăng nhập</Text>
              <TextInput
                style={styles.input}
                value={loginUsername}
                onChangeText={setLoginUsername}
                placeholder="Nhập tên đăng nhập"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mật khẩu</Text>
              <TextInput
                style={styles.input}
                value={loginPassword}
                onChangeText={setLoginPassword}
                placeholder="Nhập mật khẩu"
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={styles.forgotLink}
              onPress={() => setMode('forgotPassword')}
            >
              <Text style={styles.forgotText}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.button}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Đang xử lý...' : 'Đăng nhập'}
              </Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Chưa có tài khoản?</Text>
              <TouchableOpacity onPress={() => {
                resetAuthStates();
                setMode('registerPhone');
              }}>
                <Text style={styles.linkText}>Đăng ký</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Register Phone Form */}
        {mode === 'registerPhone' && (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Số điện thoại</Text>
              <TextInput
                style={styles.input}
                value={registerPhone}
                onChangeText={setRegisterPhone}
                placeholder="Nhập số điện thoại"
                keyboardType="phone-pad"
              />
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleRegisterSendOtp}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Đang gửi...' : 'Gửi mã OTP'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                resetAuthStates();
                setMode('login');
              }}
            >
              <Text style={styles.backText}>Quay lại đăng nhập</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Register OTP Form */}
        {mode === 'registerOtp' && (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mã OTP</Text>
              <TextInput
                style={styles.input}
                value={registerOtp}
                onChangeText={setRegisterOtp}
                placeholder="Nhập mã OTP"
                keyboardType="number-pad"
              />
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleRegisterVerifyOtp}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Đang xác minh...' : 'Xác minh OTP'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setMode('registerPhone')}
            >
              <Text style={styles.backText}>Quay lại</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Register Details Form */}
        {mode === 'registerDetails' && (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Họ và tên</Text>
              <TextInput
                style={styles.input}
                value={registerFullName}
                onChangeText={setRegisterFullName}
                placeholder="Nhập họ và tên"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email (tùy chọn)</Text>
              <TextInput
                style={styles.input}
                value={registerEmail}
                onChangeText={setRegisterEmail}
                placeholder="Nhập email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tên đăng nhập</Text>
              <TextInput
                style={styles.input}
                value={registerUsername}
                onChangeText={setRegisterUsername}
                placeholder="Nhập tên đăng nhập"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mật khẩu</Text>
              <TextInput
                style={styles.input}
                value={registerPassword}
                onChangeText={setRegisterPassword}
                placeholder="Nhập mật khẩu"
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Đang xử lý...' : 'Hoàn thành đăng ký'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setMode('registerOtp')}
            >
              <Text style={styles.backText}>Quay lại</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Forgot Password Form */}
        {mode === 'forgotPassword' && (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Số điện thoại</Text>
              <TextInput
                style={styles.input}
                value={forgotPhone}
                onChangeText={setForgotPhone}
                placeholder="Nhập số điện thoại đã đăng ký"
                keyboardType="phone-pad"
              />
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleForgotPassword}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Đang xử lý...' : 'Gửi mã xác minh'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                resetAuthStates();
                setMode('login');
              }}
            >
              <Text style={styles.backText}>Quay lại đăng nhập</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Reset Password Form */}
        {mode === 'resetPassword' && (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mã OTP</Text>
              <TextInput
                style={styles.input}
                value={forgotOtp}
                onChangeText={setForgotOtp}
                placeholder="Nhập mã OTP"
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mật khẩu mới</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Nhập mật khẩu mới"
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleResetPassword}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setMode('forgotPassword')}
            >
              <Text style={styles.backText}>Quay lại</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaViewContext>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    marginBottom: 40,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  forgotText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  backButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  backText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  linkText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
});
