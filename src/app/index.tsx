import { api } from '@/services/api';
import { extractUserRoles, mapApiRoleToLocal } from '@/services/config';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

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

  // Focus & visibility states
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Refs for reliable tap-to-focus
  const loginUsernameRef = useRef<TextInput>(null);
  const loginPasswordRef = useRef<TextInput>(null);
  const registerPhoneRef = useRef<TextInput>(null);
  const registerOtpRef = useRef<TextInput>(null);
  const registerFullNameRef = useRef<TextInput>(null);
  const registerEmailRef = useRef<TextInput>(null);
  const registerUsernameRef = useRef<TextInput>(null);
  const registerPasswordRef = useRef<TextInput>(null);
  const forgotPhoneRef = useRef<TextInput>(null);
  const forgotOtpRef = useRef<TextInput>(null);
  const newPasswordRef = useRef<TextInput>(null);

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

      console.log('[Login] Login api returned:', loginData);

      if (!loginData) {
        throw new Error('Không nhận được dữ liệu từ server');
      }

      const roles = extractUserRoles(loginData);
      const firstRole = roles[0] || 'REPORTER';
      const role = mapApiRoleToLocal(firstRole);
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
      try {
        router.replace(targetRoute);
      } catch (navError: any) {
        console.warn('[Login] Navigation warning:', navError?.message);
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

  const getSubtitle = () => {
    switch (mode) {
      case 'login':
        return '';
      case 'registerPhone':
        return 'Nhập số điện thoại để tạo tài khoản mới';
      case 'registerOtp':
        return 'Nhập mã OTP xác thực được gửi đến điện thoại';
      case 'registerDetails':
        return 'Hoàn tất thông tin cá nhân & tài khoản';
      case 'forgotPassword':
        return 'Khôi phục quyền truy cập vào tài khoản';
      case 'resetPassword':
        return 'Thiết lập mật khẩu bảo mật mới';
    }
  };

  const subtitleText = getSubtitle();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#050811', '#0B132B', '#070B14']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardAvoid}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* BRANDING HEADER - COMPACT & PUSHED UP */}
              <View style={styles.header}>
                <View style={styles.logoBadgeContainer}>
                  <LinearGradient
                    colors={['rgba(16, 185, 129, 0.25)', 'rgba(6, 95, 70, 0.4)']}
                    style={styles.logoBadge}
                  >
                    <MaterialCommunityIcons name="ambulance" size={26} color="#10B981" />
                  </LinearGradient>
                  <View style={styles.onlinePill}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.onlineText}>HỆ THỐNG 115</Text>
                  </View>
                </View>

                <Text style={styles.appName}>SEMD CẤP CỨU</Text>
                {subtitleText ? (
                  <Text style={styles.subtitle}>{subtitleText}</Text>
                ) : null}
              </View>

              {/* MAIN AUTH CARD */}
              <View style={styles.formCard}>
                {/* 1. LOGIN FORM */}
                {mode === 'login' && (
                  <View style={styles.form}>
                    {/* Username Input */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>TÀI KHOẢN ĐĂNG NHẬP</Text>
                      <Pressable
                        onPress={() => loginUsernameRef.current?.focus()}
                        style={[
                          styles.inputContainer,
                          focusedInput === 'loginUsername' && styles.inputContainerFocused,
                        ]}
                      >
                        <Ionicons
                          name="person-outline"
                          size={18}
                          color={focusedInput === 'loginUsername' ? '#10B981' : '#64748B'}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          ref={loginUsernameRef}
                          style={styles.input}
                          value={loginUsername}
                          onChangeText={setLoginUsername}
                          placeholder="Tên đăng nhập hoặc SĐT"
                          placeholderTextColor="#64748B"
                          autoCapitalize="none"
                          autoCorrect={false}
                          onFocus={() => setFocusedInput('loginUsername')}
                          onBlur={() => setFocusedInput(null)}
                        />
                        {loginUsername.length > 0 && (
                          <TouchableOpacity
                            onPress={() => setLoginUsername('')}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Ionicons name="close-circle" size={18} color="#64748B" />
                          </TouchableOpacity>
                        )}
                      </Pressable>
                    </View>

                    {/* Password Input */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>MẬT KHẨU</Text>
                      <Pressable
                        onPress={() => loginPasswordRef.current?.focus()}
                        style={[
                          styles.inputContainer,
                          focusedInput === 'loginPassword' && styles.inputContainerFocused,
                        ]}
                      >
                        <Ionicons
                          name="lock-closed-outline"
                          size={18}
                          color={focusedInput === 'loginPassword' ? '#10B981' : '#64748B'}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          ref={loginPasswordRef}
                          style={styles.input}
                          value={loginPassword}
                          onChangeText={setLoginPassword}
                          placeholder="Nhập mật khẩu"
                          placeholderTextColor="#64748B"
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          autoCorrect={false}
                          onFocus={() => setFocusedInput('loginPassword')}
                          onBlur={() => setFocusedInput(null)}
                        />
                        <TouchableOpacity
                          onPress={() => setShowPassword(!showPassword)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons
                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={20}
                            color={showPassword ? '#10B981' : '#64748B'}
                          />
                        </TouchableOpacity>
                      </Pressable>
                    </View>

                    {/* Forgot Password Link */}
                    <TouchableOpacity
                      style={styles.forgotLink}
                      onPress={() => setMode('forgotPassword')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.forgotText}>Quên mật khẩu?</Text>
                    </TouchableOpacity>

                    {/* Login Submit Button */}
                    <TouchableOpacity
                      style={[styles.primaryButton, loading && styles.buttonDisabled]}
                      onPress={handleLogin}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={['#10B981', '#059669']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                      >
                        {loading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Text style={styles.primaryButtonText}>ĐĂNG NHẬP</Text>
                            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    {/* Footer switch to register */}
                    <View style={styles.footer}>
                      <Text style={styles.footerText}>Chưa có tài khoản?</Text>
                      <TouchableOpacity
                        onPress={() => {
                          resetAuthStates();
                          setMode('registerPhone');
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.linkText}>Đăng ký ngay</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* 2. REGISTER PHONE FORM */}
                {mode === 'registerPhone' && (
                  <View style={styles.form}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>SỐ ĐIỆN THOẠI</Text>
                      <Pressable
                        onPress={() => registerPhoneRef.current?.focus()}
                        style={[
                          styles.inputContainer,
                          focusedInput === 'registerPhone' && styles.inputContainerFocused,
                        ]}
                      >
                        <Ionicons
                          name="call-outline"
                          size={18}
                          color={focusedInput === 'registerPhone' ? '#10B981' : '#64748B'}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          ref={registerPhoneRef}
                          style={styles.input}
                          value={registerPhone}
                          onChangeText={setRegisterPhone}
                          placeholder="Ví dụ: 0912345678"
                          placeholderTextColor="#64748B"
                          keyboardType="phone-pad"
                          onFocus={() => setFocusedInput('registerPhone')}
                          onBlur={() => setFocusedInput(null)}
                        />
                      </Pressable>
                    </View>

                    <TouchableOpacity
                      style={[styles.primaryButton, loading && styles.buttonDisabled]}
                      onPress={handleRegisterSendOtp}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={['#10B981', '#059669']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                      >
                        {loading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Text style={styles.primaryButtonText}>GỬI MÃ OTP XÁC THỰC</Text>
                            <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.backButton}
                      onPress={() => {
                        resetAuthStates();
                        setMode('login');
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="arrow-back" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
                      <Text style={styles.backText}>Quay lại đăng nhập</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 3. REGISTER OTP FORM */}
                {mode === 'registerOtp' && (
                  <View style={styles.form}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>MÃ XÁC THỰC OTP</Text>
                      <Pressable
                        onPress={() => registerOtpRef.current?.focus()}
                        style={[
                          styles.inputContainer,
                          focusedInput === 'registerOtp' && styles.inputContainerFocused,
                        ]}
                      >
                        <Ionicons
                          name="key-outline"
                          size={18}
                          color={focusedInput === 'registerOtp' ? '#10B981' : '#64748B'}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          ref={registerOtpRef}
                          style={styles.input}
                          value={registerOtp}
                          onChangeText={setRegisterOtp}
                          placeholder="Nhập mã 6 số OTP"
                          placeholderTextColor="#64748B"
                          keyboardType="number-pad"
                          onFocus={() => setFocusedInput('registerOtp')}
                          onBlur={() => setFocusedInput(null)}
                        />
                      </Pressable>
                    </View>

                    <TouchableOpacity
                      style={[styles.primaryButton, loading && styles.buttonDisabled]}
                      onPress={handleRegisterVerifyOtp}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={['#10B981', '#059669']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                      >
                        {loading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Text style={styles.primaryButtonText}>XÁC MINH OTP</Text>
                            <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.backButton}
                      onPress={() => setMode('registerPhone')}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="arrow-back" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
                      <Text style={styles.backText}>Nhập lại số điện thoại</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 4. REGISTER DETAILS FORM */}
                {mode === 'registerDetails' && (
                  <View style={styles.form}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>HỌ VÀ TÊN</Text>
                      <Pressable
                        onPress={() => registerFullNameRef.current?.focus()}
                        style={[
                          styles.inputContainer,
                          focusedInput === 'registerFullName' && styles.inputContainerFocused,
                        ]}
                      >
                        <Ionicons
                          name="person-circle-outline"
                          size={18}
                          color={focusedInput === 'registerFullName' ? '#10B981' : '#64748B'}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          ref={registerFullNameRef}
                          style={styles.input}
                          value={registerFullName}
                          onChangeText={setRegisterFullName}
                          placeholder="Nguyễn Văn A"
                          placeholderTextColor="#64748B"
                          onFocus={() => setFocusedInput('registerFullName')}
                          onBlur={() => setFocusedInput(null)}
                        />
                      </Pressable>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>EMAIL (TÙY CHỌN)</Text>
                      <Pressable
                        onPress={() => registerEmailRef.current?.focus()}
                        style={[
                          styles.inputContainer,
                          focusedInput === 'registerEmail' && styles.inputContainerFocused,
                        ]}
                      >
                        <Ionicons
                          name="mail-outline"
                          size={18}
                          color={focusedInput === 'registerEmail' ? '#10B981' : '#64748B'}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          ref={registerEmailRef}
                          style={styles.input}
                          value={registerEmail}
                          onChangeText={setRegisterEmail}
                          placeholder="example@gmail.com"
                          placeholderTextColor="#64748B"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          onFocus={() => setFocusedInput('registerEmail')}
                          onBlur={() => setFocusedInput(null)}
                        />
                      </Pressable>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>TÊN ĐĂNG NHẬP</Text>
                      <Pressable
                        onPress={() => registerUsernameRef.current?.focus()}
                        style={[
                          styles.inputContainer,
                          focusedInput === 'registerUsername' && styles.inputContainerFocused,
                        ]}
                      >
                        <Ionicons
                          name="at-outline"
                          size={18}
                          color={focusedInput === 'registerUsername' ? '#10B981' : '#64748B'}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          ref={registerUsernameRef}
                          style={styles.input}
                          value={registerUsername}
                          onChangeText={setRegisterUsername}
                          placeholder="username123"
                          placeholderTextColor="#64748B"
                          autoCapitalize="none"
                          onFocus={() => setFocusedInput('registerUsername')}
                          onBlur={() => setFocusedInput(null)}
                        />
                      </Pressable>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>MẬT KHẨU</Text>
                      <Pressable
                        onPress={() => registerPasswordRef.current?.focus()}
                        style={[
                          styles.inputContainer,
                          focusedInput === 'registerPassword' && styles.inputContainerFocused,
                        ]}
                      >
                        <Ionicons
                          name="lock-closed-outline"
                          size={18}
                          color={focusedInput === 'registerPassword' ? '#10B981' : '#64748B'}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          ref={registerPasswordRef}
                          style={styles.input}
                          value={registerPassword}
                          onChangeText={setRegisterPassword}
                          placeholder="Tối thiểu 6 ký tự"
                          placeholderTextColor="#64748B"
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          onFocus={() => setFocusedInput('registerPassword')}
                          onBlur={() => setFocusedInput(null)}
                        />
                        <TouchableOpacity
                          onPress={() => setShowPassword(!showPassword)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons
                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={20}
                            color={showPassword ? '#10B981' : '#64748B'}
                          />
                        </TouchableOpacity>
                      </Pressable>
                    </View>

                    <TouchableOpacity
                      style={[styles.primaryButton, loading && styles.buttonDisabled]}
                      onPress={handleRegister}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={['#10B981', '#059669']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                      >
                        {loading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Text style={styles.primaryButtonText}>HOÀN TẤT ĐĂNG KÝ</Text>
                            <Ionicons name="checkmark-done" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.backButton}
                      onPress={() => setMode('registerOtp')}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="arrow-back" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
                      <Text style={styles.backText}>Quay lại</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 5. FORGOT PASSWORD FORM */}
                {mode === 'forgotPassword' && (
                  <View style={styles.form}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>SỐ ĐIỆN THOẠI HOẶC EMAIL</Text>
                      <Pressable
                        onPress={() => forgotPhoneRef.current?.focus()}
                        style={[
                          styles.inputContainer,
                          focusedInput === 'forgotPhone' && styles.inputContainerFocused,
                        ]}
                      >
                        <Ionicons
                          name="call-outline"
                          size={18}
                          color={focusedInput === 'forgotPhone' ? '#10B981' : '#64748B'}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          ref={forgotPhoneRef}
                          style={styles.input}
                          value={forgotPhone}
                          onChangeText={setForgotPhone}
                          placeholder="Số điện thoại đã đăng ký"
                          placeholderTextColor="#64748B"
                          keyboardType="phone-pad"
                          onFocus={() => setFocusedInput('forgotPhone')}
                          onBlur={() => setFocusedInput(null)}
                        />
                      </Pressable>
                    </View>

                    <TouchableOpacity
                      style={[styles.primaryButton, loading && styles.buttonDisabled]}
                      onPress={handleForgotPassword}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={['#10B981', '#059669']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                      >
                        {loading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Text style={styles.primaryButtonText}>GỬI MÃ XÁC THỰC</Text>
                            <Ionicons name="send-outline" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.backButton}
                      onPress={() => {
                        resetAuthStates();
                        setMode('login');
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="arrow-back" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
                      <Text style={styles.backText}>Quay lại đăng nhập</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 6. RESET PASSWORD FORM */}
                {mode === 'resetPassword' && (
                  <View style={styles.form}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>MÃ OTP XÁC NHẬN</Text>
                      <Pressable
                        onPress={() => forgotOtpRef.current?.focus()}
                        style={[
                          styles.inputContainer,
                          focusedInput === 'forgotOtp' && styles.inputContainerFocused,
                        ]}
                      >
                        <Ionicons
                          name="key-outline"
                          size={18}
                          color={focusedInput === 'forgotOtp' ? '#10B981' : '#64748B'}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          ref={forgotOtpRef}
                          style={styles.input}
                          value={forgotOtp}
                          onChangeText={setForgotOtp}
                          placeholder="Nhập mã OTP"
                          placeholderTextColor="#64748B"
                          keyboardType="number-pad"
                          onFocus={() => setFocusedInput('forgotOtp')}
                          onBlur={() => setFocusedInput(null)}
                        />
                      </Pressable>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>MẬT KHẨU MỚI</Text>
                      <Pressable
                        onPress={() => newPasswordRef.current?.focus()}
                        style={[
                          styles.inputContainer,
                          focusedInput === 'newPassword' && styles.inputContainerFocused,
                        ]}
                      >
                        <Ionicons
                          name="shield-checkmark-outline"
                          size={18}
                          color={focusedInput === 'newPassword' ? '#10B981' : '#64748B'}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          ref={newPasswordRef}
                          style={styles.input}
                          value={newPassword}
                          onChangeText={setNewPassword}
                          placeholder="Nhập mật khẩu mới"
                          placeholderTextColor="#64748B"
                          secureTextEntry={!showNewPassword}
                          autoCapitalize="none"
                          onFocus={() => setFocusedInput('newPassword')}
                          onBlur={() => setFocusedInput(null)}
                        />
                        <TouchableOpacity
                          onPress={() => setShowNewPassword(!showNewPassword)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons
                            name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={20}
                            color={showNewPassword ? '#10B981' : '#64748B'}
                          />
                        </TouchableOpacity>
                      </Pressable>
                    </View>

                    <TouchableOpacity
                      style={[styles.primaryButton, loading && styles.buttonDisabled]}
                      onPress={handleResetPassword}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={['#10B981', '#059669']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                      >
                        {loading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Text style={styles.primaryButtonText}>ĐẶT LẠI MẬT KHẨU</Text>
                            <Ionicons name="lock-open-outline" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.backButton}
                      onPress={() => setMode('forgotPassword')}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="arrow-back" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
                      <Text style={styles.backText}>Quay lại</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050811',
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    justifyContent: 'flex-start',
  },
  header: {
    alignItems: 'center',
    marginBottom: 14,
  },
  logoBadgeContainer: {
    alignItems: 'center',
    marginBottom: 6,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 6,
    gap: 5,
  },
  onlineDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
  },
  onlineText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  appName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 16,
    marginTop: 4,
  },
  formCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  form: {
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 19, 38, 0.85)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 50,
  },
  inputContainerFocused: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    paddingHorizontal: 4,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: 2,
  },
  forgotText: {
    fontSize: 13,
    color: '#38BDF8',
    fontWeight: '600',
  },
  primaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  backText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  footerText: {
    fontSize: 13,
    color: '#64748B',
  },
  linkText: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '700',
  },
});
