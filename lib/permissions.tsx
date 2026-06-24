"use client";
import React from 'react';
import Repository from './repository';
import type { PermissionAction, PermissionSet, UserModel } from './repository';

export function getCurrentUser(): UserModel | null {
  try {
    return Repository.getCurrentUser();
  } catch {
    return null;
  }
}

export function isSuperAdminSession(): boolean {
  return Repository.isSessionSuperAdmin() || Repository.isSuperAdmin();
}

export function hasPageAction(page: string, action: PermissionAction): boolean {
  if (Repository.isSuperAdmin()) return true;
  const u = getCurrentUser();
  if (!u || u.active === false) return false;
  if (u.role === 'superadmin') return true;

  const perms = u.permissions || ({} as PermissionSet);
  const pagePerms = perms.pagePermissions?.[page];
  if (pagePerms?.length) return pagePerms.includes(action);

  const pages = perms.allowedPages || [];
  if (!pages.includes('*') && !pages.includes(page)) return false;

  const map: Record<PermissionAction, keyof PermissionSet | null> = {
    view: 'canRead',
    create: 'canCreate',
    edit: 'canUpdate',
    delete: 'canDelete',
    export: 'canRead',
    share: 'canRead',
    exportAll: 'canRead',
  };
  const key = map[action];
  if (!key) return false;
  return Boolean(perms[key]);
}

export function canAccessField(page: string, field: string): boolean {
  if (Repository.isSuperAdmin()) return true;
  const u = getCurrentUser();
  if (!u || u.active === false) return false;
  const fieldPerms = u.permissions?.fieldPermissions?.[page];
  if (!fieldPerms || fieldPerms[field] === undefined) return true;
  return Boolean(fieldPerms[field]);
}

export function hasPermission(key: keyof UserModel['permissions'] | 'superadmin', page?: string): boolean {
  if (key === 'superadmin') return Repository.isSuperAdmin() || getCurrentUser()?.role === 'superadmin';
  if (page) {
    const actionMap: Partial<Record<keyof PermissionSet, PermissionAction>> = {
      canRead: 'view',
      canCreate: 'create',
      canUpdate: 'edit',
      canDelete: 'delete',
    };
    const action = actionMap[key];
    if (action) return hasPageAction(page, action);
  }

  if (Repository.isSuperAdmin()) return true;
  const u = getCurrentUser();
  if (!u) return false;
  if (u.role === 'superadmin') return true;
  if (u.active === false) return false;

  const perms = u.permissions || {};
  if (page) {
    const pages = perms.allowedPages || [];
    if (!pages.includes('*') && !pages.includes(page)) return false;
  }

  if (key === 'canUseSubscription') {
    if (!perms.canUseSubscription) return false;
    const sub = u.subscription;
    if (!sub) return false;
    if (sub.expiresAt && Date.now() > sub.expiresAt) return false;
    return true;
  }

  return Boolean(perms[key as keyof PermissionSet]);
}

export function canAccessPage(page: string): boolean {
  return hasPageAction(page, 'view');
}

export function Can({ do: permission, page, children, fallback = null }: {
  do: keyof UserModel['permissions'] | 'superadmin';
  page?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  if (hasPermission(permission, page)) return <>{children}</>;
  return <>{fallback}</>;
}

export default { getCurrentUser, hasPermission, hasPageAction, canAccessPage, canAccessField, Can };
