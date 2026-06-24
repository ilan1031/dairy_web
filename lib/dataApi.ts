import { apiPost } from './api';
import type { PermissionCatalog } from './pages';

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
  auditLogs: Record<string, unknown>[];
  permissionCatalog?: PermissionCatalog;
  sessionUser?: Record<string, unknown> | null;
  isSuperAdmin?: boolean;
  subscriptionStatus?: { blocked: boolean; reason?: string; expiresAt?: number; plan?: string; paymentMessage?: string };
}

export async function bootstrap(): Promise<BootstrapPayload> {
  const res = await apiPost('/api/data/bootstrap');
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

export async function savePriceApi(milkType: string, newPrice: number) {
  const res = await apiPost('/api/data/prices/save', { milkType, newPrice });
  return parseJson(res);
}

export async function saveInventoryApi(inventory: object) {
  const res = await apiPost('/api/data/inventory/save', inventory);
  return parseJson(res);
}

export async function saveBillingApi(config: object) {
  const res = await apiPost('/api/data/billing/save', config);
  return parseJson(res);
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
