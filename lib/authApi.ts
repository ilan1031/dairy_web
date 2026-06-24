import { apiPost } from './api';
import type { UserModel } from './repository';

export interface WhoamiResponse {
  authenticated: boolean;
  email?: string;
  userId?: string;
  isSuperAdmin?: boolean;
  user?: UserModel | null;
  subscriptionStatus?: { blocked: boolean; reason?: string; expiresAt?: number; plan?: string; paymentMessage?: string };
  error?: string;
}

let whoamiPromise: Promise<WhoamiResponse> | null = null;

export async function whoamiApi(): Promise<WhoamiResponse> {
  const res = await apiPost('/api/auth/whoami');
  return res.json();
}

export function getWhoamiPromise(forceRefresh = false): Promise<WhoamiResponse> {
  if (!whoamiPromise || forceRefresh) {
    whoamiPromise = whoamiApi();
  }
  return whoamiPromise;
}

export function clearWhoamiPromise(): void {
  whoamiPromise = null;
}

export async function logoutApi(): Promise<void> {
  clearWhoamiPromise();
  await apiPost('/api/auth/logout');
}

export async function changePasswordApi(body: {
  currentPassword?: string;
  newPassword: string;
  userId?: string;
}): Promise<void> {
  const res = await apiPost('/api/auth/change-password', body);
  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.error || 'Failed to change password');
  }
}
