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
  private apiBaseUrl: string = 'http://localhost:8080/api/v1';
  private useMockData: boolean = true; // Use mock data first for testing
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
      this.currentUser = {
        id: user.userId.toString(),
        role: mapApiRoleToLocal(user.roles[0]), // Use first role for now
        name: user.fullName,
        email: '', // API doesn't return email in login response
        phone: user.phoneNumber || '',
        createdAt: new Date(),
        roles: user.roles.map(mapApiRoleToLocal),
        userId: user.userId,
        username: user.username,
        phoneNumber: user.phoneNumber
      };
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
