import {
  AmbulanceSimulation,
  DispatchMission,
  DriverResource,
  EmergencyCall,
  LatLng,
  TrackingUpdate,
  User,
  Vehicle,
} from '@/types';
import { globalConfig } from './config';

// Mock Data
export const MOCK_USERS: (User & { username: string })[] = [
  { id: '1', role: 'admin', name: 'Admin User', email: 'admin@example.com', phone: '0123456789', createdAt: new Date(), username: 'admin' },
  { id: '2', role: 'provider', name: 'Provider 1', email: 'provider1@example.com', phone: '0123456788', createdAt: new Date(), balance: 5000000, avgRating: 4.8, totalRevenue: 10000000, totalCases: 25, username: 'provider1' },
  { id: '3', role: 'driver', name: 'Driver 1', email: 'driver1@example.com', phone: '0123456787', createdAt: new Date(), username: 'driver1' },
  { id: '4', role: 'reporter', name: 'Nguyễn Văn A', email: 'reporter@example.com', phone: '0909123456', createdAt: new Date(), username: 'user_test01' },
  { id: '5', role: 'dispatcher', name: 'Dispatcher 1', email: 'dispatcher@example.com', phone: '0123456786', createdAt: new Date(), username: 'dispatcher1' },
];

export const MOCK_VEHICLES: Vehicle[] = [
  { id: '1', licensePlate: '30A-12345', type: 'ambulance', status: 'available', providerId: '2' },
  { id: '2', licensePlate: '30A-67890', type: 'emergency-car', status: 'busy', providerId: '2' },
];

export let MOCK_DISPATCH_MISSIONS: DispatchMission[] = [
  {
    id: 3,
    requestId: 3,
    resourceId: 2,
    destinationName: '12 Chùa Bộc, Đống Đa, Hà Nội',
    status: 'DISPATCHED',
    dispatchedAt: new Date(Date.now() - 300000).toISOString(),
    notes: 'Tai nạn giao thông - Yêu cầu cấp cứu khẩn cấp',
  },
  {
    id: 2,
    requestId: 2,
    resourceId: 2,
    destinationName: '45 Tây Sơn, Đống Đa, Hà Nội',
    status: 'COMPLETED',
    dispatchedAt: new Date(Date.now() - 7500000).toISOString(),
    acceptedAt: new Date(Date.now() - 7200000).toISOString(),
    enRouteAt: new Date(Date.now() - 6600000).toISOString(),
    arrivedSceneAt: new Date(Date.now() - 5400000).toISOString(),
    startTransportAt: new Date(Date.now() - 4800000).toISOString(),
    arrivedHospitalAt: new Date(Date.now() - 4200000).toISOString(),
    completedAt: new Date(Date.now() - 3600000).toISOString(),
    notes: 'Đã hoàn tất chuyển viện an toàn',
  },
  {
    id: 1,
    requestId: 1,
    resourceId: 2,
    destinationName: '88 Thái Hà, Đống Đa, Hà Nội',
    status: 'COMPLETED',
    dispatchedAt: new Date(Date.now() - 86400000).toISOString(),
    completedAt: new Date(Date.now() - 82800000).toISOString(),
    notes: 'Bỏng nước sôi cấp độ 2',
  },
];

export let MOCK_DRIVER_RESOURCE: DriverResource = {
  id: '1042',
  resourceId: '1042',
  licensePlate: '29A-115.88',
  license_plate: '29A-115.88',
  vehicleNumber: 'AMB-042',
  type: 'AMBULANCE',
  vehicleType: 'Xe Cấp Cứu Hồi Sức Tích Cực (ICU Ambulance)',
  status: 'AVAILABLE',
  providerId: '2',
  providerName: 'Bệnh viện Cấp Cứu 115 - Chi nhánh Đống Đa',
  driverId: '3',
  driverName: 'Bác sĩ / Tài xế Hùng',
  driverPhone: '0988.115.115',
  latitude: 21.0091,
  longitude: 105.8247,
  speed: 0,
  heading: 90,
  fuelLevel: 88,
  batteryLevel: 96,
  odometer: 14250,
  equipment: [
    'Máy sốc tim ngoài lồng ngực tự động (AED)',
    'Bình Oxy y tế 10L kèm đồng hồ đo lưu lượng',
    'Máy thở mini di động chuyên dụng cấp cứu',
    'Bộ nẹp cố định cột sống & cổ đa năng',
    'Cáng / Băng ca cứu thương thủy lực gấp gọn',
    'Bộ sơ cấp cứu & dịch truyền tĩnh mạch'
  ],
  extended_attributes: {
    license_plate: '29A-115.88',
    vehicle_type: 'Xe Cấp Cứu Hồi Sức Tích Cực (ICU Ambulance)',
    model: 'Ford Transit Emergency ICU 2024',
    oxygen_capacity: '10L',
    aed_fitted: true,
  },
  lastLocationUpdate: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const MOCK_PROVIDERS = [
  { id: '2', name: 'Bệnh viện ABC', phoneNumber: '0123456788', email: 'contact@abc.com' },
  { id: '3', name: 'Đội cứu hộ XYZ', phoneNumber: '0123456789', email: 'contact@xyz.com' },
];

export const MOCK_SERVICE_TYPES = [
  { id: '1', name: 'Cấp cứu cơ bản' },
  { id: '2', name: 'Cấp cứu nâng cao' },
  { id: '3', name: 'Cấp cứu tim mạch' },
];

export const MOCK_OPERATION_ZONES = [
  { id: '1', name: 'Quận 1 - TP HCM' },
  { id: '2', name: 'Quận 2 - TP HCM' },
  { id: '3', name: 'Quận 3 - TP HCM' },
];

export const MOCK_DISPATCH_REQUESTS = [
  { id: '1', status: 'pending', description: 'Tai nạn giao thông ở đường Lê Lợi', createdAt: new Date() },
  { id: '2', status: 'assigned', description: 'Người bị ngất ở công viên', createdAt: new Date() },
];

export const MOCK_EMERGENCY_CALLS: EmergencyCall[] = [
  {
    id: '1',
    status: 'DISPATCHED',
    description: 'Tai nạn giao thông ở đường Lê Lợi, chấn thương chân',
    createdAt: new Date(Date.now() - 600000).toISOString(),
    updatedAt: new Date(Date.now() - 300000).toISOString(),
    latitude: 21.0091,
    longitude: 105.8247,
    priority: 'HIGH',
    assignedDriverName: 'Bác sĩ / Tài xế Hùng',
    assignedDriverPhone: '0988.115.115',
    assignedVehiclePlate: '29A-115.88',
    assignedHospital: 'Bệnh viện Cấp Cứu 115 - Chi nhánh Đống Đa',
    estimatedEtaMin: 4,
  },
  {
    id: '2',
    status: 'ARRIVED',
    description: 'Người ngất xỉu tại công viên 30/4, khó thở',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    latitude: 21.0123,
    longitude: 105.8301,
    priority: 'CRITICAL',
    assignedDriverName: 'Tài xế Tuấn',
    assignedDriverPhone: '0977.115.222',
    assignedVehiclePlate: '29A-115.99',
    assignedHospital: 'Bệnh viện Bạch Mai - Khoa Cấp Cứu A9',
    estimatedEtaMin: 0,
  },
  {
    id: '3',
    status: 'COMPLETED',
    description: 'Đau ngực dữ dội tại nhà riêng',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 80000000).toISOString(),
    latitude: 21.0156,
    longitude: 105.8355,
    priority: 'HIGH',
    assignedDriverName: 'Tài xế Hùng',
    assignedDriverPhone: '0988.115.115',
    assignedVehiclePlate: '29A-115.88',
    assignedHospital: 'Bệnh viện Cấp Cứu 115',
    estimatedEtaMin: 0,
  },
];

export let MOCK_SIMULATIONS: AmbulanceSimulation[] = [];
export const MOCK_SIMULATION_STATES: Record<string, { interval?: any; routeIndex: number; route: LatLng[] }> = {};

/**
 * Handle simulated / mock requests when Mock Data is explicitly turned ON
 */
export async function handleMockRequest<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  await new Promise(resolve => setTimeout(resolve, 300));

  // Auth endpoints
  if (path === '/auth/login') {
    const { username } = JSON.parse(options.body as string);
    const mockUser = MOCK_USERS.find(u => u.username.toLowerCase().includes(username.toLowerCase())) || MOCK_USERS[0];
    const response = {
      accessToken: 'mock-token-123',
      refreshToken: 'mock-refresh-token-123',
      tokenType: 'Bearer',
      expiresIn: 3600,
      userId: Number(mockUser.id),
      username: mockUser.username || 'test_user',
      fullName: mockUser.name,
      roles: [mockUser.role.toUpperCase() as any],
      phoneNumber: mockUser.phone,
    };
    globalConfig.setToken(response.accessToken);
    globalConfig.setRefreshToken(response.refreshToken);
    globalConfig.setCurrentUser(response);
    return response as T;
  }
  if (path === '/auth/register') {
    return { success: true, message: 'Đăng ký thành công' } as T;
  }
  if (path === '/auth/send-otp') {
    return { success: true, message: 'Gửi OTP thành công' } as T;
  }
  if (path === '/auth/verify-otp') {
    return { success: true, message: 'Xác minh OTP thành công' } as T;
  }

  // Users
  if (path === '/users') return MOCK_USERS as T;
  if (path === '/users/me') {
    const currentUser = globalConfig.getCurrentUser();
    return (currentUser || MOCK_USERS[0]) as T;
  }
  if (path.startsWith('/users/')) return MOCK_USERS[0] as T;

  // Providers
  if (path === '/providers') return MOCK_PROVIDERS as T;
  if (path.startsWith('/providers/')) return MOCK_PROVIDERS[0] as T;

  // Vehicles
  if (path === '/dispatch-resources') return MOCK_VEHICLES as T;
  if (path.startsWith('/dispatch-resources/')) return MOCK_VEHICLES[0] as T;

  // Emergency calls
  if (path === '/calls/sos' || path === '/calls/voice' || path === '/calls/callback') {
    const body = JSON.parse(options.body as string || '{}');
    const lat = body.location?.latitude ?? body.latitude ?? 21.0091;
    const lng = body.location?.longitude ?? body.longitude ?? 105.8247;
    const newCall: EmergencyCall = {
      id: (MOCK_EMERGENCY_CALLS.length + 1).toString(),
      status: 'DISPATCHED',
      description: body.description || 'Yêu cầu cứu hộ khẩn cấp (Mock)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      latitude: lat,
      longitude: lng,
      location: { latitude: lat, longitude: lng },
      audioObjectKey: body.audioObjectKey,
      priority: 'HIGH',
      assignedDriverName: 'Bác sĩ / Tài xế Hùng',
      assignedDriverPhone: '0988.115.115',
      assignedVehiclePlate: '29A-115.88',
      assignedHospital: 'Bệnh viện Cấp Cứu 115 - Đống Đa',
      estimatedEtaMin: 4,
    };
    MOCK_EMERGENCY_CALLS.unshift(newCall);
    return newCall as T;
  }

  if (path === '/calls/my-calls' || path === '/calls/me') {
    return MOCK_EMERGENCY_CALLS as T;
  }

  // Driver Resource
  if (path === '/driver-resource' && (!options.method || options.method === 'GET')) {
    return MOCK_DRIVER_RESOURCE as T;
  }

  // Driver Missions
  if (path === '/dispatch-missions/me/active') {
    const active = MOCK_DISPATCH_MISSIONS.find(m =>
      ['DISPATCHED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED_SCENE', 'TRANSPORTING', 'ARRIVED_HOSPITAL'].includes(m.status)
    );
    return (active ? [active] : []) as T;
  }

  if (path === '/dispatch-missions/me') {
    return MOCK_DISPATCH_MISSIONS as T;
  }

  return {} as T;
}
