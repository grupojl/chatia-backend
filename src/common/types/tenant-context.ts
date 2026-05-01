// src/common/types/tenant-context.ts

export interface TenantContext {
  organizationId: string;
  organizationName: string;
  agentId?: string;
  firebaseUid: string;
  email: string;
  name: string;
  roles: string[];
  canRead: boolean;
  canWrite: boolean;
}
