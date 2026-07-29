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

// Case/Emergency Types
export type CaseStatus = 
  | 'pending' 
  | 'assigned' 
  | 'in-progress' 
  | 'completed' 
  | 'cancelled' 
  | 'refunded';

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
