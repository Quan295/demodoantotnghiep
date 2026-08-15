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
  resourceId?: string | number;
  licensePlate?: string;
  license_plate?: string;
  vehicleNumber?: string;
  type?: string;
  vehicleType?: string;
  status?: 'available' | 'busy' | 'maintenance' | 'offline' | 'en_route' | 'AVAILABLE' | 'BUSY' | 'MAINTENANCE' | 'OFFLINE' | 'EN_ROUTE' | string;
  providerId?: string | number;
  providerName?: string;
  driverId?: string | number;
  driverName?: string;
  driverPhone?: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  heading?: number;
  equipment?: string[] | string;
  fuelLevel?: number;
  batteryLevel?: number;
  odometer?: number;
  lastLocationUpdate?: string;
  updatedAt?: string;
  activeMission?: any;
  extended_attributes?: Record<string, any> | string | null;
  extendedAttributes?: Record<string, any> | string | null;
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
  id: string | number;
  callId?: string | number;
  status: string;
  statusText?: string;
  statusDescription?: string;
  updatedAt: string;
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
