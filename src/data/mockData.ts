import {
    Admin,
    Dispatcher,
    Driver,
    EmergencyCase,
    Provider,
    ProviderStats,
    Reporter,
    Review,
    SystemStats,
    Transaction
} from '@/types';

// Mock Users
export const mockAdmin: Admin = {
  id: 'admin-1',
  role: 'admin',
  adminId: 'ADMIN-001',
  name: 'Admin System',
  email: 'admin@115smart.com',
  phone: '0123456789',
  createdAt: new Date('2025-01-01'),
};

export const mockProvider: Provider = {
  id: 'provider-1',
  role: 'provider',
  providerId: 'PROV-001',
  name: 'Nguyễn Văn A',
  companyName: 'Công ty Cứu hộ An Bình',
  email: 'contact@anbinh.com',
  phone: '0987654321',
  address: '123 Đường ABC, Quận 1, TP.HCM',
  contactPerson: 'Nguyễn Văn A',
  bankAccount: '1234567890',
  bankName: 'Vietcombank',
  balance: 5000000,
  totalRevenue: 25000000,
  totalCases: 150,
  avgRating: 4.5,
  isActive: true,
  vehicles: [
    {
      id: 'veh-1',
      licensePlate: '51A-12345',
      type: 'ambulance',
      status: 'available',
      providerId: 'provider-1',
    },
    {
      id: 'veh-2',
      licensePlate: '51B-67890',
      type: 'emergency-car',
      status: 'busy',
      providerId: 'provider-1',
    },
  ],
  createdAt: new Date('2025-03-15'),
};

export const mockReporter: Reporter = {
  id: 'reporter-1',
  role: 'reporter',
  name: 'Lê Thị C',
  email: 'lethi.c@gmail.com',
  phone: '0901234567',
  tier: 'silver',
  totalCases: 15,
  avgRating: 4.8,
  createdAt: new Date('2025-04-10'),
};

export const mockDriver: Driver = {
  id: 'driver-1',
  role: 'driver',
  driverId: 'DRIVER-001',
  name: 'Phạm Văn D',
  email: 'phamvand@gmail.com',
  phone: '0912345678',
  providerId: 'provider-1',
  licensePlate: '51A-12345',
  vehicleType: 'ambulance',
  status: 'available',
  createdAt: new Date('2025-03-20'),
};

export const mockDispatcher: Dispatcher = {
  id: 'dispatcher-1',
  role: 'dispatcher',
  dispatcherId: 'DISP-001',
  name: 'Điều phối viên 1',
  email: 'dispatcher1@115smart.com',
  phone: '0911111111',
  createdAt: new Date('2025-01-15'),
};

// Mock Cases
export const mockCases: EmergencyCase[] = [
  {
    id: 'case-1',
    reporterId: 'reporter-1',
    reporterName: 'Lê Thị C',
    reporterPhone: '0901234567',
    location: {
      lat: 10.762622,
      lng: 106.660172,
      address: '456 Đường XYZ, Quận 3, TP.HCM',
    },
    status: 'completed',
    priority: 'high',
    description: 'Người già bị ngã, cần xe cứu hộ gấp',
    assignedProviderId: 'provider-1',
    assignedDriverId: 'driver-1',
    assignedVehicleId: 'veh-1',
    createdAt: new Date('2026-06-25T08:30:00'),
    assignedAt: new Date('2026-06-25T08:32:00'),
    completedAt: new Date('2026-06-25T09:15:00'),
    amount: 300000,
    systemFee: 30000,
    providerEarnings: 270000,
  },
  {
    id: 'case-2',
    reporterId: 'reporter-1',
    reporterName: 'Lê Thị C',
    reporterPhone: '0901234567',
    location: {
      lat: 10.772622,
      lng: 106.670172,
      address: '789 Đường KLM, Quận 10, TP.HCM',
    },
    status: 'in-progress',
    priority: 'medium',
    description: 'Bị đau bụng cấp',
    assignedProviderId: 'provider-1',
    assignedDriverId: 'driver-1',
    assignedVehicleId: 'veh-2',
    createdAt: new Date('2026-07-02T10:00:00'),
    assignedAt: new Date('2026-07-02T10:02:00'),
    amount: 250000,
    systemFee: 25000,
    providerEarnings: 225000,
  },
];

// Mock Transactions
export const mockTransactions: Transaction[] = [
  {
    id: 'trans-1',
    userId: 'provider-1',
    type: 'deposit',
    amount: 10000000,
    balanceBefore: 0,
    balanceAfter: 10000000,
    description: 'Nạp tiền ban đầu',
    createdAt: new Date('2025-03-15'),
  },
  {
    id: 'trans-2',
    userId: 'provider-1',
    type: 'earning',
    amount: 270000,
    balanceBefore: 4730000,
    balanceAfter: 5000000,
    description: 'Thu ca case-1',
    caseId: 'case-1',
    createdAt: new Date('2026-06-25T09:30:00'),
  },
  {
    id: 'trans-3',
    userId: 'provider-1',
    type: 'fee',
    amount: 30000,
    balanceBefore: 5000000,
    balanceAfter: 4970000,
    description: 'Phí hệ thống case-1',
    caseId: 'case-1',
    createdAt: new Date('2026-06-25T09:30:00'),
  },
];

// Mock Reviews
export const mockReviews: Review[] = [
  {
    id: 'review-1',
    caseId: 'case-1',
    reporterId: 'reporter-1',
    providerId: 'provider-1',
    rating: 5,
    comment: 'Dịch vụ rất nhanh chóng, tài xế nhiệt tình',
    categories: {
      speed: 5,
      attitude: 5,
      quality: 5,
      safety: 5,
    },
    createdAt: new Date('2026-06-25T10:00:00'),
  },
];

// Mock Stats
export const mockProviderStats: ProviderStats = {
  providerId: 'provider-1',
  providerName: 'Công ty Cứu hộ An Bình',
  totalCases: 150,
  completedCases: 145,
  avgResponseTime: 8,
  avgRating: 4.5,
  completionRate: 96.7,
  complaintRate: 3.3,
  totalRevenue: 25000000,
  period: 'month',
};

export const mockSystemStats: SystemStats = {
  totalCases: 5000,
  totalRevenue: 500000000,
  totalProviders: 25,
  avgRating: 4.4,
  topProviders: [mockProviderStats],
  flaggedProviders: [
    {
      providerId: 'provider-99',
      providerName: 'Công ty Cứu hộ Kém',
      complaintRate: 10.0,
    },
  ],
};
