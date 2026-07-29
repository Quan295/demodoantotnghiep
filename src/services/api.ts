import { User, Vehicle } from '@/types';
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
];

const MOCK_VEHICLES: Vehicle[] = [
  { id: '1', licensePlate: '30A-12345', type: 'ambulance', status: 'available', providerId: '2' },
  { id: '2', licensePlate: '30A-67890', type: 'emergency-car', status: 'busy', providerId: '2' },
];

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

class ApiService {
  
  // Generic fetch helper that handles the API response format
  private async request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    console.log('[API] Request called:', { path, options });
    
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
      body: options.body,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log('[API] Request headers:', headers);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      console.log('[API] Response status:', response.status);

      const resultText = await response.text();
      console.log('[API] Response raw:', resultText);

      let result: ApiResponse<T>;
      try {
        result = JSON.parse(resultText);
      } catch (e) {
        console.error('[API] Failed to parse JSON response:', e);
        throw new Error(`Failed to parse response: ${resultText}`);
      }

      console.log('[API] Response parsed:', result);

      if (!result.success) {
        console.error('[API] Request failed:', result.message);
        throw new Error(result.message || `API_ERROR_${response.status}`);
      }

      return result.data;
    } catch (error) {
      console.error('[API] Request error:', error);
      throw error;
    }
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
        latitude: body.latitude,
        longitude: body.longitude,
      };
      MOCK_EMERGENCY_CALLS.unshift(newCall);
      return newCall as T;
    }
    if (path === '/calls/my-calls') return MOCK_EMERGENCY_CALLS as T;
    if (path.startsWith('/calls/')) {
      const id = path.split('/')[2];
      const call = MOCK_EMERGENCY_CALLS.find(c => c.id === id);
      if (call) return call as T;
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

  async uploadFile(formData: FormData) {
    const baseUrl = globalConfig.getApiBaseUrl();
    const token = globalConfig.getToken();
    
    const response = await fetch(`${baseUrl}/files/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    
    const result: ApiResponse = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Upload failed');
    }
    
    return result.data;
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

  async getMyCalls() {
    return await this.request('/calls/my-calls');
  }

  async postCallback(data: any) {
    return await this.request('/calls/callback', {
      method: 'POST',
      body: JSON.stringify(data),
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
}

export const api = new ApiService();
