"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Repository, { UserModel, PermissionSet } from '@/lib/repository';
import { isSuperAdminSession } from '@/lib/permissions';
import type { PermissionAction, PermissionCatalog, CatalogPage, CatalogField, ResourceLimits } from '@/lib/pages';
import Switch from '@/components/ui/Switch';
import {
  listUsersApi,
  createUserApi,
  updateUserApi,
  deleteUserApi,
  getCatalogApi,
  updateCatalogApi,
  getTokenConfigApi,
  updateTokenConfigApi,
  getIpLimitApi,
  updateIpLimitApi,
} from '@/lib/dataApi';
import { PlusCircle, Users, ArrowLeft, Trash2, Loader2, Shield, Key, Clock } from 'lucide-react';

interface AdminSettingsProps {
  onBack: () => void;
  onSuccessToast?: (message?: string) => void;
}

interface BulkOperationsProps {
  selectedIds: string[];
  users: UserModel[];
  onClearSelection: () => void;
  onSuccessToast?: (msg?: string) => void;
  refresh: () => Promise<void>;
}

function BulkOperations({ selectedIds, users, onClearSelection, onSuccessToast, refresh }: BulkOperationsProps) {
  const [saving, setSaving] = useState(false);

  // Bulk Subscription states
  const [subPlan, setSubPlan] = useState('monthly');
  const [subExpiresAt, setSubExpiresAt] = useState('');
  const [subCanUse, setSubCanUse] = useState(true);
  const [subMessage, setSubMessage] = useState('');

  // Bulk Permissions states
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [selectedActions, setSelectedActions] = useState<PermissionAction[]>([]);

  // Bulk Limits states
  const [maxCust, setMaxCust] = useState('');
  const [maxSale, setMaxSale] = useState('');
  const [maxInv, setMaxInv] = useState('');
  const [allowedMilk, setAllowedMilk] = useState<string[]>([]);

  // Bulk Share states
  const [shareMode, setShareMode] = useState<'own' | 'all'>('own');

  const handleApplySubscription = async () => {
    setSaving(true);
    try {
      const expiresAt = subExpiresAt ? new Date(subExpiresAt).getTime() : undefined;
      await Promise.all(
        selectedIds.map(async (id) => {
          const u = users.find((x) => x.id === id);
          if (!u || !u.active) return;
          const updated: UserModel = {
            ...u,
            subscription: {
              plan: subPlan,
              expiresAt,
              dueDate: expiresAt,
              paymentMessage: subMessage || undefined,
            },
            permissions: {
              ...u.permissions,
              canUseSubscription: subCanUse,
            },
          };
          await updateUserApi(updated as unknown as Record<string, unknown>);
        })
      );
      onSuccessToast?.('Bulk subscription updated.');
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Bulk update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyPermissions = async () => {
    if (!selectedPages.length) return alert('Select at least one page');
    setSaving(true);
    try {
      await Promise.all(
        selectedIds.map(async (id) => {
          const u = users.find((x) => x.id === id);
          if (!u || !u.active) return;
          const perms = { ...u.permissions };
          const pagePerms = { ...(perms.pagePermissions || {}) };
          
          // Merge page keys into allowed pages
          const allowed = new Set(perms.allowedPages || []);
          selectedPages.forEach((p) => {
            allowed.add(p);
            pagePerms[p] = selectedActions;
          });

          const updated: UserModel = {
            ...u,
            permissions: {
              ...perms,
              allowedPages: Array.from(allowed),
              pagePermissions: pagePerms,
            },
          };
          await updateUserApi(updated as unknown as Record<string, unknown>);
        })
      );
      onSuccessToast?.('Bulk permissions updated.');
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Bulk update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyLimits = async () => {
    setSaving(true);
    try {
      await Promise.all(
        selectedIds.map(async (id) => {
          const u = users.find((x) => x.id === id);
          if (!u || !u.active) return;
          const updated: UserModel = {
            ...u,
            permissions: {
              ...u.permissions,
              resourceLimits: {
                maxCustomers: maxCust.trim() === '' ? null : Number(maxCust),
                maxSales: maxSale.trim() === '' ? null : Number(maxSale),
                maxInventory: maxInv.trim() === '' ? null : Number(maxInv),
                allowedMilkTypes: allowedMilk.length ? allowedMilk : null,
              },
            },
          };
          await updateUserApi(updated as unknown as Record<string, unknown>);
        })
      );
      onSuccessToast?.('Bulk limits updated.');
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Bulk update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete all ${selectedIds.length} selected users?`)) return;
    setSaving(true);
    try {
      await Promise.all(selectedIds.map((id) => deleteUserApi(id)));
      onClearSelection();
      onSuccessToast?.('Selected users deleted.');
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Bulk delete failed');
    } finally {
      setSaving(false);
    }
  };

  const handleApplySharing = async () => {
    setSaving(true);
    try {
      await Promise.all(
        selectedIds.map(async (id) => {
          const u = users.find((x) => x.id === id);
          if (!u || !u.active) return;
          const perms = { ...u.permissions };
          const updated: UserModel = {
            ...u,
            permissions: {
              ...perms,
              dataAccessScope: {
                mode: shareMode,
                sharedUserIds: perms.dataAccessScope?.sharedUserIds || [],
              },
              canViewOthers: shareMode === 'all',
            },
          };
          await updateUserApi(updated as unknown as Record<string, unknown>);
        })
      );
      onSuccessToast?.('Bulk data sharing updated.');
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Bulk update failed');
    } finally {
      setSaving(false);
    }
  };

  const togglePageSelection = (pageKey: string) => {
    setSelectedPages((prev) =>
      prev.includes(pageKey) ? prev.filter((p) => p !== pageKey) : [...prev, pageKey]
    );
  };

  const toggleActionSelection = (action: PermissionAction) => {
    setSelectedActions((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    );
  };

  const toggleMilkSelection = (milk: string) => {
    setAllowedMilk((prev) =>
      prev.includes(milk) ? prev.filter((m) => m !== milk) : [...prev, milk]
    );
  };

  const pagesList = ['Dashboard', 'Sales', 'Bills', 'Inventory', 'Profiles', 'Reports', 'Settings'];
  const actionsList: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'export', 'share', 'exportAll'];
  const actionLabels: Record<PermissionAction, string> = {
    view: 'View',
    create: 'Create',
    edit: 'Edit',
    delete: 'Delete',
    export: 'Export',
    share: 'Share',
    exportAll: 'Export All',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, color: 'var(--primary-milk)' }}>Bulk Operations ({selectedIds.length} selected)</h4>
        <button className="btn btn-outline" onClick={onClearSelection} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Clear</button>
      </div>

      <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 12 }}>
        <label className="form-label" style={{ marginTop: 0, fontWeight: 700 }}>Bulk Subscription &amp; Access</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <select className="form-input" value={subPlan} onChange={(e) => setSubPlan(e.target.value)}>
            <option value="free">Free</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="lifetime">Lifetime</option>
          </select>
          <input type="date" className="form-input" value={subExpiresAt} onChange={(e) => setSubExpiresAt(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <input type="checkbox" checked={subCanUse} onChange={(e) => setSubCanUse(e.target.checked)} />
          <span style={{ fontSize: '0.85rem' }}>Allow App Access (renew permission)</span>
        </div>
        <textarea className="form-input" placeholder="Custom Payment message" rows={2} style={{ marginTop: 8, width: '100%' }} value={subMessage} onChange={(e) => setSubMessage(e.target.value)} />
        <button className="btn btn-primary" style={{ marginTop: 8, width: '100%' }} onClick={handleApplySubscription} disabled={saving}>
          Apply Subscription to {selectedIds.length} Users
        </button>
      </div>

      <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 12 }}>
        <label className="form-label" style={{ marginTop: 0, fontWeight: 700 }}>Bulk Permissions Matrix</label>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, marginTop: 6 }}>1. Select Target Pages:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {pagesList.map((p) => {
            const checked = selectedPages.includes(p);
            return (
              <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={checked} onChange={() => togglePageSelection(p)} />
                {p}
              </label>
            );
          })}
        </div>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, marginTop: 8 }}>2. Select Actions to Grant:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {actionsList.map((act) => {
            const checked = selectedActions.includes(act);
            return (
              <label key={act} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={checked} onChange={() => toggleActionSelection(act)} />
                {actionLabels[act]}
              </label>
            );
          })}
        </div>
        <button className="btn btn-primary" style={{ marginTop: 10, width: '100%' }} onClick={handleApplyPermissions} disabled={saving}>
          Apply Permissions to {selectedIds.length} Users
        </button>
      </div>

      <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 12 }}>
        <label className="form-label" style={{ marginTop: 0, fontWeight: 700 }}>Bulk Data Limits</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <input className="form-input" type="number" min={0} placeholder="Max customers" value={maxCust} onChange={(e) => setMaxCust(e.target.value)} />
          <input className="form-input" type="number" min={0} placeholder="Max sales" value={maxSale} onChange={(e) => setMaxSale(e.target.value)} />
        </div>
        <input className="form-input" type="number" min={0} placeholder="Max inventory entries" style={{ marginTop: 8, width: '100%' }} value={maxInv} onChange={(e) => setMaxInv(e.target.value)} />
        <div style={{ fontSize: '0.82rem', fontWeight: 600, marginTop: 8 }}>Allowed Milk Categories:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {['Cow Milk', 'Buffalo Milk', 'A2 Milk'].map((milk) => {
            const checked = allowedMilk.includes(milk);
            return (
              <label key={milk} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={checked} onChange={() => toggleMilkSelection(milk)} />
                {milk}
              </label>
            );
          })}
        </div>
        <button className="btn btn-primary" style={{ marginTop: 10, width: '100%' }} onClick={handleApplyLimits} disabled={saving}>
          Apply Limits to {selectedIds.length} Users
        </button>
      </div>

      <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 12 }}>
        <label className="form-label" style={{ marginTop: 0, fontWeight: 700 }}>Bulk Data Scope Mode</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className={`btn ${shareMode === 'own' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }} onClick={() => setShareMode('own')}>Own data only</button>
          <button className={`btn ${shareMode === 'all' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }} onClick={() => setShareMode('all')}>All users data</button>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 10, width: '100%' }} onClick={handleApplySharing} disabled={saving}>
          Apply Data Sharing to {selectedIds.length} Users
        </button>
      </div>

      <button className="btn btn-danger" style={{ width: '100%', marginTop: 8 }} onClick={handleBulkDelete} disabled={saving}>
        Delete {selectedIds.length} Selected Users
      </button>
    </div>
  );
}

function toUserModel(raw: Record<string, unknown>): UserModel {
  const perms = (raw.permissions || {}) as PermissionSet;
  return {
    id: String(raw.id),
    name: String(raw.name || ''),
    email: String(raw.email || ''),
    role: String(raw.role || 'user'),
    active: raw.active !== false,
    subscription: raw.active === false ? null : ((raw.subscription as UserModel['subscription']) ?? null),
    profile: (raw.profile as UserModel['profile']) || {},
    permissions: {
      canCreate: Boolean(perms.canCreate),
      canRead: perms.canRead !== false,
      canUpdate: Boolean(perms.canUpdate),
      canDelete: Boolean(perms.canDelete),
      allowedPages: Array.isArray(perms.allowedPages) ? perms.allowedPages : ['Dashboard'],
      canUseSubscription: raw.active === false ? false : Boolean(perms.canUseSubscription),
      canViewOthers: Boolean(perms.canViewOthers),
      pagePermissions: perms.pagePermissions || {},
      fieldPermissions: perms.fieldPermissions || {},
      dataAccessScope: perms.dataAccessScope || { mode: 'own', sharedUserIds: [], sharedRights: { sales: true, inventory: true, customers: true } },
      resourceLimits: perms.resourceLimits || {},
    },
    createdAt: Number(raw.createdAt || Date.now()),
    updatedAt: Number(raw.updatedAt || Date.now()),
  };
}

const ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  export: 'Export',
  share: 'Share',
  exportAll: 'Export All',
};

const MILK_TYPES = ['Cow Milk', 'Buffalo Milk', 'A2 Milk'];

export default function AdminSettings({ onBack, onSuccessToast }: AdminSettingsProps) {
  const [users, setUsers] = useState<UserModel[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalog | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [selected, setSelected] = useState<UserModel | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalogEdit, setCatalogEdit] = useState(false);
  const [newPageKey, setNewPageKey] = useState('');
  const [newPageLabel, setNewPageLabel] = useState('');

  // Token Config states
  const [sessionHours, setSessionHours] = useState('8');
  const [loginHours, setLoginHours] = useState('24');
  const [subscriptionDays, setSubscriptionDays] = useState('30');
  const [tokenConfigSaving, setTokenConfigSaving] = useState(false);

  const [ipQuery, setIpQuery] = useState('');
  const [ipLimit, setIpLimit] = useState<number | ''>('');
  const [ipUsage, setIpUsage] = useState<number | null>(null);
  const [ipLimitLoaded, setIpLimitLoaded] = useState(false);
  const [ipLimitLoading, setIpLimitLoading] = useState(false);
  const [ipLimitSaving, setIpLimitSaving] = useState(false);
  const [ipLimitError, setIpLimitError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [data, cat, tokenConfig] = await Promise.all([
        listUsersApi(),
        getCatalogApi().catch(() => Repository.getPermissionCatalog()),
        getTokenConfigApi().catch((err) => {
          console.error('[AdminSettings] Failed to fetch token config:', err);
          return null;
        }),
      ]);
      const mapped = (data || []).map(toUserModel);
      setUsers(mapped);
      Repository.setUsers(mapped);
      if (cat) {
        setCatalog(cat);
        Repository.setPermissionCatalog(cat);
      } else if (Repository.getPermissionCatalog()) {
        setCatalog(Repository.getPermissionCatalog());
      }
      if (tokenConfig) {
        setSessionHours(String(tokenConfig.sessionExpirySeconds / 3600));
        setLoginHours(String(tokenConfig.loginExpirySeconds / 3600));
        setSubscriptionDays(String(tokenConfig.subscriptionExpirySeconds / (24 * 3600)));
      }
      setSelectedIds((prev) => prev.filter((id) => mapped.some((u) => u.id === id)));
      if (selected) {
        setSelected(mapped.find((u) => u.id === selected.id) || null);
      }
    } catch (err) {
      console.error('[AdminSettings] Failed to load:', err);
      setUsers(Repository.getUsers());
      setCatalog(Repository.getPermissionCatalog());
    } finally {
      setLoading(false);
    }
  }, [selected]);

  const handleSaveTokenConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setTokenConfigSaving(true);
    try {
      const sessionExpirySeconds = parseFloat(sessionHours) * 3600;
      const loginExpirySeconds = parseFloat(loginHours) * 3600;
      const subscriptionExpirySeconds = parseFloat(subscriptionDays) * 24 * 3600;

      if (Number.isNaN(sessionExpirySeconds) || Number.isNaN(loginExpirySeconds) || Number.isNaN(subscriptionExpirySeconds)) {
        alert('Invalid expiration time values.');
        return;
      }

      await updateTokenConfigApi({
        sessionExpirySeconds,
        loginExpirySeconds,
        subscriptionExpirySeconds,
      });
      onSuccessToast?.('Token configurations updated.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update token config');
    } finally {
      setTokenConfigSaving(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const persistUser = async (user: UserModel, password?: string) => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...user };
      if (password) payload.password = password;
      const saved = toUserModel(await updateUserApi(payload));
      setSelected(saved);
      await refresh();
      onSuccessToast?.('User saved successfully.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!email || !name) return alert('Name and email required');
    if (!newPassword || newPassword.length < 6) return alert('Password required (min 6 characters)');
    setSaving(true);
    try {
      const created = toUserModel(await createUserApi({
        name,
        email,
        password: newPassword,
        active: true,
        profile: { displayName: name },
        permissions: {
          canCreate: false,
          canRead: true,
          canUpdate: false,
          canDelete: false,
          allowedPages: ['Dashboard'],
          pagePermissions: { Dashboard: ['view'] },
          fieldPermissions: {},
          dataAccessScope: { mode: 'own', sharedUserIds: [] },
        },
      }));
      setName('');
      setEmail('');
      setNewPassword('');
      setSelected(created);
      await refresh();
      onSuccessToast?.('User created successfully.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this user?')) return;
    setSaving(true);
    try {
      await deleteUserApi(id);
      if (selected?.id === id) setSelected(null);
      await refresh();
      onSuccessToast?.('User deleted.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setSaving(false);
    }
  };

  const togglePageAction = (pageKey: string, action: PermissionAction) => {
    if (!selected || !selected.active) return;
    const perms = { ...selected.permissions };
    const pagePerms = { ...(perms.pagePermissions || {}) };
    const current = new Set(pagePerms[pageKey] || []);
    if (current.has(action)) current.delete(action);
    else current.add(action);
    pagePerms[pageKey] = Array.from(current);
    const allowed = new Set(perms.allowedPages || []);
    if (current.size > 0) allowed.add(pageKey);
    else allowed.delete(pageKey);
    persistUser({
      ...selected,
      permissions: { ...perms, pagePermissions: pagePerms, allowedPages: Array.from(allowed) },
    });
  };

  const toggleField = (pageKey: string, fieldKey: string, enabled: boolean) => {
    if (!selected || !selected.active) return;
    const perms = { ...selected.permissions };
    const fieldPerms = { ...(perms.fieldPermissions || {}) };
    const pageFields = { ...(fieldPerms[pageKey] || {}) };
    pageFields[fieldKey] = enabled;
    fieldPerms[pageKey] = pageFields;
    persistUser({ ...selected, permissions: { ...perms, fieldPermissions: fieldPerms } });
  };

  const updateDataScope = (mode: 'own' | 'all' | 'shared') => {
    if (!selected || !isSuperAdminSession()) return;
    const perms = { ...selected.permissions };
    persistUser({
      ...selected,
      permissions: {
        ...perms,
        dataAccessScope: { mode, sharedUserIds: perms.dataAccessScope?.sharedUserIds || [] },
        canViewOthers: mode === 'all',
      },
    });
  };

  const toggleSharedUser = (userId: string, enabled: boolean) => {
    if (!selected || !isSuperAdminSession()) return;
    const perms = { ...selected.permissions };
    const scope = perms.dataAccessScope || { mode: 'shared', sharedUserIds: [] };
    const ids = new Set(scope.sharedUserIds || []);
    if (enabled) ids.add(userId);
    else ids.delete(userId);
    persistUser({
      ...selected,
      permissions: {
        ...perms,
        dataAccessScope: { mode: 'shared', sharedUserIds: Array.from(ids) },
      },
    });
  };

  const saveCatalog = async () => {
    if (!catalog) return;
    setSaving(true);
    try {
      const saved = await updateCatalogApi(catalog);
      setCatalog(saved);
      setCatalogEdit(false);
      onSuccessToast?.('Permission catalog updated.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save catalog');
    } finally {
      setSaving(false);
    }
  };

  const addCatalogPage = () => {
    if (!catalog || !newPageKey.trim()) return;
    const pages: CatalogPage[] = [
      ...catalog.pages,
      { key: newPageKey.trim(), label: newPageLabel.trim() || newPageKey.trim(), actions: ['view'] },
    ];
    setCatalog({ ...catalog, pages });
    setNewPageKey('');
    setNewPageLabel('');
  };

  const toggleSharedRight = (key: 'sales' | 'inventory' | 'customers', enabled: boolean) => {
    if (!selected || !isSuperAdminSession()) return;
    const perms = { ...selected.permissions };
    const scope = perms.dataAccessScope || { mode: 'shared', sharedUserIds: [], sharedRights: { sales: true, inventory: true, customers: true } };
    const rights = { sales: true, inventory: true, customers: true, ...(scope.sharedRights || {}) };
    rights[key] = enabled;
    persistUser({
      ...selected,
      permissions: { ...perms, dataAccessScope: { ...scope, mode: 'shared', sharedRights: rights } },
    });
  };

  const updateLimit = (key: keyof ResourceLimits, value: string) => {
    if (!selected || !isSuperAdminSession()) return;
    const perms = { ...selected.permissions };
    const limits = { ...(perms.resourceLimits || {}) };
    const num = value.trim() === '' ? null : Number(value);
    (limits as Record<string, unknown>)[key] = num;
    persistUser({ ...selected, permissions: { ...perms, resourceLimits: limits } });
  };

  const toggleMilkType = (milkType: string, enabled: boolean) => {
    if (!selected || !isSuperAdminSession()) return;
    const perms = { ...selected.permissions };
    const limits = { ...(perms.resourceLimits || {}) };
    const current = new Set(limits.allowedMilkTypes || []);
    if (enabled) current.add(milkType);
    else current.delete(milkType);
    limits.allowedMilkTypes = current.size ? Array.from(current) : null;
    persistUser({ ...selected, permissions: { ...perms, resourceLimits: limits } });
  };

  const pages = catalog?.pages || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-outline" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
          <Users size={18} style={{ marginRight: 8 }} /> Admin Controls
        </h2>
        <div>{saving && <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />}</div>
      </div>

      {isSuperAdminSession() && catalog && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Shield size={16} /> Permission Catalog</h3>
            <button className="btn btn-outline" onClick={() => setCatalogEdit(!catalogEdit)}>{catalogEdit ? 'Done' : 'Edit Catalog'}</button>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 8 }}>
            Define pages and fields dynamically — no code changes needed for support team.
          </p>
          {catalogEdit && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="form-input" placeholder="Page key" value={newPageKey} onChange={(e) => setNewPageKey(e.target.value)} />
              <input className="form-input" placeholder="Label" value={newPageLabel} onChange={(e) => setNewPageLabel(e.target.value)} />
              <button className="btn btn-outline" onClick={addCatalogPage}>Add Page</button>
              <button className="btn btn-primary" onClick={saveCatalog} disabled={saving}>Save Catalog</button>
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {pages.map((p) => p.label).join(' · ')}
          </div>
        </div>
      )}

      {isSuperAdminSession() && (
        <div className="card">
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} /> Token Expiration Settings
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 8 }}>
            Configure dynamic maximum durations for Session, Login, and Subscription cookies.
          </p>
          <form onSubmit={handleSaveTokenConfig} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Session Token (Hours)</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  className="form-input"
                  style={{ width: '100%' }}
                  value={sessionHours}
                  onChange={(e) => setSessionHours(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Login Token (Hours)</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  className="form-input"
                  style={{ width: '100%' }}
                  value={loginHours}
                  onChange={(e) => setLoginHours(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Subscription Token (Days)</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  className="form-input"
                  style={{ width: '100%' }}
                  value={subscriptionDays}
                  onChange={(e) => setSubscriptionDays(e.target.value)}
                  required
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="submit" className="btn btn-primary" disabled={tokenConfigSaving}>
                {tokenConfigSaving ? 'Saving...' : 'Update Expirations'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isSuperAdminSession() && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}><Shield size={16} /> Manage IP Rate Limits</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 8 }}>
            Lookup and update the signup limit for a specific IP address.
          </p>
        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
            <input
              className="form-input"
              placeholder="Enter IP address"
              value={ipQuery}
              onChange={(e) => setIpQuery(e.target.value.trim())}
            />
            <button className="btn btn-outline" onClick={async () => {
              if (!ipQuery) return setIpLimitError('Enter an IP address to lookup');
              setIpLimitError(null);
              setIpLimitLoading(true);
              try {
                const info = await getIpLimitApi(ipQuery);
                setIpLimit(info.limit);
                setIpUsage(info.count);
                setIpLimitLoaded(true);
              } catch (err) {
                setIpLimitError(err instanceof Error ? err.message : 'Failed to load IP limit');
                setIpLimitLoaded(false);
              } finally {
                setIpLimitLoading(false);
              }
            }} disabled={ipLimitLoading}>
              {ipLimitLoading ? 'Loading…' : 'Lookup'}
            </button>
          </div>

          {ipLimitLoaded && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Current limit</div>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  value={ipLimit}
                  onChange={(e) => setIpLimit(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Current count</div>
                <input className="form-input" type="text" value={ipUsage ?? ''} disabled />
              </div>
            </div>
          )}

          {ipLimitError && (
            <div style={{ color: 'var(--alert-red)', fontSize: '0.88rem' }}>{ipLimitError}</div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-outline" type="button" onClick={() => {
              setIpLimitLoaded(false);
              setIpLimit('');
              setIpUsage(null);
              setIpLimitError(null);
            }}>
              Reset
            </button>
            <button className="btn btn-primary" type="button" onClick={async () => {
              if (!ipQuery) return setIpLimitError('Enter an IP address to update');
              if (ipLimit === '' || Number(ipLimit) < 1) return setIpLimitError('Limit must be a positive integer');
              setIpLimitSaving(true);
              setIpLimitError(null);
              try {
                const updated = await updateIpLimitApi(ipQuery, Number(ipLimit));
                setIpLimit(updated.limit);
                setIpUsage(updated.count);
                setIpLimitLoaded(true);
                onSuccessToast?.('IP limit updated.');
              } catch (err) {
                setIpLimitError(err instanceof Error ? err.message : 'Failed to update IP limit');
              } finally {
                setIpLimitSaving(false);
              }
            }} disabled={ipLimitSaving}>
              {ipLimitSaving ? 'Saving…' : 'Save Limit'}
            </button>
          </div>
        </div>
      </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Create User</h3>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <input className="form-input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="form-input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="form-input" type="password" placeholder="Password (min 6)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
            <PlusCircle size={16} /> Create
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Users {loading ? '(loading...)' : `(${users.length})`}</h3>
        {users.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={selectedIds.length === users.length}
              ref={(el) => {
                if (el) {
                  el.indeterminate = selectedIds.length > 0 && selectedIds.length < users.length;
                }
              }}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedIds(users.map((u) => u.id));
                  setSelected(null);
                } else {
                  setSelectedIds([]);
                  setSelected(null);
                }
              }}
            />
            <span style={{ fontWeight: 600 }}>Select All ({selectedIds.length} selected)</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px', minWidth: 260 }}>
            {users.map((u) => {
              const isChecked = selectedIds.includes(u.id);
              return (
                <div
                  key={u.id}
                  className="list-item"
                  style={{ cursor: 'pointer', borderColor: selected?.id === u.id ? 'var(--primary-milk)' : undefined, opacity: u.active ? 1 : 0.65, display: 'flex', gap: 10, alignItems: 'center' }}
                  onClick={() => {
                    setSelected(u);
                    setSelectedIds([u.id]);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(u.id);
                        else next.delete(u.id);
                        const arr = Array.from(next);
                        if (arr.length === 1) {
                          setSelected(users.find((x) => x.id === arr[0]) || null);
                        } else {
                          setSelected(null);
                        }
                        return arr;
                      });
                    }}
                  />
                  <div style={{ flex: 1, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: u.active ? '#e3f2fd' : '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                      {u.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{u.email}</div>
                      {u.profile?.department && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{u.profile.department}</div>}
                    </div>
                  </div>
                  <button className="btn btn-danger" onClick={(e) => { e.stopPropagation(); handleDelete(u.id); }} disabled={saving}>
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ flex: '1 1 360px', minWidth: 320 }}>
            {selectedIds.length > 1 ? (
              <BulkOperations
                selectedIds={selectedIds}
                users={users}
                onClearSelection={() => {
                  setSelectedIds([]);
                  setSelected(null);
                }}
                onSuccessToast={onSuccessToast}
                refresh={refresh}
              />
            ) : selected ? (
              <div>
                <h4 style={{ marginTop: 0 }}>Edit — {selected.name}</h4>

                <Switch label="Account Active" checked={selected.active} onChange={(active) => persistUser({ ...selected, active, subscription: active ? selected.subscription : null })} />

                <label className="form-label" style={{ display: 'block', marginTop: 12 }}>User Profile</label>
                <div style={{ display: 'grid', gap: 8 }}>
                  <input className="form-input" placeholder="Display name" value={selected.profile?.displayName || ''} onChange={(e) => persistUser({ ...selected, profile: { ...selected.profile, displayName: e.target.value } })} />
                  <input className="form-input" placeholder="Phone" value={selected.profile?.phone || ''} onChange={(e) => persistUser({ ...selected, profile: { ...selected.profile, phone: e.target.value } })} />
                  <input className="form-input" placeholder="Department" value={selected.profile?.department || ''} onChange={(e) => persistUser({ ...selected, profile: { ...selected.profile, department: e.target.value } })} />
                  <textarea className="form-input" placeholder="Notes" rows={2} value={selected.profile?.notes || ''} onChange={(e) => persistUser({ ...selected, profile: { ...selected.profile, notes: e.target.value } })} />
                </div>

                {isSuperAdminSession() && (
                  <div style={{ marginTop: 12 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Key size={14} /> Reset Password</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="form-input" type="password" placeholder="New password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
                      <button className="btn btn-outline" disabled={!resetPassword || resetPassword.length < 6 || saving} onClick={() => { persistUser(selected, resetPassword); setResetPassword(''); }}>Set</button>
                    </div>
                  </div>
                )}

                {selected.active && isSuperAdminSession() && (
                  <div style={{ marginTop: 16, border: '1px solid var(--border-color)', borderRadius: 10, padding: 12 }}>
                    <label className="form-label" style={{ marginTop: 0 }}>Subscription &amp; Due Date</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      <select
                        className="form-input"
                        value={selected.subscription?.plan || 'monthly'}
                        onChange={(e) => persistUser({ ...selected, subscription: { ...selected.subscription, plan: e.target.value, expiresAt: selected.subscription?.expiresAt } })}
                      >
                        <option value="free">Free</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                        <option value="lifetime">Lifetime</option>
                      </select>
                      <input
                        type="date"
                        className="form-input"
                        value={selected.subscription?.expiresAt ? new Date(selected.subscription.expiresAt).toISOString().slice(0, 10) : ''}
                        onChange={(e) => {
                          const expiresAt = e.target.value ? new Date(e.target.value).getTime() : undefined;
                          persistUser({ ...selected, subscription: { plan: selected.subscription?.plan || 'monthly', ...selected.subscription, expiresAt, dueDate: expiresAt } });
                        }}
                      />
                    </div>
                    <Switch
                      label="Allow app access (renew permission)"
                      checked={Boolean(selected.permissions.canUseSubscription)}
                      onChange={() => {
                        const perms = { ...selected.permissions, canUseSubscription: !selected.permissions.canUseSubscription };
                        persistUser({ ...selected, permissions: perms });
                      }}
                    />
                    <textarea
                      className="form-input"
                      rows={2}
                      placeholder="Custom Pay Now message for this user"
                      style={{ marginTop: 8, width: '100%' }}
                      value={selected.subscription?.paymentMessage || ''}
                      onChange={(e) => persistUser({ ...selected, subscription: { plan: selected.subscription?.plan || 'monthly', ...selected.subscription, paymentMessage: e.target.value } })}
                    />
                  </div>
                )}

                {selected.active && isSuperAdminSession() && (
                  <div style={{ marginTop: 16, border: '1px solid var(--border-color)', borderRadius: 10, padding: 12 }}>
                    <label className="form-label" style={{ marginTop: 0 }}>Data Limits (built-in control)</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <input className="form-input" type="number" min={0} placeholder="Max customers (empty=unlimited)" value={selected.permissions.resourceLimits?.maxCustomers ?? ''} onChange={(e) => updateLimit('maxCustomers', e.target.value)} />
                      <input className="form-input" type="number" min={0} placeholder="Max sales (empty=unlimited)" value={selected.permissions.resourceLimits?.maxSales ?? ''} onChange={(e) => updateLimit('maxSales', e.target.value)} />
                      <input className="form-input" type="number" min={0} placeholder="Max inventory entries" value={selected.permissions.resourceLimits?.maxInventory ?? ''} onChange={(e) => updateLimit('maxInventory', e.target.value)} />
                    </div>
                    <label className="form-label" style={{ display: 'block', marginTop: 10 }}>Allowed milk categories</label>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 6px' }}>Leave all unchecked for unlimited types</p>
                    {MILK_TYPES.map((m) => (
                      <Switch
                        key={m}
                        label={m}
                        checked={!selected.permissions.resourceLimits?.allowedMilkTypes?.length || selected.permissions.resourceLimits.allowedMilkTypes.includes(m)}
                        onChange={(on) => toggleMilkType(m, on)}
                      />
                    ))}
                  </div>
                )}

                {selected.active && isSuperAdminSession() && (
                  <>
                    <label className="form-label" style={{ display: 'block', marginTop: 16 }}>Share User Data</label>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 0 }}>Select users whose sales, inventory &amp; customer data this user can view.</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      {(['own', 'shared', 'all'] as const).map((mode) => (
                        <button key={mode} type="button" className={`btn ${selected.permissions.dataAccessScope?.mode === mode ? 'btn-primary' : 'btn-outline'}`} onClick={() => updateDataScope(mode)}>
                          {mode === 'own' ? 'Own only' : mode === 'shared' ? 'Selected users' : 'All users'}
                        </button>
                      ))}
                    </div>
                    {(selected.permissions.dataAccessScope?.mode === 'shared' || selected.permissions.dataAccessScope?.mode === 'all') && (
                      <>
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 6 }}>Share with users</div>
                          {users.filter((u) => u.id !== selected.id).map((u) => (
                            <Switch
                              key={u.id}
                              label={`${u.name} (${u.email})`}
                              checked={(selected.permissions.dataAccessScope?.sharedUserIds || []).includes(u.id)}
                              onChange={(on) => toggleSharedUser(u.id, on)}
                            />
                          ))}
                        </div>
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 6 }}>Shared data types</div>
                          <Switch label="Sales data" checked={selected.permissions.dataAccessScope?.sharedRights?.sales !== false} onChange={(on) => toggleSharedRight('sales', on)} />
                          <Switch label="Inventory data" checked={selected.permissions.dataAccessScope?.sharedRights?.inventory !== false} onChange={(on) => toggleSharedRight('inventory', on)} />
                          <Switch label="Customers (create/view)" checked={selected.permissions.dataAccessScope?.sharedRights?.customers !== false} onChange={(on) => toggleSharedRight('customers', on)} />
                        </div>
                      </>
                    )}
                  </>
                )}

                {selected.active && (
                  <>
                    <label className="form-label" style={{ display: 'block', marginTop: 16 }}>Page Permissions (CRUD matrix)</label>
                    {pages.map((page) => (
                      <div key={page.key} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>{page.label}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {page.actions.map((action) => {
                            const checked = (selected.permissions.pagePermissions?.[page.key] || []).includes(action);
                            return (
                              <label key={action} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem' }}>
                                <input type="checkbox" checked={checked} onChange={() => togglePageAction(page.key, action)} />
                                {ACTION_LABELS[action]}
                              </label>
                            );
                          })}
                        </div>
                        {(catalog?.fields?.[page.key] || []).length > 0 && (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border-color)' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 4 }}>Field access</div>
                            {(catalog?.fields?.[page.key] || []).map((field: CatalogField) => (
                              <Switch
                                key={field.key}
                                label={field.label}
                                checked={selected.permissions.fieldPermissions?.[page.key]?.[field.key] !== false}
                                onChange={(on) => toggleField(page.key, field.key, on)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)' }}>Select a user to manage profile, password, permissions, and data sharing.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
