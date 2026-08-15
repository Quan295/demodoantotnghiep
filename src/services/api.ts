import { AmbulanceSimulation, DriverLocationUpdatePayload, DriverResource, LatLng, TrackingUpdate, User, Vehicle } from '@/types';
import { globalConfig } from './config';

// Define API Response Type
interface ApiResponse<T = any> {
  code: number;
  success: boolean;
  message: string;
  data: T;
  metadata?: {
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
}

// Mock Data
const MOCK_USERS: (User & { username: string })[] = [
  { id: '1', role: 'admin', name: 'Admin User', email: 'admin@example.com', phone: '0123456789', createdAt: new Date(), username: 'admin' },
  { id: '2', role: 'provider', name: 'Provider 1', email: 'provider1@example.com', phone: '0123456788', createdAt: new Date(), balance: 5000000, avgRating: 4.8, totalRevenue: 10000000, totalCases: 25, username: 'provider1' },
  { id: '3', role: 'driver', name: 'Driver 1', email: 'driver1@example.com', phone: '0123456787', createdAt: new Date(), username: 'driver1' },
  { id: '4', role: 'reporter', name: 'Nguyễn Văn A', email: 'reporter@example.com', phone: '0909123456', createdAt: new Date(), username: 'user_test01' },
  { id: '5', role: 'dispatcher', name: 'Dispatcher 1', email: 'dispatcher@example.com', phone: '0123456786', createdAt: new Date(), username: 'dispatcher1' },
];

const MOCK_VEHICLES: Vehicle[] = [
  { id: '1', licensePlate: '30A-12345', type: 'ambulance', status: 'available', providerId: '2' },
  { id: '2', licensePlate: '30A-67890', type: 'emergency-car', status: 'busy', providerId: '2' },
];

let MOCK_DRIVER_RESOURCE: DriverResource = {
  id: '1042',
  resourceId: '1042',
  licensePlate: '29A-115.88',
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
  lastLocationUpdate: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const MOCK_PROVIDERS = [
  { id: '2', name: 'Bệnh viện ABC', phoneNumber: '0123456788', email: 'contact@abc.com' },
  { id: '3', name: 'Đội cứu hộ XYZ', phoneNumber: '0123456789', email: 'contact@xyz.com' },
];

const MOCK_SERVICE_TYPES = [
  { id: '1', name: 'Cấp cứu cơ bản' },
  { id: '2', name: 'Cấp cứu nâng cao' },
  { id: '3', name: 'Cấp cứu tim mạch' },
];

const MOCK_OPERATION_ZONES = [
  { id: '1', name: 'Quận 1 - TP HCM' },
  { id: '2', name: 'Quận 2 - TP HCM' },
  { id: '3', name: 'Quận 3 - TP HCM' },
];

const MOCK_DISPATCH_REQUESTS = [
  { id: '1', status: 'pending', description: 'Tai nạn giao thông ở đường Lê Lợi', createdAt: new Date() },
  { id: '2', status: 'assigned', description: 'Người bị ngất ở công viên', createdAt: new Date() },
];

const MOCK_EMERGENCY_CALLS = [
  {
    id: '1',
    status: 'pending',
    description: 'Tai nạn giao thông ở đường Lê Lợi',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    latitude: 10.7626,
    longitude: 106.6602,
  },
  {
    id: '2',
    status: 'assigned',
    description: 'Người bị ngất ở công viên 30/4',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    latitude: 10.7701,
    longitude: 106.6891,
  },
  {
    id: '3',
    status: 'completed',
    description: 'Đau ngực ở nhà riêng',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    latitude: 10.7598,
    longitude: 106.6732,
  },
];

let MOCK_SIMULATIONS: AmbulanceSimulation[] = [];
const MOCK_SIMULATION_STATES: Record<string, { interval?: any; routeIndex: number; route: LatLng[] }> = {};

class ApiService {
  private isRefreshing = false;
  private refreshPromise: Promise<any> | null = null;

  // Generic fetch helper that handles the API response format
  private async request<T = any>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
    console.log('[API] Request called:', { path, options, isRetry });
    
    if (globalConfig.getUseMockData()) {
      console.log('[API] Using mock data');
      return this.mockRequest(path, options);
    }

    const baseUrl = globalConfig.getApiBaseUrl();
    const token = globalConfig.getToken();
    const url = `${baseUrl}${path}`;

    console.log('[API] Request details:', {
      url,
      method: options.method || 'GET',
      hasToken: !!token,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Thêm timeout 15s để tránh treo mãi
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      console.log('[API] Response status:', response.status);

      // --- Auto refresh token khi nhận 401 Unauthorized ---
      if (response.status === 401 && !isRetry && !path.includes('/auth/login') && !path.includes('/auth/refresh')) {
        console.log('[API] Received 401, attempting token refresh...');
        clearTimeout(timeoutId);
        return await this.refreshTokenAndRetry<T>(path, options);
      }

      const resultText = await response.text();
      console.log('[API] Response raw:', resultText.substring(0, 1000));

      let result: ApiResponse<T>;
      try {
        result = JSON.parse(resultText);
      } catch (e) {
        console.error('[API] Failed to parse JSON response:', e);
        throw new Error(`Phản hồi từ server không hợp lệ: ${resultText.substring(0, 200)}`);
      }

      console.log('[API] Response parsed success, code:', result.code);

      if (!result.success) {
        console.error('[API] Request failed (success=false):', result.message);
        // Cũng thử refresh nếu API báo lỗi về token/mã hóa
        if ((result.code === 401 || result.code === 403) && !isRetry && !path.includes('/auth/login') && !path.includes('/auth/refresh')) {
          console.log('[API] Success=false with auth error code, attempting token refresh...');
          clearTimeout(timeoutId);
          return await this.refreshTokenAndRetry<T>(path, options);
        }
        throw new Error(result.message || `Lỗi từ server (${result.code})`);
      }

      return result.data;
    } catch (error: any) {
      console.error('[API] Request error:', error?.name, error?.message);

      // Xử lý lỗi cụ thể để báo người dùng rõ ràng
      if (error?.name === 'AbortError') {
        throw new Error('Kết nối quá thời gian (15 giây). Hãy kiểm tra:\n1. Server backend đang chạy?\n2. IP máy tính đúng? (đang là ' + baseUrl + ')\n3. Tường lửa Windows cho phép cổng 8080?\n4. Điện thoại cùng mạng Wi-Fi với máy tính?');
      }
      if (error?.message === 'Network request failed' || /Failed to fetch/i.test(error?.message || '')) {
        throw new Error('Không thể kết nối đến server. Hãy kiểm tra:\n1. Server backend đang chạy ở ' + baseUrl + '?\n2. Điện thoại cùng mạng Wi-Fi với máy tính?\n3. Tường lửa chưa chặn cổng 8080?');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Refresh token queue để tránh gọi refresh đồng thời nhiều lần
  // Public helper: refresh access token if needed (queue-safe)
  public async refreshAuthTokenIfNeeded(): Promise<string> {
    const refreshToken = globalConfig.getRefreshToken();
    if (!refreshToken) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshPromise = (async () => {
        try {
          const res = await this.request<{ accessToken: string; refreshToken?: string }>('/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
          }, true);
          console.log('[API] Token refreshed successfully');
          this.isRefreshing = false;
          this.refreshPromise = null;
          if (res.refreshToken) {
            globalConfig.setRefreshToken(res.refreshToken);
          }
          return res.accessToken;
        } catch (e) {
          console.error('[API] Token refresh failed:', e);
          try {
            globalConfig.setToken(null);
            globalConfig.setRefreshToken(null);
            globalConfig.setCurrentUser(null);
          } catch {}
          this.isRefreshing = false;
          this.refreshPromise = null;
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
      })();
    }

    return await this.refreshPromise as Promise<string>;
  }

  private async refreshTokenAndRetry<T>(path: string, options: RequestInit): Promise<T> {
    await this.refreshAuthTokenIfNeeded();
    // Sau khi refresh xong, gọi lại request gốc một lần nữa
    return this.request<T>(path, options, true);
  }

  // Mock request handler
  private async mockRequest<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

    // Auth endpoints
    if (path === '/auth/login') {
      const { username, password } = JSON.parse(options.body as string);
      // Find user by username or default to admin
      let mockUser = MOCK_USERS.find(u => u.username.toLowerCase().includes(username.toLowerCase())) || MOCK_USERS[0];
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

    // User endpoints
    if (path === '/users') return MOCK_USERS as T;
    if (path === '/users/me') {
      const currentUser = globalConfig.getCurrentUser();
      return (currentUser || MOCK_USERS[0]) as T;
    }
    if (path.startsWith('/users/')) return MOCK_USERS[0] as T;

    // Provider endpoints
    if (path === '/providers') return MOCK_PROVIDERS as T;
    if (path.startsWith('/providers/')) return MOCK_PROVIDERS[0] as T;

    // Dispatch resources (vehicles)
    if (path === '/dispatch-resources') return MOCK_VEHICLES as T;
    if (path.startsWith('/dispatch-resources/')) return MOCK_VEHICLES[0] as T;

    // Service types
    if (path === '/service-types') return MOCK_SERVICE_TYPES as T;

    // Operation zones
    if (path === '/operation-zones') return MOCK_OPERATION_ZONES as T;

    // Dispatch requests
    if (path === '/dispatch-requests') return MOCK_DISPATCH_REQUESTS as T;

    // Emergency calls
    if (path === '/calls/sos' || path === '/calls/voice' || path === '/calls/callback') {
      const body = JSON.parse(options.body as string);
      const newCall = {
        id: (MOCK_EMERGENCY_CALLS.length + 1).toString(),
        status: 'pending',
        description: body.description,
        createdAt: new Date().toISOString(),
        latitude: body.location?.latitude ?? body.latitude,
        longitude: body.location?.longitude ?? body.longitude,
        audioObjectKey: body.audioObjectKey,
      };
      MOCK_EMERGENCY_CALLS.unshift(newCall);
      return newCall as T;
    }
    if (path === '/calls/my-calls') return MOCK_EMERGENCY_CALLS as T;
    // GET /calls/{id}
    if (/^\/calls\/[^/]+$/.test(path) && (!options.method || options.method === 'GET')) {
      const id = path.split('/')[2];
      const call = MOCK_EMERGENCY_CALLS.find(c => c.id === id);
      if (call) return call as T;
      throw new Error('Call not found');
    }
    // GET /calls/{id}/tracking - reporter tracking endpoint
    if (/^\/calls\/[^/]+\/tracking$/.test(path)) {
      const callId = path.split('/')[2];
      // Simulate a tracking update for the call
      const call = MOCK_EMERGENCY_CALLS.find(c => c.id === callId) || MOCK_EMERGENCY_CALLS[0];
      const startLat = (call?.latitude as number || 21.028511) + 0.008;
      const startLng = (call?.longitude as number || 105.804817) + 0.006;
      const endLat = call?.latitude as number || 21.028511;
      const endLng = call?.longitude as number || 105.804817;
      const now = Date.now();
      const t = Math.min(1, ((now % 120000) / 120000)); // 2-minute cycle
      const currentLat = startLat + (endLat - startLat) * t;
      const currentLng = startLng + (endLng - startLng) * t;
      const totalTimeSec = 480;
      const eta = Math.max(0, Math.floor(totalTimeSec * (1 - t)));
      const progress = t * 100;
      const distanceTraveled = t * 1.2;

      const status = t < 0.02 ? 'CREATED' : t < 0.98 ? 'RUNNING' : 'COMPLETED';

      return {
        simulationId: null,
        missionId: callId,
        currentLocation: { lat: currentLat, lng: currentLng },
        speed: status === 'RUNNING' ? 35 + Math.random() * 20 : 0,
        heading: 0,
        progress,
        estimatedTimeArrival: eta,
        distanceTraveled,
        timestamp: new Date().toISOString(),
        status,
      } as T;
    }

    // --- DISPATCH MISSION (driver) MOCK ENDPOINTS ---
    // GET /dispatch-missions/me/active - Lấy mission active của driver hiện tại
    if (path === '/dispatch-missions/me/active') {
      // Giả lập: có 1 mission demo đang chờ
      return {
        id: `DM-${Date.now() % 100000}`,
        status: 'ASSIGNED',
        priority: 'HIGH',
        victim: {
          name: 'Nguyễn Văn A',
          phone: '0987654321',
          address: '12 Chùa Bộc, Đống Đa, Hà Nội',
          latitude: 21.0091,
          longitude: 105.8247,
        },
        injury: 'Tai nạn giao thông - Chấn thương chân',
        reporterName: 'Trần Thị B',
        reportedAt: new Date(Date.now() - 120000).toISOString(),
        estimatedDistanceKm: 1.2,
        estimatedEtaMin: 4,
      } as T;
    }
    // GET /dispatch-missions/{missionId}/tracking - Lấy tracking cho mission
    if (/^\/dispatch-missions\/[^/]+\/tracking$/.test(path)) {
      const missionId = path.split('/')[3];
      // Use same simulated movement as calls
      const startLat = 21.0091 + 0.008;
      const startLng = 105.8247 + 0.006;
      const endLat = 21.0091;
      const endLng = 105.8247;
      const now = Date.now();
      const t = Math.min(1, ((now % 120000) / 120000));
      const currentLat = startLat + (endLat - startLat) * t;
      const currentLng = startLng + (endLng - startLng) * t;
      const totalTimeSec = 480;
      const eta = Math.max(0, Math.floor(totalTimeSec * (1 - t)));
      const progress = t * 100;
      const distanceTraveled = t * 1.2;

      const status = t < 0.02 ? 'CREATED' : t < 0.98 ? 'RUNNING' : 'COMPLETED';

      return {
        simulationId: null,
        missionId,
        currentLocation: { lat: currentLat, lng: currentLng },
        speed: status === 'RUNNING' ? 35 + Math.random() * 20 : 0,
        heading: 0,
        progress,
        estimatedTimeArrival: eta,
        distanceTraveled,
        timestamp: new Date().toISOString(),
        status,
      } as T;
    }

    // --- DRIVER RESOURCE (DRIVER API) MOCK ENDPOINTS ---
    // GET /driver-resource - Xem chi tiết xe cứu thương hiện tại
    if (path === '/driver-resource' && (!options.method || options.method === 'GET')) {
      return MOCK_DRIVER_RESOURCE as T;
    }

    // PATCH /driver-resource/{id}/location - Cập nhật vị trí xe cứu thương
    if (/^\/driver-resource\/[^/]+\/location$/.test(path) && options.method === 'PATCH') {
      const id = path.split('/')[2];
      const body = JSON.parse(options.body as string || '{}');
      const newLat = body.latitude ?? body.lat ?? MOCK_DRIVER_RESOURCE.latitude;
      const newLng = body.longitude ?? body.lng ?? MOCK_DRIVER_RESOURCE.longitude;
      MOCK_DRIVER_RESOURCE = {
        ...MOCK_DRIVER_RESOURCE,
        id,
        latitude: Number(newLat),
        longitude: Number(newLng),
        speed: typeof body.speed === 'number' ? body.speed : MOCK_DRIVER_RESOURCE.speed,
        heading: typeof body.heading === 'number' ? body.heading : MOCK_DRIVER_RESOURCE.heading,
        lastLocationUpdate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return {
        code: 200,
        success: true,
        message: 'Cập nhật vị trí xe cứu thương thành công',
        data: MOCK_DRIVER_RESOURCE,
      } as T;
    }

    // PATCH /driver-resource/{id}/status - Cập nhật trạng thái xe cứu thương
    if (/^\/driver-resource\/[^/]+\/status$/.test(path) && options.method === 'PATCH') {
      const id = path.split('/')[2];
      const body = JSON.parse(options.body as string || '{}');
      MOCK_DRIVER_RESOURCE = {
        ...MOCK_DRIVER_RESOURCE,
        id,
        status: body.status || MOCK_DRIVER_RESOURCE.status,
        updatedAt: new Date().toISOString(),
      };
      return {
        code: 200,
        success: true,
        message: 'Cập nhật trạng thái xe cứu thương thành công',
        data: MOCK_DRIVER_RESOURCE,
      } as T;
    }

    // --- AMBULANCE SIMULATION MOCK ENDPOINTS ---
    // POST /ambulance-simulations - create
    if (path === '/ambulance-simulations' && options.method === 'POST') {
      const body = JSON.parse(options.body as string);
      const simId = `sim_${Date.now()}`;
      const start: LatLng = body.startLocation || { lat: body.startLat, lng: body.startLng };
      const end: LatLng = body.endLocation || { lat: body.endLat, lng: body.endLng };
      // Build a simple straight-line route (8 interpolated points)
      const route: LatLng[] = [];
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        route.push({
          lat: start.lat + (end.lat - start.lat) * t,
          lng: start.lng + (end.lng - start.lng) * t,
        });
      }
      const newSim: AmbulanceSimulation = {
        id: simId,
        missionId: body.missionId,
        dispatchMissionId: body.dispatchMissionId,
        vehicleId: body.vehicleId,
        driverId: body.driverId,
        startLocation: start,
        endLocation: end,
        currentLocation: { ...start },
        route,
        routeIndex: 0,
        status: 'CREATED',
        progress: 0,
        estimatedTimeArrival: 480,
        distanceTraveled: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      MOCK_SIMULATIONS.push(newSim);
      MOCK_SIMULATION_STATES[simId] = { routeIndex: 0, route };
      return newSim as T;
    }

    // GET /ambulance-simulations/{id}
    if (/^\/ambulance-simulations\/[^/]+$/.test(path) && (!options.method || options.method === 'GET')) {
      const id = path.split('/')[2];
      const sim = MOCK_SIMULATIONS.find(s => s.id === id);
      if (sim) return sim as T;
      throw new Error('Simulation not found');
    }

    // POST /ambulance-simulations/{id}/start
    if (/^\/ambulance-simulations\/[^/]+\/start$/.test(path) && options.method === 'POST') {
      const id = path.split('/')[2];
      const sim = MOCK_SIMULATIONS.find(s => s.id === id);
      if (!sim) throw new Error('Simulation not found');
      sim.status = 'RUNNING';
      sim.startedAt = new Date().toISOString();
      // Kick off internal simulation ticker
      const state = MOCK_SIMULATION_STATES[id];
      if (state && !state.interval) {
        state.interval = setInterval(() => {
          const currentSim = MOCK_SIMULATIONS.find(s => s.id === id);
          if (!currentSim || currentSim.status !== 'RUNNING') return;
          state.routeIndex = Math.min(state.routeIndex + 1, state.route.length - 1);
          const loc = state.route[state.routeIndex];
          currentSim.currentLocation = { ...loc };
          currentSim.routeIndex = state.routeIndex;
          currentSim.progress = (state.routeIndex / (state.route.length - 1)) * 100;
          currentSim.estimatedTimeArrival = Math.max(0, 480 - state.routeIndex * 48);
          currentSim.distanceTraveled = state.routeIndex * 0.15;
          currentSim.updatedAt = new Date().toISOString();
          if (state.routeIndex >= state.route.length - 1) {
            currentSim.status = 'COMPLETED';
            currentSim.completedAt = new Date().toISOString();
            clearInterval(state.interval);
            state.interval = undefined;
          }
        }, 1200);
      }
      return sim as T;
    }

    // POST /ambulance-simulations/{id}/stop
    if (/^\/ambulance-simulations\/[^/]+\/stop$/.test(path) && options.method === 'POST') {
      const id = path.split('/')[2];
      const sim = MOCK_SIMULATIONS.find(s => s.id === id);
      if (!sim) throw new Error('Simulation not found');
      sim.status = 'STOPPED';
      const state = MOCK_SIMULATION_STATES[id];
      if (state?.interval) {
        clearInterval(state.interval);
        state.interval = undefined;
      }
      return sim as T;
    }

    // GET /ambulance-simulations/{id}/tracking
    if (/^\/ambulance-simulations\/[^/]+\/tracking$/.test(path)) {
      const id = path.split('/')[2];
      const sim = MOCK_SIMULATIONS.find(s => s.id === id);
      if (!sim) throw new Error('Simulation not found');
      const update: TrackingUpdate = {
        simulationId: sim.id,
        missionId: sim.missionId,
        currentLocation: { ...sim.currentLocation },
        speed: sim.status === 'RUNNING' ? 45 : 0,
        heading: 0,
        progress: sim.progress || 0,
        estimatedTimeArrival: sim.estimatedTimeArrival,
        distanceTraveled: sim.distanceTraveled || 0,
        timestamp: new Date().toISOString(),
        status: sim.status,
      };
      return update as T;
    }

    // GET /ambulance-simulations/by-mission/{missionId}/tracking
    if (/^\/ambulance-simulations\/by-mission\/[^/]+\/tracking$/.test(path)) {
      const missionId = path.split('/')[3];
      const sim = MOCK_SIMULATIONS.find(s => s.missionId === missionId || s.dispatchMissionId === missionId);
      if (!sim) {
        // Return a default "not started yet" tracking state so UI doesn't crash
        return {
          simulationId: null,
          missionId,
          currentLocation: { lat: 0, lng: 0 },
          speed: 0,
          progress: 0,
          estimatedTimeArrival: 0,
          distanceTraveled: 0,
          timestamp: new Date().toISOString(),
          status: 'CREATED',
        } as T;
      }
      const update: TrackingUpdate = {
        simulationId: sim.id,
        missionId: sim.missionId,
        currentLocation: { ...sim.currentLocation },
        speed: sim.status === 'RUNNING' ? 45 : 0,
        heading: 0,
        progress: sim.progress || 0,
        estimatedTimeArrival: sim.estimatedTimeArrival,
        distanceTraveled: sim.distanceTraveled || 0,
        timestamp: new Date().toISOString(),
        status: sim.status,
      };
      return update as T;
    }

    return {} as T;
  }

  // --- 1. AUTHENTICATION ---
  
  async login(username: string, password: string) {
    const data = await this.request<{
      accessToken: string;
      refreshToken: string;
      tokenType: string;
      expiresIn: number;
      userId: number;
      username: string;
      fullName: string;
      roles: string[];
      phoneNumber?: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    globalConfig.setToken(data.accessToken);
    globalConfig.setRefreshToken(data.refreshToken);
    globalConfig.setCurrentUser(data);
    return data;
  }

  async register(data: {
    username: string;
    password: string;
    fullName: string;
    phoneNumber: string;
    email?: string;
    otpCode: string;
  }) {
    return await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async sendOtp(phoneNumber: string) {
    return await this.request('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber }),
    });
  }

  async verifyOtp(phoneNumber: string, otpCode: string) {
    return await this.request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, otpCode }),
    });
  }

  async resetPassword(phoneNumber: string, otpCode: string, newPassword: string) {
    return await this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, otpCode, newPassword }),
    });
  }

  async forgotPassword(phoneNumber: string) {
    return await this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber }),
    });
  }

  async changePassword(oldPassword: string, newPassword: string) {
    return await this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    });
  }

  async refreshToken(refreshToken: string) {
    const res = await this.request<{ accessToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    globalConfig.setToken(res.accessToken);
    return res;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      globalConfig.setToken(null);
      globalConfig.setRefreshToken(null);
      globalConfig.setCurrentUser(null);
    }
  }

  // --- 2. DISPATCH RESOURCES (AMBULANCES) ---

  async getDispatchResources(): Promise<Vehicle[]> {
    return await this.request('/dispatch-resources');
  }

  async getDispatchResource(id: string): Promise<Vehicle> {
    return await this.request(`/dispatch-resources/${id}`);
  }

  async createDispatchResource(data: Partial<Vehicle>) {
    return await this.request('/dispatch-resources', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDispatchResource(id: string, data: Partial<Vehicle>) {
    return await this.request(`/dispatch-resources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDispatchResource(id: string) {
    await this.request(`/dispatch-resources/${id}`, { method: 'DELETE' });
    return { success: true };
  }

  async patchResourceStatus(id: string, status: Vehicle['status']) {
    return await this.request(`/dispatch-resources/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // --- 3. FILE STORAGE ---

  async uploadFile(formData: FormData, timeoutMs = 60000): Promise<any> {
    const baseUrl = globalConfig.getApiBaseUrl();
    const token = globalConfig.getToken();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/files/upload`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (response.status === 401) {
        clearTimeout(timeoutId);
        // Thử refresh token và retry 1 lần
        try {
          await this.refreshAuthTokenIfNeeded();
          return this.uploadFile(formData, timeoutMs);
        } catch {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
      }

      const result: ApiResponse = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Upload failed');
      }
      return result.data;
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error('Upload file quá thời gian (' + Math.floor(timeoutMs / 1000) + 's). Hãy kiểm tra đường truyền.');
      }
      if (error?.message === 'Network request failed' || /Failed to fetch/i.test(error?.message || '')) {
        throw new Error('Không thể kết nối đến server khi upload. Kiểm tra mạng & backend.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async listFiles() {
    return await this.request('/files');
  }

  async getFileMetadata(objectKey: string) {
    return await this.request(`/files/metadata/${encodeURIComponent(objectKey)}`);
  }

  async downloadFile(objectKey: string) {
    return await this.request(`/files/download/${encodeURIComponent(objectKey)}`);
  }

  async deleteFile(objectKey: string) {
    await this.request(`/files/admin/${encodeURIComponent(objectKey)}`, { method: 'DELETE' });
    return { success: true };
  }

  // --- 4. DISPATCH MISSION ---

  async createDispatchMission(data: any) {
    return await this.request('/dispatch-missions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --- 5. EMERGENCY CALL ---

  async createVoiceCall(data: any) {
    return await this.request('/calls/voice', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createSosCall(data: any) {
    return await this.request('/calls/sos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCallDetail(id: string) {
    return await this.request(`/calls/${id}`);
  }

  async getCallTracking(callId: string): Promise<TrackingUpdate> {
    return await this.request(`/calls/${callId}/tracking`);
  }

  async getMyCalls() {
    return await this.request('/calls/my-calls');
  }

  async postCallback(data: any) {
    return await this.request('/calls/callback', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --- 5b. HELPERS: ghi âm + upload MinIO + tạo cuộc gọi voice (flow đúng) ---
  // Lưu ý: KHÔNG set Content-Type: multipart/form-data thủ công → fetch tự thêm boundary
  async uploadRecording(audioUri: string, idempotencyKey?: string): Promise<{ objectKey: string; contentType: string; size: number }> {
    if (!audioUri) {
      throw new Error('Chưa có file ghi âm để upload');
    }

    const formData = new FormData();
    const extMatch = audioUri.toLowerCase().match(/\.([a-z0-9]+)(\?|$)/);
    const ext = extMatch ? extMatch[1] : 'm4a';
    const contentType = ext === 'webm' ? 'audio/webm' : ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4';

    formData.append('file', {
      uri: audioUri,
      name: `emergency-${Date.now()}.${ext}`,
      type: contentType,
    } as any);

    if (idempotencyKey) {
      // Dùng để backend nhận biết request trùng (không upload trùng file)
      formData.append('idempotencyKey', idempotencyKey);
    }

    const result = await this.uploadFile(formData, 120000);
    if (!result || !(result as any).objectKey) {
      throw new Error('Backend không trả về objectKey sau khi upload');
    }
    return result as any;
  }

  // Flow đúng: Ghi âm → upload MinIO → POST /calls/voice
  async submitVoiceEmergencyCall(params: {
    audioUri: string;
    latitude: number;
    longitude: number;
    description?: string;
    idempotencyKey?: string;
  }) {
    const { audioUri, latitude, longitude, description, idempotencyKey } = params;

    // Bước 1: upload file ghi âm lên MinIO
    const uploaded = await this.uploadRecording(audioUri, idempotencyKey);

    // Bước 2: tạo EmergencyCall. Backend lấy phoneNumber + reporterName từ JWT.
    return await this.createVoiceCall({
      audioObjectKey: uploaded.objectKey,
      location: { latitude, longitude },
      description: description?.trim() || undefined,
    });
  }

  // --- 6. DISPATCH REQUESTS ---

  async getDispatchRequests() {
    return await this.request('/dispatch-requests');
  }

  async getDispatchRequest(id: string) {
    return await this.request(`/dispatch-requests/${id}`);
  }

  // --- 7. OPERATION ZONES ---

  async getOperationZones() {
    return await this.request('/operation-zones');
  }

  async getOperationZone(id: string) {
    return await this.request(`/operation-zones/${id}`);
  }

  async createOperationZone(data: any) {
    return await this.request('/operation-zones', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateOperationZone(id: string, data: any) {
    return await this.request(`/operation-zones/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteOperationZone(id: string) {
    await this.request(`/operation-zones/${id}`, { method: 'DELETE' });
    return { success: true };
  }

  // --- 8. SERVICE TYPES ---

  async getServiceTypes() {
    return await this.request('/service-types');
  }

  async getServiceType(id: string) {
    return await this.request(`/service-types/${id}`);
  }

  async createServiceType(data: any) {
    return await this.request('/service-types', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateServiceType(id: string, data: any) {
    return await this.request(`/service-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteServiceType(id: string) {
    await this.request(`/service-types/${id}`, { method: 'DELETE' });
    return { success: true };
  }

  // --- 9. USERS ---

  async getUsers() {
    return await this.request('/users');
  }

  async getUser(id: string) {
    return await this.request(`/users/${id}`);
  }

  async createUser(data: any) {
    return await this.request('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: string, data: any) {
    return await this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id: string) {
    await this.request(`/users/${id}`, { method: 'DELETE' });
    return { success: true };
  }

  async getCurrentUser() {
    return await this.request<User>('/users/me');
  }

  // --- 10. PROVIDERS ---

  async getProviders() {
    return await this.request('/providers');
  }

  async getProvider(id: string) {
    return await this.request(`/providers/${id}`);
  }

  async createProvider(data: any) {
    return await this.request('/providers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProvider(id: string, data: any) {
    return await this.request(`/providers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProvider(id: string) {
    await this.request(`/providers/${id}`, { method: 'DELETE' });
    return { success: true };
  }

  // --- 11. AMBULANCE SIMULATION ---

  async createAmbulanceSimulation(data: {
    missionId?: string;
    dispatchMissionId?: string;
    vehicleId?: string;
    driverId?: string;
    startLocation: LatLng;
    endLocation: LatLng;
  }): Promise<AmbulanceSimulation> {
    return await this.request('/ambulance-simulations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAmbulanceSimulation(id: string): Promise<AmbulanceSimulation> {
    return await this.request(`/ambulance-simulations/${id}`);
  }

  async startAmbulanceSimulation(id: string): Promise<AmbulanceSimulation> {
    return await this.request(`/ambulance-simulations/${id}/start`, {
      method: 'POST',
    });
  }

  async stopAmbulanceSimulation(id: string): Promise<AmbulanceSimulation> {
    return await this.request(`/ambulance-simulations/${id}/stop`, {
      method: 'POST',
    });
  }

  async getSimulationTracking(id: string): Promise<TrackingUpdate> {
    return await this.request(`/ambulance-simulations/${id}/tracking`);
  }

  async getSimulationTrackingByMission(missionId: string): Promise<TrackingUpdate> {
    return await this.request(`/ambulance-simulations/by-mission/${missionId}/tracking`);
  }

  // --- 12. DRIVER RESOURCE (DRIVER API) ---

  /**
   * GET /driver-resource: Xem chi tiết xe cứu thương hiện tại của tài xế
   */
  async getDriverResource(): Promise<DriverResource> {
    return await this.request<DriverResource>('/driver-resource');
  }

  /**
   * PATCH /driver-resource/{id}/location: Cập nhật vị trí xe cứu thương (PostGIS GPS)
   */
  async updateDriverResourceLocation(
    id: string | number,
    data: DriverLocationUpdatePayload | { latitude: number; longitude: number; speed?: number; heading?: number; accuracy?: number; address?: string }
  ): Promise<any> {
    return await this.request(`/driver-resource/${id}/location`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * PATCH /driver-resource/{id}/status: Cập nhật trạng thái trực của xe cứu thương
   */
  async updateDriverResourceStatus(
    id: string | number,
    status: string
  ): Promise<any> {
    return await this.request(`/driver-resource/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }
}

export const api = new ApiService();
