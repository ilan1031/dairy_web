"use client";
import React from 'react';
import Repository from './repository';
import { UserModel } from './repository';

export function getCurrentUser(): UserModel | null {
  try {
    return Repository.getCurrentUser();
  } catch (err) {
    return null;
  }
}

export function hasPermission(key: keyof UserModel['permissions'] | 'superadmin' , page?: string): boolean {
  const u = getCurrentUser();
  // Legacy behavior: if no current user selected, treat as full access
  if (!u) return true;
  if (u.role === 'superadmin') return true;
  if (key === 'superadmin') return false;
  const perms: any = u.permissions || {};
  if (page) {
    if (perms.allowedPages && (perms.allowedPages.includes('*') || perms.allowedPages.includes(page))) {
      return true;
    }
  }
  // subscription-sensitive permission
  if (key === 'canUseSubscription') {
    const sub = u.subscription;
    if (!perms.canUseSubscription) return false;
    if (!sub) return false;
    if (sub.expiresAt && Date.now() > sub.expiresAt) return false;
    return true;
  }

  return !!perms[key as string];
}

export function Can({ do: permission, page, children, fallback = null }: { do: keyof UserModel['permissions'] | 'superadmin'; page?: string; children: React.ReactNode; fallback?: React.ReactNode }) {
  if (hasPermission(permission, page)) return <>{children}</>;
  return <>{fallback}</>;
}

export default { getCurrentUser, hasPermission, Can };
