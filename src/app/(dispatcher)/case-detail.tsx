import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function CaseDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [dispatching, setDispatching] = useState(false);

  const transcript = [
    { speaker: 'Caller', text: 'Cứu tôi với, có tai nạn ở ngã tư Chùa Bộc!' },
    { speaker: 'AI Dispatcher', text: 'Tôi đã nhận được tín hiệu. Bạn có thể cho biết có bao nhiêu người bị thương không?' },
    { speaker: 'Caller', text: 'Có 2 người, một người đang chảy máu rất nhiều ở chân.' },
    { speaker: 'AI Dispatcher', text: 'Đã rõ. Xe cứu thương đang đến. Hãy giữ bình tĩnh.' },
  ];

  const handleDispatch = async () => {
    setDispatching(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setDispatching(false);
    Alert.alert(
      'Điều phối thành công',
      'Đơn vị Hospital-115 đã nhận lệnh. Chi phí dự kiến: 500,000đ (Thanh toán qua cổng trung gian).',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#090B0F', '#111827']} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={28} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>CASE DETAILS #{id}</Text>
            <TouchableOpacity style={styles.shareBtn}>
              <Ionicons name="share-outline" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* AI Analysis Command View */}
            <View style={styles.aiPanel}>
              <View style={styles.panelHeader}>
                <View style={styles.aiTitle}>
                  <MaterialCommunityIcons name="robot-outline" size={20} color="#A78BFA" />
                  <Text style={styles.panelTitle}>AI REAL-TIME ANALYSIS</Text>
                </View>
                <View style={styles.confidenceTag}>
                  <Text style={styles.confidenceText}>98% CONFIDENCE</Text>
                </View>
              </View>

              <View style={styles.transcriptBox}>
                {transcript.map((line, idx) => (
                  <View key={idx} style={styles.transcriptLine}>
                    <Text style={[styles.speaker, { color: line.speaker === 'Caller' ? '#F04438' : '#A78BFA' }]}>
                      {line.speaker.toUpperCase()}
                    </Text>
                    <Text style={styles.transcriptText}>{line.text}</Text>
                  </View>
                ))}
              </View>

              <LinearGradient colors={['rgba(167, 139, 250, 0.1)', 'rgba(0,0,0,0)']} style={styles.aiSummary}>
                <Text style={styles.summaryLabel}>AI RECOMMENDATION:</Text>
                <Text style={styles.summaryValue}>
                  • High Priority: Severe bleeding reported.{'\n'}
                  • Dispatch: ALS Unit (Ambulance with Life Support).{'\n'}
                  • Nearest Station: Dong Da 115 Station (1.2km).
                </Text>
              </LinearGradient>
            </View>

            {/* Victim Data */}
            <View style={styles.dataCard}>
              <Text style={styles.cardLabel}>VICTIM INFORMATION</Text>
              <DataRow icon="account" label="Name" value="Nguyễn Văn A" />
              <DataRow icon="phone" label="Contact" value="0987.654.321" />
              <DataRow icon="map-marker" label="Location" value="12 Chùa Bộc, Đống Đa, Hà Nội" />
            </View>

            {/* Resource Allocation */}
            <View style={styles.dataCard}>
              <Text style={styles.cardLabel}>RESOURCE ALLOCATION</Text>
              <VehicleItem 
                id="AMB-042" 
                team="Dong Da Team" 
                dist="1.2 km" 
                eta="4 min" 
                status="AVAILABLE" 
                active 
              />
              <VehicleItem 
                id="AMB-015" 
                team="Ba Dinh Team" 
                dist="3.5 km" 
                eta="10 min" 
                status="BUSY" 
                active={false}
              />
            </View>

            <View style={{ height: 120 }} />
          </ScrollView>

          <View style={styles.footerAction}>
            <TouchableOpacity 
              style={[styles.dispatchBtn, dispatching && { opacity: 0.7 }]} 
              onPress={handleDispatch}
              disabled={dispatching}
            >
              {dispatching ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <FontAwesome5 name="paper-plane" size={16} color="#000" />
                  <Text style={styles.dispatchBtnText}>DISPATCH AMBULANCE</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const DataRow = ({ icon, label, value }: any) => (
  <View style={styles.dataRow}>
    <MaterialCommunityIcons name={icon} size={20} color="#475467" />
    <View style={styles.dataContent}>
      <Text style={styles.dataLabelText}>{label}</Text>
      <Text style={styles.dataValueText}>{value}</Text>
    </View>
  </View>
);

const VehicleItem = ({ id, team, dist, eta, status, active }: any) => (
  <TouchableOpacity style={[styles.vehicleItem, active && styles.vehicleItemActive]}>
    <View style={styles.vehicleIcon}>
      <FontAwesome5 name="ambulance" size={16} color={active ? '#32D583' : '#475467'} />
    </View>
    <View style={styles.vehicleInfo}>
      <Text style={styles.vehicleId}>{id}</Text>
      <Text style={styles.vehicleTeam}>{team} • {dist}</Text>
    </View>
    <View style={styles.vehicleMeta}>
      <Text style={[styles.vehicleStatus, { color: active ? '#32D583' : '#F79009' }]}>{status}</Text>
      <Text style={styles.vehicleEta}>{eta}</Text>
    </View>
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
    paddingTop: 40,
    paddingBottom: 20,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
  shareBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  aiPanel: {
    backgroundColor: '#0D1117',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.2)',
    marginBottom: 24,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  aiTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  panelTitle: {
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  confidenceTag: {
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  confidenceText: {
    color: '#A78BFA',
    fontSize: 9,
    fontWeight: '900',
  },
  transcriptBox: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
  },
  transcriptLine: {
    marginBottom: 12,
  },
  speaker: {
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  transcriptText: {
    color: '#E4E7EB',
    fontSize: 14,
    lineHeight: 20,
  },
  aiSummary: {
    padding: 16,
    borderRadius: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#A78BFA',
  },
  summaryLabel: {
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 8,
  },
  summaryValue: {
    color: '#98A2B3',
    fontSize: 13,
    lineHeight: 20,
  },
  dataCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 20,
  },
  cardLabel: {
    color: '#475467',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 16,
  },
  dataLabelText: {
    color: '#475467',
    fontSize: 11,
    fontWeight: '700',
  },
  dataValueText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  dataContent: {
    flex: 1,
  },
  vehicleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  vehicleItemActive: {
    borderColor: 'rgba(50, 213, 131, 0.2)',
    backgroundColor: 'rgba(50, 213, 131, 0.05)',
  },
  vehicleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleInfo: {
    flex: 1,
    marginLeft: 16,
  },
  vehicleId: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  vehicleTeam: {
    color: '#475467',
    fontSize: 12,
    marginTop: 2,
  },
  vehicleMeta: {
    alignItems: 'flex-end',
  },
  vehicleStatus: {
    fontSize: 10,
    fontWeight: '900',
  },
  vehicleEta: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  footerAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    backgroundColor: '#090B0F',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  dispatchBtn: {
    backgroundColor: '#A78BFA',
    height: 64,
    borderRadius: 22,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  dispatchBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 12,
    letterSpacing: 1,
  },
});
