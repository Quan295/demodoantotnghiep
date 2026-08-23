import { api } from '@/services/api';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    FlatList,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

// Safely import MapView only on Native platforms
let MapViewComponent: any = null;
let MarkerComponent: any = null;
let PROVIDER_GOOGLE_CONST: any = null;

if (Platform.OS !== 'web') {
  try {
    const MapModule = require('react-native-maps');
    MapViewComponent = MapModule.default;
    MarkerComponent = MapModule.Marker;
    PROVIDER_GOOGLE_CONST = MapModule.PROVIDER_GOOGLE;
  } catch (e) {
    console.warn('MapView failed to load', e);
  }
}

const { width, height } = Dimensions.get('window');

export default function DispatcherDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('map');
  const scanAnim = useRef(new Animated.Value(0)).current;
  const [cases, setCases] = useState<any[]>([]);

  // Fetch dispatch requests
  const fetchRequests = async () => {
    try {
      const data = await api.getDispatchRequests();
      const mapped = data.map((c: any, index: number) => {
        // Calculate coordinates based on standard offsets if not fully defined in GPS
        const latOffset = (index % 3 - 1) * 0.005;
        const lngOffset = (index % 2 - 0.5) * 0.01;
        
        return {
          id: c.id,
          type: c.priority === 'critical' ? 'Cấp cứu nghiêm trọng' : 'Sự cố cấp cứu',
          status: c.status === 'pending' ? 'Đang điều phối' : c.status === 'assigned' ? 'Đã nhận lệnh' : 'Chờ xử lý',
          time: 'Vừa xong',
          address: c.location?.address || 'Tọa độ khẩn cấp',
          priority: c.priority === 'critical' ? 'Khẩn cấp' : c.priority === 'high' ? 'Cao' : 'Trung bình',
          coordinates: { 
            latitude: c.location?.lat || (21.015 + latOffset), 
            longitude: c.location?.lng || (105.82 + lngOffset) 
          },
        };
      });
      setCases(mapped);
    } catch (e) {
      console.warn('Failed to load dispatch requests in dashboard:', e);
    }
  };

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const scanTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 100],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Immersive Background */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={['#090B0F', '#0D1117']} style={StyleSheet.absoluteFill} />
        <View style={styles.headerGlow} />
      </View>

      {/* Header Command Center Style */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.consoleBox}>
            <Text style={styles.consoleText}>STATION-HANOI-115</Text>
          </View>
          <Text style={styles.headerTitle}>CRISIS CONTROL CONSOLE</Text>
          <View style={styles.statusRow}>
            <View style={styles.liveDot} />
            <Text style={styles.headerSubtitle}>SYSTEM: ACTIVE • AI: MONITORING • SAT: CONNECTED</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.dataBadge}>
            <Text style={styles.dataLabel}>UNITS</Text>
            <Text style={styles.dataValue}>12/15</Text>
          </View>
          <TouchableOpacity style={styles.profileBtn}>
            <MaterialCommunityIcons name="shield-account" size={24} color="#A78BFA" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content Area */}
      <View style={styles.content}>
        {activeTab === 'map' ? (
          <View style={styles.mapContainer}>
            {Platform.OS !== 'web' && MapViewComponent ? (
              <MapViewComponent
                provider={PROVIDER_GOOGLE_CONST}
                style={styles.map}
                initialRegion={{
                  latitude: 21.015,
                  longitude: 105.82,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
                customMapStyle={darkMapStyle}
              >
                {cases.map(c => (
                  <MarkerComponent key={c.id} coordinate={c.coordinates}>
                    <View style={[styles.customMarker, { borderColor: c.priority === 'Khẩn cấp' ? '#F04438' : '#F79009' }]}>
                      <View style={[styles.markerPulse, { backgroundColor: c.priority === 'Khẩn cấp' ? '#F04438' : '#F79009' }]} />
                      <FontAwesome5 name={c.type === 'Tai nạn giao thông' ? 'car-crash' : 'heartbeat'} size={12} color="#FFF" />
                    </View>
                  </MarkerComponent>
                ))}
              </MapViewComponent>
            ) : (
              <View style={styles.webMapPlaceholder}>
                <View style={styles.gridOverlayMap} />
                <MaterialCommunityIcons name="map-marker-radius" size={48} color="#1F2A37" />
                <Text style={styles.webMapText}>Bản đồ đang hoạt động (Mobile Only)</Text>
              </View>
            )}

            {/* AI HUD Overlay */}
            <View style={styles.aiOverlay}>
              <View style={styles.aiPanel}>
                <LinearGradient
                  colors={['rgba(13, 17, 23, 0.95)', 'rgba(9, 11, 15, 0.98)']}
                  style={styles.aiPanelContent}
                >
                  <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanTranslateY }] }]} />
                  <View style={styles.aiHeader}>
                    <View style={styles.aiIconBox}>
                      <MaterialCommunityIcons name="robot" size={18} color="#A78BFA" />
                    </View>
                    <View>
                      <Text style={styles.aiTitle}>AI CORE ANALYSIS</Text>
                      <Text style={styles.aiSubtitle}>PROCESSING REAL-TIME DATA</Text>
                    </View>
                  </View>
                  
                  <View style={styles.hudDivider} />
                  
                  <View style={styles.aiStats}>
                    <View style={styles.aiStatItem}>
                      <Text style={styles.aiStatLabel}>NETWORK LATENCY</Text>
                      <Text style={styles.aiStatValue}>12ms</Text>
                    </View>
                    <View style={styles.aiStatDivider} />
                    <View style={styles.aiStatItem}>
                      <Text style={styles.aiStatLabel}>PREDICTION CONF.</Text>
                      <Text style={styles.aiStatValue}>98.2%</Text>
                    </View>
                    <View style={styles.aiStatDivider} />
                    <View style={styles.aiStatItem}>
                      <Text style={styles.aiStatLabel}>ALERT LVL</Text>
                      <Text style={[styles.aiStatValue, { color: '#F04438' }]}>CRITICAL</Text>
                    </View>
                  </View>

                  <View style={styles.logContainer}>
                    <Text style={styles.logText}>[14:20:05] SOS DETECTED - CHUA BOC</Text>
                    <Text style={styles.logText}>{'[14:20:07] WHISPER: "Help! Car accident..."'}</Text>
                    <Text style={styles.logText}>[14:20:08] BERT: Traffic Collision (94%)</Text>
                    <Text style={styles.logText}>[14:21:12] UNIT-04 (HOSPITAL-115) DISPATCHED</Text>
                  </View>
                </LinearGradient>
              </View>
            </View>

            <View style={styles.horizontalList}>
              <FlatList
                data={cases}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, index) => (item?.id != null ? String(item.id) : `case-h-${index}`)}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.glassCardSmall}
                    onPress={() => router.push({ pathname: '/(dispatcher)/case-detail', params: { id: item.id } })}
                  >
                    <View style={styles.cardHeaderSmall}>
                      <View style={[styles.priorityTag, { backgroundColor: item.priority === 'Khẩn cấp' ? 'rgba(240, 68, 56, 0.2)' : 'rgba(247, 144, 9, 0.2)' }]}>
                        <Text style={[styles.priorityTagText, { color: item.priority === 'Khẩn cấp' ? '#F04438' : '#F79009' }]}>{item.priority}</Text>
                      </View>
                      <Text style={styles.caseTimeSmall}>{item.time}</Text>
                    </View>
                    <Text style={styles.caseTypeSmall}>{item.type}</Text>
                    <View style={styles.cardFooterSmall}>
                      <Ionicons name="location" size={12} color="#475467" />
                      <Text style={styles.caseAddressSmall} numberOfLines={1}>{item.address}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        ) : (
          <FlatList
            data={cases}
            contentContainerStyle={styles.listPadding}
            keyExtractor={(item, index) => (item?.id != null ? String(item.id) : `case-v-${index}`)}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.glassCardLarge}
                onPress={() => router.push({ pathname: '/(dispatcher)/case-detail', params: { id: item.id } })}
              >
                <View style={styles.cardHeaderLarge}>
                  <Text style={styles.caseTypeLarge}>{item.type}</Text>
                  <View style={[styles.priorityTag, { backgroundColor: item.priority === 'Khẩn cấp' ? 'rgba(240, 68, 56, 0.2)' : 'rgba(247, 144, 9, 0.2)' }]}>
                    <Text style={[styles.priorityTagText, { color: item.priority === 'Khẩn cấp' ? '#F04438' : '#F79009' }]}>{item.priority}</Text>
                  </View>
                </View>
                <View style={styles.cardBodyLarge}>
                  <Ionicons name="location" size={16} color="#475467" />
                  <Text style={styles.caseAddressLarge}>{item.address}</Text>
                </View>
                <View style={styles.cardFooterLarge}>
                  <View style={styles.footerInfo}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color="#475467" />
                    <Text style={styles.caseTimeLarge}>{item.time}</Text>
                  </View>
                  <Text style={styles.caseStatusLarge}>{item.status.toUpperCase()}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* Bottom Nav Command Bar Style */}
      <View style={styles.bottomNav}>
        <NavBtn icon="grid-outline" label="OVERVIEW" active={activeTab === 'map'} onPress={() => setActiveTab('map')} />
        <NavBtn icon="list-outline" label="CASES" active={activeTab === 'list'} onPress={() => setActiveTab('list')} />
        <NavBtn icon="shield-checkmark-outline" label="UNITS" active={false} onPress={() => {}} />
      </View>
    </View>
  );
}

const NavBtn = ({ icon, label, active, onPress }: any) => (
  <TouchableOpacity style={styles.navBtn} onPress={onPress}>
    <Ionicons name={icon} size={22} color={active ? '#A78BFA' : '#475467'} />
    <Text style={[styles.navLabel, { color: active ? '#A78BFA' : '#475467' }]}>{label}</Text>
    {active && <View style={styles.navIndicator} />}
  </TouchableOpacity>
);

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#090B0F" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#111827" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0F172A" }] },
  { "featureType": "poi", "stylers": [{ "visibility": "off" }] }
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090B0F',
  },
  headerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(167, 139, 250, 0.05)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    backgroundColor: 'rgba(13, 17, 23, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dataBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  dataLabel: {
    color: '#475467',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1,
  },
  dataValue: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  consoleBox: {
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  consoleText: {
    color: '#A78BFA',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F04438',
    marginRight: 6,
  },
  headerSubtitle: {
    color: '#475467',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  content: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
  },
  gridOverlayMap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  map: {
    flex: 1,
  },
  customMarker: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#0D1117',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  markerPulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    opacity: 0.2,
  },
  aiOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
  },
  aiPanel: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.2)',
    backgroundColor: 'rgba(13, 17, 23, 0.9)',
    elevation: 10,
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  aiPanelContent: {
    padding: 16,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(167, 139, 250, 0.3)',
    zIndex: 1,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.2)',
  },
  aiTitle: {
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  aiSubtitle: {
    color: '#475467',
    fontSize: 8,
    fontWeight: '800',
    marginTop: 1,
  },
  hudDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 12,
  },
  aiStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  aiStatItem: {
    alignItems: 'center',
  },
  aiStatLabel: {
    color: '#475467',
    fontSize: 7,
    fontWeight: '900',
    marginBottom: 4,
  },
  aiStatValue: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
  },
  aiStatDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  logContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#A78BFA',
  },
  logText: {
    color: '#475467',
    fontSize: 8,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 2,
  },
  horizontalList: {
    position: 'absolute',
    bottom: 24,
    paddingLeft: 20,
  },
  glassCardSmall: {
    width: width * 0.7,
    backgroundColor: 'rgba(13, 17, 23, 0.95)',
    borderRadius: 24,
    padding: 20,
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardHeaderSmall: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priorityTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityTagText: {
    fontSize: 9,
    fontWeight: '900',
  },
  caseTimeSmall: {
    color: '#475467',
    fontSize: 10,
    fontWeight: '800',
  },
  caseTypeSmall: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  cardFooterSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  caseAddressSmall: {
    color: '#98A2B3',
    fontSize: 12,
    fontWeight: '500',
  },
  listPadding: {
    padding: 24,
  },
  glassCardLarge: {
    backgroundColor: 'rgba(13, 17, 23, 0.8)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardHeaderLarge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  caseTypeLarge: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  cardBodyLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  caseAddressLarge: {
    color: '#98A2B3',
    fontSize: 14,
    marginLeft: 10,
    fontWeight: '500',
  },
  cardFooterLarge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 16,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  caseTimeLarge: {
    color: '#475467',
    fontSize: 12,
    fontWeight: '700',
  },
  caseStatusLarge: {
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#0D1117',
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  navBtn: {
    alignItems: 'center',
    flex: 1,
  },
  navLabel: {
    fontSize: 9,
    fontWeight: '900',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  navIndicator: {
    position: 'absolute',
    top: -16,
    width: 20,
    height: 3,
    backgroundColor: '#A78BFA',
    borderRadius: 3,
  },
  webMapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D1117',
  },
  webMapText: {
    color: '#475467',
    marginTop: 12,
    fontSize: 14,
  },
});
