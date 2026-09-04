import {
  AmbulanceSimulation,
  CallStatusResponse,
  CallTrackingResponse,
  DispatchMission,
  DriverLocationUpdatePayload,
  DriverResource,
  EmergencyCall,
  LatLng,
  TrackingUpdate,
  User,
  Vehicle,
  PaymentDetailResponse,
  PayPaymentRequest,
  DriverEarningResponse,
  DriverEarningDetailResponse,
  DriverEarningSummaryResponse,
} from '@/types';
import { globalConfig } from './config';
import { handleMockRequest } from './mockApi';

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

class ApiService {
  private isRefreshing = false;
  private refreshPromise: Promise<any> | null = null;

  // Generic fetch helper that handles the API response format
  private async request<T = any>(
    path: string,
    options: RequestInit & { silent?: boolean } = {},
    isRetry = false
  ): Promise<T> {
    console.log('[API] Request called:', { path, options, isRetry });
    
    if (globalConfig.getUseMockData()) {
      console.log('[API] Using mock data from mockApi');
      return handleMockRequest<T>(path, options);
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
        if (!options.silent) {
          console.warn('[API] Failed to parse JSON response:', e);
        }
        throw new Error(`Phản hồi từ server không hợp lệ: ${resultText.substring(0, 200)}`);
      }

      console.log('[API] Response parsed success, code:', result.code);

      if (!result.success) {
        if (!options.silent) {
          console.warn('[API] Request failed (success=false):', result.message);
        }
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
      if (!options.silent) {
        console.warn('[API] Request error:', error?.name, error?.message);
      }

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

  // --- 1. AUTHENTICATION ---
  
  async login(username: string, password: string) {
    const trimmedUser = username.trim();
    const data = await this.request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ 
        username: trimmedUser,
        password: password,
        identity: trimmedUser,
        phoneNumber: trimmedUser,
        phone: trimmedUser,
        email: trimmedUser,
        account: trimmedUser,
      }),
    });

    const token = data?.accessToken || data?.token || data?.jwt || data?.access_token || '';
    const refreshToken = data?.refreshToken || data?.refresh_token || '';
    if (token) {
      globalConfig.setToken(token);
    }
    if (refreshToken) {
      globalConfig.setRefreshToken(refreshToken);
    }
    globalConfig.setCurrentUser(data);
    return data;
  }

  async register(data: {
    username: string;
    password: string;
    fullName: string;
    phoneNumber: string;
    email?: string;
    otpCode?: string;
    verificationToken?: string;
    phoneVerificationToken?: string;
  }) {
    const token = data.verificationToken || data.phoneVerificationToken || data.otpCode || '';
    return await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: data.username,
        password: data.password,
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
        phone: data.phoneNumber,
        email: data.email,
        otpCode: data.otpCode,
        verificationToken: token,
        phoneVerificationToken: token,
        otpVerificationToken: token,
      }),
    });
  }

  async sendOtp(phoneNumber: string) {
    return await this.request<{ data?: string; message?: string }>('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ 
        phoneNumber,
        identity: phoneNumber,
        phone: phoneNumber,
      }),
    });
  }

  async verifyOtp(phoneNumber: string, otpCode: string) {
    return await this.request<{ data?: any; verificationToken?: string; token?: string; phoneVerificationToken?: string }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ 
        phoneNumber,
        identity: phoneNumber,
        otpCode,
        code: otpCode,
      }),
    });
  }

  async resetPassword(identity: string, otpCode: string, newPassword: string) {
    return await this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ 
        identity,
        phoneNumber: identity,
        email: identity,
        username: identity,
        otpCode, 
        newPassword 
      }),
    });
  }

  async forgotPassword(identity: string) {
    return await this.request<{ data?: string; message?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ 
        identity,
        phoneNumber: identity,
        email: identity,
        username: identity,
      }),
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
      const refreshToken = globalConfig.getRefreshToken() || '';
      if (refreshToken) {
        await this.request('/auth/logout', { 
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch (e) {
      console.warn('[API] Logout request warning (ignored):', e);
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

  // --- 4. DRIVER - MISSION (DRIVER MISSION API) ---

  /**
   * POST /dispatch-missions/{id}/accept: Chấp nhận nhiệm vụ
   */
  async acceptMission(id: string | number): Promise<DispatchMission> {
    return await this.request<DispatchMission>(`/dispatch-missions/${id}/accept`, {
      method: 'POST',
    });
  }

  /**
   * POST /dispatch-missions/{id}/reject: Từ chối nhiệm vụ
   */
  async rejectMission(id: string | number, reason?: string): Promise<any> {
    return await this.request(`/dispatch-missions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify(reason ? { reason } : {}),
    });
  }

  /**
   * POST /dispatch-missions/{id}/start: Bắt đầu di chuyển đến hiện trường
   */
  async startMission(id: string | number): Promise<DispatchMission> {
    return await this.request<DispatchMission>(`/dispatch-missions/${id}/start`, {
      method: 'POST',
    });
  }

  /**
   * POST /dispatch-missions/{id}/arrive-scene: Xác nhận đã đến hiện trường
   */
  async arriveScene(id: string | number): Promise<DispatchMission> {
    return await this.request<DispatchMission>(`/dispatch-missions/${id}/arrive-scene`, {
      method: 'POST',
    });
  }

  /**
   * POST /dispatch-missions/{id}/start-transport: Bắt đầu vận chuyển bệnh nhân
   */
  async startTransport(id: string | number): Promise<DispatchMission> {
    return await this.request<DispatchMission>(`/dispatch-missions/${id}/start-transport`, {
      method: 'POST',
    });
  }

  /**
   * POST /dispatch-missions/{id}/arrive-hospital: Xác nhận đã đến bệnh viện
   */
  async arriveHospital(id: string | number): Promise<DispatchMission> {
    return await this.request<DispatchMission>(`/dispatch-missions/${id}/arrive-hospital`, {
      method: 'POST',
    });
  }

  /**
   * POST /dispatch-missions/{id}/complete: Hoàn thành nhiệm vụ
   */
  async completeMission(id: string | number, notes?: string): Promise<DispatchMission> {
    return await this.request<DispatchMission>(`/dispatch-missions/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify(notes ? { notes } : {}),
    });
  }

  /**
   * GET /dispatch-missions/me: Lịch sử nhiệm vụ của tài xế đang đăng nhập
   */
  async getMyMissions(): Promise<DispatchMission[]> {
    return await this.request<DispatchMission[]>('/dispatch-missions/me');
  }

  /**
   * GET /dispatch-missions/me/{missionId}: Chi tiết nhiệm vụ của tài xế
   */
  async getMyMission(missionId: string | number): Promise<DispatchMission> {
    return await this.request<DispatchMission>(`/dispatch-missions/me/${missionId}`);
  }

  /**
   * GET /dispatch-missions/me/active: Các nhiệm vụ đang hoạt động của tài xế
   */
  async getMyActiveMissions(): Promise<DispatchMission[]> {
    const res = await this.request<DispatchMission[] | DispatchMission>('/dispatch-missions/me/active');
    if (!res) return [];
    if (Array.isArray(res)) return res;
    return [res];
  }

  async createDispatchMission(data: any) {
    return await this.request('/dispatch-missions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --- 5. EMERGENCY CALL (REPORTER EMERGENCY CALL API) ---

  /**
   * POST /calls/voice: Gọi cấp cứu bằng giọng nói
   */
  async createVoiceCall(data: any, idempotencyKey?: string): Promise<EmergencyCall> {
    return await this.request<EmergencyCall>('/calls/voice', {
      method: 'POST',
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify(data),
    });
  }

  /**
   * POST /calls/sos: Gửi định vị cấp cứu 1-chạm
   */
  async createSosCall(data: any, idempotencyKey?: string): Promise<EmergencyCall> {
    return await this.request<EmergencyCall>('/calls/sos', {
      method: 'POST',
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify(data),
    });
  }

  /**
   * GET /calls/{id}: Lấy chi tiết cuộc gọi cấp cứu
   */
  async getCallDetails(id: string | number): Promise<EmergencyCall> {
    return await this.request<EmergencyCall>(`/calls/${id}`);
  }

  async getCallDetail(id: string | number): Promise<EmergencyCall> {
    return await this.getCallDetails(id);
  }

  /**
   * GET /calls/{id}/tracking: Theo dõi yêu cầu và xe cấp cứu của tôi
   */
  async getCallTracking(callId: string | number): Promise<CallTrackingResponse> {
    return await this.request<CallTrackingResponse>(`/calls/${callId}/tracking`);
  }

  /**
   * GET /calls/{id}/status: Trạng thái xử lý yêu cầu của tôi
   */
  async getCallStatus(callId: string | number): Promise<CallStatusResponse> {
    return await this.request<CallStatusResponse>(`/calls/${callId}/status`);
  }

  /**
   * GET /calls/my-calls: Lấy danh sách cuộc gọi của tôi
   */
  async getMyCalls(): Promise<EmergencyCall[]> {
    return await this.request<EmergencyCall[]>('/calls/my-calls');
  }

  /**
   * GET /calls/me: Lịch sử yêu cầu cấp cứu đã gửi
   */
  async getMyEmergencyCalls(): Promise<EmergencyCall[]> {
    return await this.request<EmergencyCall[]>('/calls/me');
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
    return await this.createVoiceCall(
      {
        audioObjectKey: uploaded.objectKey,
        location: { latitude, longitude },
        description: description?.trim() || undefined,
      },
      idempotencyKey
    );
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
   * PATCH /driver-resource/location: Cập nhật vị trí xe cứu thương của tài xế hiện tại (PostGIS GPS)
   */
  async updateDriverResourceLocation(
    data: DriverLocationUpdatePayload | { latitude: number; longitude: number; speed?: number; heading?: number; accuracy?: number; address?: string }
  ): Promise<any> {
    return await this.request('/driver-resource/location', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * PATCH /driver-resource/status: Cập nhật trạng thái trực của xe cứu thương
   */
  async updateDriverResourceStatus(
    status: string
  ): Promise<any> {
    return await this.request('/driver-resource/status', {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // --- 13. REPORTER PAYMENT (USER BILLING & PAYMENTS) ---

  /**
   * GET /reporter/payments: Danh sách chi phí các ca cấp cứu của tôi (User / Reporter)
   */
  async getMyReporterPayments(): Promise<PaymentDetailResponse[]> {
    return await this.request<PaymentDetailResponse[]>('/reporter/payments');
  }

  /**
   * GET /reporter/payments/{id}: Chi tiết chi phí theo paymentId
   */
  async getReporterPaymentById(id: number | string): Promise<PaymentDetailResponse> {
    return await this.request<PaymentDetailResponse>(`/reporter/payments/${id}`);
  }

  /**
   * GET /reporter/payments/by-call/{callId}: Chi tiết chi phí theo callId (Dùng cho Mobile Reporter)
   * Trả về null an toàn nếu ca cấp cứu chưa kết thúc hoặc chưa có hóa đơn thanh toán
   */
  async getReporterPaymentByCallId(callId: number | string): Promise<PaymentDetailResponse | null> {
    try {
      return await this.request<PaymentDetailResponse>(`/reporter/payments/by-call/${callId}`, {
        silent: true,
      });
    } catch (err: any) {
      // Khi ca cấp cứu chưa hoàn thành, backend báo: "Chưa có giao dịch thanh toán cho cuộc gọi id: X"
      // Trả về null an toàn mà không làm đỏ màn hình app
      return null;
    }
  }

  /**
   * POST /reporter/payments/{id}/pay: Xác nhận thanh toán điện tử (VIETQR / VNPAY / MOMO)
   */
  async payReporterPayment(id: number | string, data: PayPaymentRequest): Promise<PaymentDetailResponse> {
    return await this.request<PaymentDetailResponse>(`/reporter/payments/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --- 8. DRIVER EARNING APIS (/api/v1/driver/earnings) ---

  /**
   * GET /driver/earnings: Danh sách thu nhập theo từng nhiệm vụ
   */
  async getMyEarnings(): Promise<DriverEarningResponse[]> {
    return await this.request<DriverEarningResponse[]>('/driver/earnings');
  }

  /**
   * GET /driver/earnings/summary: Tổng hợp thu nhập dự kiến & đã nhận
   */
  async getMyEarningSummary(): Promise<DriverEarningSummaryResponse> {
    return await this.request<DriverEarningSummaryResponse>('/driver/earnings/summary');
  }

  /**
   * GET /driver/earnings/{missionId}: Chi tiết thu nhập theo missionId
   */
  async getMyEarningByMission(missionId: number | string): Promise<DriverEarningDetailResponse> {
    return await this.request<DriverEarningDetailResponse>(`/driver/earnings/${missionId}`);
  }

  /**
   * POST /driver/earnings/{missionId}/collect-cash: Xác nhận đã thu tiền mặt từ bệnh nhân
   * Amount lấy từ PaymentTransaction trên BE, KHÔNG nhận từ client để tránh gian lận
   */
  async collectCash(missionId: number | string): Promise<DriverEarningDetailResponse> {
    return await this.request<DriverEarningDetailResponse>(`/driver/earnings/${missionId}/collect-cash`, {
      method: 'POST',
    });
  }
}

export const api = new ApiService();
