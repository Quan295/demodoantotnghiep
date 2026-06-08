import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Platform,
  Vibration,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();

  const handleSelectRole = (role: 'citizen' | 'driver') => {
    if (Platform.OS !== 'web') {
      Vibration.vibrate(50);
    }
    if (role === 'citizen') {
      router.push('/(citizen)/sos');
    } else {
      router.push('/(driver)/dashboard');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: '#090B0F' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#090B0F" />
      
      <SafeAreaView style={styles.safeArea}>
        {/* Header Section */}
        <View style={styles.headerContainer}>
          <View style={[styles.logoIconContainer, { backgroundColor: 'rgba(240, 68, 56, 0.15)' }]}>
            <MaterialCommunityIcons name="heart-pulse" size={44} color="#F04438" />
          </View>
          <Text style={styles.appTitle}>115 SMART DISPATCH</Text>
          <Text style={styles.appSubtitle}>Hệ Thống Điều Phối Cấp Cứu Thông Minh</Text>
        </View>

        {/* Roles Selection Section */}
        <View style={styles.cardsContainer}>
          
          {/* Card 1: Citizen */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleSelectRole('citizen')}
            style={[
              styles.roleCard,
              { 
                backgroundColor: '#151B26',
                borderColor: 'rgba(240, 68, 56, 0.4)',
                borderWidth: 1.5,
              }
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(240, 68, 56, 0.2)' }]}>
                <FontAwesome5 name="ambulance" size={24} color="#F04438" />
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>KHẨN CẤP</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>Người Dân / Nạn Nhân</Text>
            <Text style={styles.cardDesc}>
              Gửi định vị GPS cứu hộ ngay lập tức, kết nối trực tiếp với trung tâm 115 khi gặp sự cố tai nạn.
            </Text>
            <View style={[styles.actionButton, { backgroundColor: '#F04438' }]}>
              <Text style={styles.actionButtonText}>KÍCH HOẠT SOS</Text>
              <FontAwesome5 name="arrow-right" size={14} color="#FFF" style={styles.actionIcon} />
            </View>
          </TouchableOpacity>

          {/* Card 2: Driver */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleSelectRole('driver')}
            style={[
              styles.roleCard,
              { 
                backgroundColor: '#111622',
                borderColor: 'rgba(255, 255, 255, 0.08)',
                borderWidth: 1,
              }
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(255, 255, 255, 0.06)' }]}>
                <FontAwesome5 name="user-md" size={24} color="#98A2B3" />
              </View>
            </View>
            <Text style={[styles.cardTitle, { color: '#F9FAFB' }]}>Tài Xế Xe Cứu Thương</Text>
            <Text style={[styles.cardDesc, { color: '#98A2B3' }]}>
              Nhận lệnh điều phối cứu hộ từ tổng đài, định vị xe trực tuyến và xem lộ trình dẫn đường.
            </Text>
            <View style={[styles.actionButton, { backgroundColor: '#1F2A37' }]}>
              <Text style={[styles.actionButtonText, { color: '#F9FAFB' }]}>BẮT ĐẦU NHIỆM VỤ</Text>
              <FontAwesome5 name="arrow-right" size={14} color="#F9FAFB" style={styles.actionIcon} />
            </View>
          </TouchableOpacity>

        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Smart Emergency Medical Dispatch • v1.0</Text>
          <Text style={styles.footerSubText}>Hệ thống định vị PostGIS & Phân tích AI Speech-to-Text</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: 30,
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  logoIconContainer: {
    padding: 16,
    borderRadius: 24,
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  appSubtitle: {
    fontSize: 14,
    color: '#98A2B3',
    marginTop: 8,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  cardsContainer: {
    gap: 20,
    marginVertical: 30,
  },
  roleCard: {
    borderRadius: 20,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: '#FEE4E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#B42318',
    fontSize: 10,
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 13,
    color: '#D0D5DD',
    lineHeight: 18,
    marginBottom: 18,
  },
  actionButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionIcon: {
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#475467',
    fontWeight: '600',
  },
  footerSubText: {
    fontSize: 10,
    color: '#344054',
    marginTop: 4,
  },
});
