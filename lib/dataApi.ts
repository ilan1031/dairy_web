import { apiPost } from './api';
import type { PermissionCatalog } from './pages';
import type { TokenConfig } from './repository';

async function parseJson<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json.data as T;
}

export interface BootstrapPayload {
  profile: Record<string, unknown> | null;
  customers: Record<string, unknown>[];
  sales: Record<string, unknown>[];
  priceConfigs: Record<string, unknown>[];
  priceLogs: Record<string, unknown>[];
  inventory: Record<string, unknown>[];
  users: Record<string, unknown>[];
  billingConfig: Record<string, unknown> | null;
  brandingConfig?: Record<string, unknown> | null;
  auditLogs: Record<string, unknown>[];
  permissionCatalog?: PermissionCatalog;
  sessionUser?: Record<string, unknown> | null;
  isSuperAdmin?: boolean;
  subscriptionStatus?: { blocked: boolean; reason?: string; expiresAt?: number; plan?: string; paymentMessage?: string };
}

export async function bootstrap(selectedUserId?: string | null): Promise<BootstrapPayload> {
  const body: Record<string, unknown> = {};
  if (selectedUserId === 'all' || selectedUserId) {
    body.selectedUserId = selectedUserId;
  }
  const res = await apiPost('/api/data/bootstrap', body);
  return parseJson(res);
}

export async function saveProfileApi(profile: object) {
  const res = await apiPost('/api/data/profile/save', profile);
  return parseJson(res);
}

export async function saveCustomerApi(customer: object) {
  const res = await apiPost('/api/data/customers/save', customer);
  return parseJson(res);
}

export async function deleteCustomerApi(id: string) {
  const res = await apiPost('/api/data/customers/delete', { id });
  await parseJson(res);
}

export async function saveSaleApi(sale: object) {
  const res = await apiPost('/api/data/sales/save', sale);
  return parseJson(res);
}

export async function deleteSaleApi(id: string) {
  const res = await apiPost('/api/data/sales/delete', { id });
  await parseJson(res);
}

export async function markSalePaidApi(id: string, paymentType: string) {
  const res = await apiPost('/api/data/sales/mark-paid', { id, paymentType });
  return parseJson(res);
}

export async function savePriceApi(milkType: string, newPrice: number, oldMilkType?: string, ownerUserId?: string) {
  const res = await apiPost('/api/data/prices/save', { milkType, newPrice, oldMilkType, ownerUserId });
  return parseJson(res);
}

export async function deletePriceApi(milkType: string, ownerUserId?: string) {
  const res = await apiPost('/api/data/prices/delete', { milkType, ownerUserId });
  return parseJson(res);
}

export async function saveInventoryApi(inventory: object) {
  const res = await apiPost('/api/data/inventory/save', inventory);
  return parseJson(res);
}

export async function saveBillingApi(config: object, ownerUserId?: string) {
  const res = await apiPost('/api/data/billing/save', { ...config, ownerUserId });
  return parseJson(res);
}

export async function saveBrandingApi(config: object, ownerUserId?: string) {
  const res = await apiPost('/api/data/branding/save', { ...config, ownerUserId });
  return parseJson<Record<string, unknown>>(res);
}

export async function logAuditApi(entry: object) {
  const res = await apiPost('/api/data/audit/log', entry);
  return parseJson(res);
}

export async function listAuditApi(options?: Record<string, unknown>) {
  const res = await apiPost('/api/data/audit/list', options || {});
  return parseJson<{ logs: Record<string, unknown>[]; total: number; page: number; pages: number }>(res);
}

export async function listUsersApi() {
  const res = await apiPost('/api/admin/users/list');
  return parseJson<Record<string, unknown>[]>(res);
}

export async function listPagesApi() {
  const res = await apiPost('/api/admin/users/pages');
  return parseJson<string[]>(res);
}

export async function createUserApi(user: Record<string, unknown>) {
  const res = await apiPost('/api/admin/users/create', user);
  return parseJson<Record<string, unknown>>(res);
}

export async function updateUserApi(user: Record<string, unknown>) {
  const res = await apiPost('/api/admin/users/update', user);
  return parseJson<Record<string, unknown>>(res);
}

export async function deleteUserApi(id: string) {
  const res = await apiPost('/api/admin/users/delete', { id });
  await parseJson(res);
}

export async function importDataApi(payload: BootstrapPayload) {
  const res = await apiPost('/api/data/import', payload);
  return parseJson<BootstrapPayload>(res);
}

export async function getCatalogApi() {
  const res = await apiPost('/api/admin/catalog/get');
  return parseJson<PermissionCatalog>(res);
}

export async function updateCatalogApi(catalog: PermissionCatalog) {
  const res = await apiPost('/api/admin/catalog/update', catalog as unknown as Record<string, unknown>);
  return parseJson<PermissionCatalog>(res);
}

export async function getTokenConfigApi() {
  const res = await apiPost('/api/admin/token-config/get');
  return parseJson<TokenConfig>(res);
}

export async function updateTokenConfigApi(config: Partial<TokenConfig>) {
  const res = await apiPost('/api/admin/token-config/update', config);
  return parseJson<TokenConfig>(res);
}

export interface IpLimitInfo {
  ipAddress: string;
  limit: number;
  count: number;
}

export async function getIpLimitApi(ipAddress: string) {
  const res = await apiPost('/api/admin/ip-limit/get', { ipAddress });
  return parseJson<IpLimitInfo>(res);
}

export async function updateIpLimitApi(ipAddress: string, limit: number) {
  const res = await apiPost('/api/admin/ip-limit/update', { ipAddress, limit });
  return parseJson<IpLimitInfo>(res);
}
