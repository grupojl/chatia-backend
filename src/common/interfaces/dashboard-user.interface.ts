// src/common/interfaces/dashboard-user.interface.ts

export interface ProductPermission {
  canRead: boolean;
  canWrite: boolean;
  role: string; // 'admin' | 'agent' | 'viewer'
}

export interface DashboardOrganization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface DashboardUser {
  userId: string;
  firebaseUid: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  organizations: DashboardOrganization[];
  productPermissions: Record<string, ProductPermission>;
}
