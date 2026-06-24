export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'export';

export interface CatalogPage {
  key: string;
  label: string;
  actions: PermissionAction[];
  tabIndex?: number;
}

export interface CatalogField {
  key: string;
  label: string;
}

export interface PermissionCatalog {
  pages: CatalogPage[];
  fields: Record<string, CatalogField[]>;
  updatedAt: number;
}

export interface SharedAccessRights {
  sales: boolean;
  inventory: boolean;
  customers: boolean;
}

export interface DataAccessScope {
  mode: 'own' | 'all' | 'shared';
  sharedUserIds: string[];
  sharedRights?: SharedAccessRights;
}

export interface ResourceLimits {
  maxCustomers?: number | null;
  maxSales?: number | null;
  maxInventory?: number | null;
  allowedMilkTypes?: string[] | null;
}

export interface UserSubscription {
  plan: string;
  expiresAt?: number;
  dueDate?: number;
  paymentMessage?: string;
}

export interface UserProfile {
  displayName?: string;
  phone?: string;
  department?: string;
  notes?: string;
}

export interface PermissionSet {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  allowedPages: string[];
  canUseSubscription?: boolean;
  canViewOthers?: boolean;
  pagePermissions?: Record<string, PermissionAction[]>;
  fieldPermissions?: Record<string, Record<string, boolean>>;
  dataAccessScope?: DataAccessScope;
  resourceLimits?: ResourceLimits;
}

export const DAIRY_PAGES = ['Dashboard', 'Sales', 'Bills', 'Inventory', 'Profiles', 'Reports', 'Settings'] as const;

export const PAGE_TAB_MAP: Record<string, number> = {
  Dashboard: 0,
  Sales: 1,
  Profiles: 2,
  Bills: 3,
  Reports: 4,
  Settings: 5,
};
