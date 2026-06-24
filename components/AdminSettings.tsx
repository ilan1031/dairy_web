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
} from '@/lib/dataApi';
import { PlusCircle, Users, ArrowLeft, Trash2, Loader2, Shield, Key } from 'lucide-react';

interface AdminSettingsProps {
  onBack: () => void;
  onSuccessToast?: (message?: string) => void;
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalogEdit, setCatalogEdit] = useState(false);
  const [newPageKey, setNewPageKey] = useState('');
  const [newPageLabel, setNewPageLabel] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [data, cat] = await Promise.all([
        listUsersApi(),
        getCatalogApi().catch(() => Repository.getPermissionCatalog()),
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

  useEffect(() => {
    refresh();
  }, []);

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
        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px', minWidth: 260 }}>
            {users.map((u) => (
              <div
                key={u.id}
                className="list-item"
                style={{ cursor: 'pointer', borderColor: selected?.id === u.id ? 'var(--primary-milk)' : undefined, opacity: u.active ? 1 : 0.65 }}
                onClick={() => setSelected(u)}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
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
            ))}
          </div>

          <div style={{ flex: '1 1 360px', minWidth: 320 }}>
            {selected ? (
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
