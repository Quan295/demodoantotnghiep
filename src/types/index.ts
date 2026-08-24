// User/Role Types
export type Role = 
  | 'reporter' 
  | 'driver' 
  | 'dispatcher' 
  | 'admin' 
  | 'provider';

export type ReporterTier = 'bronze' | 'silver' | 'gold';

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string;
  phone: string;
  createdAt: Date;
  balance?: number;
  avgRating?: number;
  totalRevenue?: number;
  totalCases?: number;
  phoneNumber?: string;
  username?: string;
}

export interface Reporter extends User {
  role: 'reporter';
  tier: ReporterTier;
  totalCases: number;
  avgRating: number;
}

export interface Driver extends User {
  role: 'driver';
  driverId: string;
  providerId: string;
  licensePlate: string;
  vehicleType: string;
  status: 'available' | 'busy' | 'offline';
}

export interface Dispatcher extends User {
  role: 'dispatcher';
  dispatcherId: string;
}

export interface Admin extends User {
  role: 'admin';
  adminId: string;
}

export interface Provider extends User {
  role: 'provider';
  providerId: string;
  companyName: string;
  address: string;
  contactPerson: string;
  bankAccount: string;
  bankName: string;
  balance: number;
  totalRevenue: number;
  totalCases: number;
  avgRating: number;
  vehicles: Vehicle[];
  isActive: boolean;
}

// Vehicle Type
export interface Vehicle {
  id: string;
  licensePlate: string;
  type: 'ambulance' | 'emergency-car' | 'other';
  status: 'available' | 'busy' | 'maintenance';
  providerId?: string;
  driverId?: string;
}

// Driver Resource Type (API /driver-resource)
export interface DriverResource {
  id: string | number;
  resourceCode?: string | null;
  resourceType?: string | null;
  status?: string | null;
  driverId?: string | number | null;
  driverName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  extendedAttributes?: Record<string, any> | null;
  extended_attributes?: Record<string, any> | null;
  updatedAt?: string | null;

  // Optional fields
  resourceId?: string | number;
  licensePlate?: string;
  license_plate?: string;
  vehicleNumber?: string;
  type?: string;
  vehicleType?: string;
  providerId?: string | number;
  providerName?: string;
  driverPhone?: string;
  speed?: number;
  heading?: number;
  equipment?: string[] | string;
  fuelLevel?: number;
  batteryLevel?: number;
  odometer?: number;
  lastLocationUpdate?: string;
  activeMission?: any;
}

/**
 * Trích xuất biển số xe từ extended_attributes / extendedAttributes hoặc các trường trực tiếp
 */
export function getResourceLicensePlate(resource?: DriverResource | null): string {
  if (!resource) return 'Chưa gán xe';

  // 1. Kiểm tra extended_attributes (hoặc extendedAttributes)
  const ext = resource.extended_attributes || resource.extendedAttributes;
  if (ext) {
    let extObj: any = ext;
    if (typeof ext === 'string') {
      try {
        extObj = JSON.parse(ext);
      } catch {
        extObj = {};
      }
    }
    if (typeof extObj === 'object' && extObj !== null) {
      const plate =
        extObj.license_plate ||
        extObj.licensePlate ||
        extObj.plate_number ||
        extObj.plateNumber ||
        extObj.bien_so ||
        extObj.bienSo ||
        extObj.plate ||
        extObj.license;
      if (plate && typeof plate === 'string' && plate.trim().length > 0) {
        return plate.trim();
      }
    }
  }

  // 2. Fallback sang các trường trực tiếp
  return (
    resource.licensePlate ||
    (resource as any).license_plate ||
    resource.vehicleNumber ||
    (resource as any).plate_number ||
    (resource.id ? `XE-${resource.id}` : 'Chưa có biển số')
  );
}

/**
 * Trích xuất Tên Tài xế từ DriverResource / extended_attributes / currentUser
 */
export function getResourceDriverName(resource?: DriverResource | null, currentUser?: any): string {
  if (!resource) return currentUser?.name || 'Bác sĩ / Tài xế Hùng';

  const ext = resource.extended_attributes || resource.extendedAttributes;
  let extObj: any = {};
  if (typeof ext === 'string') {
    try { extObj = JSON.parse(ext); } catch {}
  } else if (typeof ext === 'object' && ext) {
    extObj = ext;
  }

  return (
    resource.driverName ||
    (resource as any).driver_name ||
    (resource as any).driver?.name ||
    (resource as any).driver?.fullName ||
    extObj.driver_name ||
    extObj.driverName ||
    extObj.driver ||
    currentUser?.name ||
    currentUser?.fullName ||
    'Bác sĩ / Tài xế Hùng'
  );
}

/**
 * Trích xuất Số điện thoại Tài xế từ DriverResource / extended_attributes / currentUser
 */
export function getResourceDriverPhone(resource?: DriverResource | null, currentUser?: any): string {
  if (!resource) return currentUser?.phone || currentUser?.phoneNumber || '0988.115.115';

  const ext = resource.extended_attributes || resource.extendedAttributes;
  let extObj: any = {};
  if (typeof ext === 'string') {
    try { extObj = JSON.parse(ext); } catch {}
  } else if (typeof ext === 'object' && ext) {
    extObj = ext;
  }

  return (
    resource.driverPhone ||
    (resource as any).driver_phone ||
    (resource as any).phone ||
    (resource as any).phoneNumber ||
    (resource as any).driver?.phone ||
    (resource as any).driver?.phoneNumber ||
    extObj.driver_phone ||
    extObj.driverPhone ||
    extObj.phone ||
    extObj.phoneNumber ||
    currentUser?.phone ||
    currentUser?.phoneNumber ||
    '0988.115.115'
  );
}

/**
 * Trích xuất Tên Đơn vị quản lý / Bệnh viện từ DriverResource / extended_attributes
 */
export function getResourceProviderName(resource?: DriverResource | null): string {
  if (!resource) return 'Bệnh viện Cấp cứu 115 - Chi nhánh Đống Đa';

  const ext = resource.extended_attributes || resource.extendedAttributes;
  let extObj: any = {};
  if (typeof ext === 'string') {
    try { extObj = JSON.parse(ext); } catch {}
  } else if (typeof ext === 'object' && ext) {
    extObj = ext;
  }

  return (
    resource.providerName ||
    (resource as any).provider_name ||
    (resource as any).provider?.name ||
    (resource as any).hospital_name ||
    (resource as any).hospitalName ||
    extObj.provider_name ||
    extObj.providerName ||
    extObj.hospital ||
    extObj.hospital_name ||
    extObj.hospitalName ||
    'Bệnh viện Cấp cứu 115 - Chi nhánh Đống Đa'
  );
}

/**
 * Trích xuất Loại xe cứu thương từ DriverResource / extended_attributes
 */
export function getResourceVehicleType(resource?: DriverResource | null): string {
  if (!resource) return 'Xe Cấp Cứu Hồi Sức Tích Cực (ICU Ambulance)';

  const ext = resource.extended_attributes || resource.extendedAttributes;
  let extObj: any = {};
  if (typeof ext === 'string') {
    try { extObj = JSON.parse(ext); } catch {}
  } else if (typeof ext === 'object' && ext) {
    extObj = ext;
  }

  return (
    extObj.vehicle_type ||
    extObj.vehicleType ||
    extObj.model ||
    extObj.type ||
    resource.vehicleType ||
    (resource as any).vehicle_type ||
    resource.type ||
    'Xe Cấp Cứu Hồi Sức Tích Cực (ICU Ambulance)'
  );
}

/**
 * Trích xuất Danh mục trang thiết bị y tế từ DriverResource / extended_attributes
 */
export function getResourceEquipmentList(resource?: DriverResource | null): string[] {
  const defaultList = [
    'Máy sốc tim ngoài lồng ngực tự động (AED)',
    'Bình Oxy y tế 10L kèm đồng hồ đo lưu lượng',
    'Máy thở mini di động chuyên dụng cấp cứu',
    'Bộ nẹp cố định cột sống & cổ đa năng',
    'Cáng / Băng ca cứu thương thủy lực gấp gọn',
    'Bộ sơ cấp cứu & dịch truyền tĩnh mạch',
  ];

  if (!resource) return defaultList;

  const ext = resource.extended_attributes || resource.extendedAttributes;
  let extObj: any = {};
  if (typeof ext === 'string') {
    try { extObj = JSON.parse(ext); } catch {}
  } else if (typeof ext === 'object' && ext) {
    extObj = ext;
  }

  const raw =
    resource.equipment ||
    (resource as any).equipments ||
    extObj.equipment ||
    extObj.equipments ||
    extObj.equipment_list ||
    extObj.medical_equipment;

  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map(String).filter(s => s.trim().length > 0);
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    const parsed = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (parsed.length > 0) return parsed;
  }

  return defaultList;
}

export interface DriverLocationUpdatePayload {
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  address?: string;
}

// Case/Emergency Types
export type CaseStatus = 
  | 'pending' 
  | 'assigned' 
  | 'in-progress' 
  | 'completed' 
  | 'cancelled' 
  | 'refunded';

export interface EmergencyCall {
  id: string | number;
  status: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  latitude?: number;
  longitude?: number;
  location?: {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
    address?: string;
  };
  audioObjectKey?: string;
  audioUrl?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  reporterName?: string;
  reporterPhone?: string;
  assignedDriverId?: string | number;
  assignedDriverName?: string;
  assignedDriverPhone?: string;
  assignedVehicleId?: string | number;
  assignedVehiclePlate?: string;
  assignedHospital?: string;
  estimatedEtaMin?: number;
  notes?: string;
  extended_attributes?: Record<string, any> | string | null;
  extendedAttributes?: Record<string, any> | string | null;
}

export interface CallStatusResponse {
  id?: string | number;
  callId?: string | number;
  callStatus?: string;
  status?: string;
  requestId?: string | number | null;
  requestStatus?: string | null;
  missionId?: string | number | null;
  missionStatus?: string | null;
  statusText?: string;
  statusDescription?: string;
  updatedAt?: string;
  assignedUnit?: {
    vehiclePlate?: string;
    driverName?: string;
    driverPhone?: string;
    hospitalName?: string;
    etaMinutes?: number;
    extended_attributes?: Record<string, any> | string | null;
    extendedAttributes?: Record<string, any> | string | null;
  };
  stepIndex?: number;
}

// --- Dispatch Mission Types (DRIVER - Mission API) ---
export type DispatchMissionStatus =
  | 'CREATED'
  | 'DISPATCHED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EN_ROUTE'
  | 'ARRIVED_SCENE'
  | 'TRANSPORTING'
  | 'ARRIVED_HOSPITAL'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED'
  | 'TIMEOUT'
  | string;

export interface DispatchMission {
  id: string | number;
  requestId: string | number;
  resourceId: string | number;
  destinationName?: string | null;
  status: DispatchMissionStatus;

  dispatchedAt?: string | null;
  acceptedAt?: string | null;
  enRouteAt?: string | null;
  arrivedSceneAt?: string | null;
  startTransportAt?: string | null;
  arrivedHospitalAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;

  rejectReason?: string | null;
  cancelReason?: string | null;
  notes?: string | null;

  // Optional legacy / fallback support
  callId?: string | number;
  emergencyCallId?: string | number;
  driverId?: string | number;
  driverName?: string;
  driverPhone?: string;
  vehicleId?: string | number;
  vehiclePlate?: string;
  providerId?: string | number;
  providerName?: string;
  hospitalName?: string;
  hospitalAddress?: string;
  hospitalLocation?: LatLng;
  priority?: string;
  description?: string;
  injury?: string;
  patientName?: string;
  patientPhone?: string;
  victimName?: string;
  victimPhone?: string;
  victimAddress?: string;
  pickupAddress?: string;
  pickupLocation?: LatLng | { latitude: number; longitude: number; lat?: number; lng?: number; address?: string };
  dropoffLocation?: LatLng | { latitude: number; longitude: number; lat?: number; lng?: number; address?: string };
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  estimatedEtaMin?: number;
  createdAt?: string;
  updatedAt?: string;
  extended_attributes?: Record<string, any> | string | null;
  extendedAttributes?: Record<string, any> | string | null;
}

export interface EmergencyCase {
  id: string;
  reporterId: string;
  reporterName: string;
  reporterPhone: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  status: CaseStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  assignedProviderId?: string;
  assignedDriverId?: string;
  assignedVehicleId?: string;
  createdAt: Date;
  assignedAt?: Date;
  completedAt?: Date;
  amount: number;
  systemFee: number;
  providerEarnings: number;
}

// Financial Types
export type TransactionType = 
  | 'deposit' 
  | 'withdraw' 
  | 'payment' 
  | 'fee' 
  | 'refund' 
  | 'earning';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  caseId?: string;
  createdAt: Date;
}

// Rating/Review Types
export interface Review {
  id: string;
  caseId: string;
  reporterId: string;
  providerId: string;
  rating: number; // 1-5
  comment: string;
  categories: {
    speed: number;
    attitude: number;
    quality: number;
    safety: number;
  };
  photos?: string[];
  providerResponse?: string;
  createdAt: Date;
}

// Statistics Types
export interface ProviderStats {
  providerId: string;
  providerName: string;
  totalCases: number;
  completedCases: number;
  avgResponseTime: number; // minutes
  avgRating: number;
  completionRate: number; // percentage
  complaintRate: number; // percentage
  totalRevenue: number;
  period: 'day' | 'week' | 'month' | 'year';
}

export interface SystemStats {
  totalCases: number;
  totalRevenue: number;
  totalProviders: number;
  avgRating: number;
  topProviders: ProviderStats[];
  flaggedProviders: { providerId: string; providerName: string; complaintRate: number }[];
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RoutePoint extends LatLng {
  timestamp?: string;
  sequence?: number;
}

export type AmbulanceSimulationStatus =
  | 'CREATED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'STOPPED';

export interface AmbulanceSimulation {
  id: string;
  missionId?: string;
  dispatchMissionId?: string;
  vehicleId?: string;
  driverId?: string;
  startLocation: LatLng;
  endLocation: LatLng;
  currentLocation: LatLng;
  route?: RoutePoint[];
  routeIndex?: number;
  status: AmbulanceSimulationStatus;
  speed?: number;
  heading?: number;
  distanceTraveled?: number;
  estimatedTimeArrival?: number;
  progress?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TrackingUpdate {
  simulationId: string;
  missionId?: string;
  currentLocation: LatLng;
  previousLocation?: LatLng;
  speed?: number;
  heading?: number;
  progress?: number;
  estimatedTimeArrival?: number;
  distanceTraveled?: number;
  timestamp: string;
  status: AmbulanceSimulationStatus;
}

export interface CallTrackingResponse {
  callId: number | string;
  callStatus: string;

  dispatchRequestId?: number | string | null;
  dispatchRequestStatus?: string | null;

  missionId?: number | string | null;
  missionStatus?: string | null;

  resourceId?: number | string | null;
  resourceCode?: string | null;
  resourceStatus?: string | null;

  resourceLongitude?: number | null;
  resourceLatitude?: number | null;

  tracking?: TrackingUpdate | null;
}
