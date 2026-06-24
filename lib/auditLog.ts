export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'CONFIG_UPDATE'
  | 'PRICE_UPDATE'
  | 'SALE_CREATE'
  | 'SALE_DELETE'
  | 'SALE_PAY';

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  action: AuditAction | string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown> | null;
  ipAddress?: string;
  createdAt: number;
}

export function formatAuditAction(action: string): string {
  return action.replace(/_/g, ' ');
}
