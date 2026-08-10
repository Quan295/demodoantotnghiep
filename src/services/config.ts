import { Role, User } from '@/types';

// Map API role strings to our Role type
export const mapApiRoleToLocal = (apiRole: string): Role => {
  switch (apiRole.toUpperCase()) {
    case 'REPORTER': return 'reporter';
    case 'DRIVER': return 'driver';
    case 'DISPATCHER': return 'dispatcher';
    case 'ADMIN': return 'admin';
    case 'PROVIDER': return 'provider';
    default: return 'reporter';
  }
};

class ConfigService {
  private apiBaseUrl: string = 'http://192.168.1.159:8080/api/v1';
  private useMockData: boolean = false; // Always call real API as requested
  private token: string | null = null;
  private refreshTokenVal: string | null = null;
  private currentUser: (User & { roles: Role[], userId: number }) | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    // Initializer
  }

  // Getters & Setters
  getApiBaseUrl() {
    return this.apiBaseUrl;
  }

  setApiBaseUrl(url: string) {
    this.apiBaseUrl = url;
    this.notify();
  }

  getUseMockData() {
    return this.useMockData;
  }

  setUseMockData(val: boolean) {
    this.useMockData = val;
    this.notify();
  }

  getToken() {
    return this.token;
  }

  setToken(token: string | null) {
    this.token = token;
    this.notify();
  }

  getRefreshToken() {
    return this.refreshTokenVal;
  }

  setRefreshToken(token: string | null) {
    this.refreshTokenVal = token;
    this.notify();
  }

  getCurrentUser() {
    return this.currentUser;
  }

  setCurrentUser(user: any) {
    if (user) {
      try {
        // Extract user ID safely
        const userId = user.userId || user.id || '0';
        const userRoles = user.roles || [];
        const firstRole = userRoles[0] || 'REPORTER';
        
        this.currentUser = {
          id: String(userId),
          role: mapApiRoleToLocal(firstRole),
          name: user.fullName || user.name || 'Người dùng',
          email: user.email || '',
          phone: user.phoneNumber || user.phone || '',
          createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
          roles: userRoles.map((r: string) => mapApiRoleToLocal(r)),
          userId: Number(userId),
          username: user.username || '',
          phoneNumber: user.phoneNumber || user.phone || '',
          // Preserve provider fields if present
          balance: user.balance,
          avgRating: user.avgRating,
          totalRevenue: user.totalRevenue,
          totalCases: user.totalCases,
        };
      } catch (e) {
        console.error('Error setting current user:', e, user);
        // Fallback user
        this.currentUser = {
          id: '0',
          role: 'reporter',
          name: 'Người dùng',
          email: '',
          phone: '',
          createdAt: new Date(),
          roles: ['reporter'],
          userId: 0,
          username: '',
          phoneNumber: '',
        };
      }
    } else {
      this.currentUser = null;
    }
    this.notify();
  }

  // Listener management
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (e) {
        console.error('Error in config listener:', e);
      }
    });
  }
}

export const globalConfig = new ConfigService();
