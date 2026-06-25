"use client";

import React, { useEffect, useState } from 'react';
import Repository, { UserModel, PermissionSet } from '@/lib/repository';
import { getCurrentUser } from '@/lib/permissions';
import { PlusCircle, Users, ArrowLeft, Trash2 } from 'lucide-react';

interface AdminSettingsProps {
  onBack: () => void;
  onSuccessToast?: () => void;
}

export default function AdminSettings({ onBack, onSuccessToast }: AdminSettingsProps) {
  const [users, setUsers] = useState<UserModel[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState<UserModel | null>(null);

  useEffect(() => {
    setUsers(Repository.getUsers());
  }, []);

  const refresh = () => setUsers(Repository.getUsers());

  const handleCreate = () => {
    if (!email || !name) return alert('Name and email required');
    const u = Repository.saveUser({ name, email });
    setName('');
    setEmail('');
    refresh();
    onSuccessToast?.();
    setSelected(u);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this user?')) return;
    Repository.deleteUser(id);
    refresh();
    if (selected && selected.id === id) setSelected(null);
    onSuccessToast?.();
  };

  const handleTogglePerm = (key: keyof PermissionSet) => {
    if (!selected) return;
    // only superadmin may toggle canViewOthers
    if (key === 'canViewOthers') {
      const cur = getCurrentUser();
      if (!cur || cur.role !== 'superadmin') return alert('Only Super Admin can grant view-other permissions');
    }

    const newPerms = { ...selected.permissions, [key]: !selected.permissions[key] } as PermissionSet;
    Repository.updateUserPermissions(selected.id, newPerms);
    setSelected({ ...selected, permissions: newPerms });
    refresh();
  };

  const handleSubscriptionChange = (plan: string, expires?: string) => {
    if (!selected) return;
    const now = Date.now();
    const expiresAt = expires ? new Date(expires).getTime() : undefined;
    const updated = { ...selected, subscription: { plan, expiresAt }, updatedAt: Date.now() } as UserModel;
    Repository.saveUser(updated);
    setSelected(updated);
    refresh();
    onSuccessToast?.();
  };

  const handleAllowPageToggle = (page: string) => {
    if (!selected) return;
    const allowed = new Set(selected.permissions.allowedPages || []);
    if (allowed.has(page)) allowed.delete(page); else allowed.add(page);
    const newPerms = { ...selected.permissions, allowedPages: Array.from(allowed) } as PermissionSet;
    Repository.updateUserPermissions(selected.id, newPerms);
    setSelected({ ...selected, permissions: newPerms });
    refresh();
  };

  const handleSwitchView = (u: UserModel) => {
    const cur = getCurrentUser();
    if (cur && cur.role !== 'superadmin' && !cur.permissions.canViewOthers) return alert('Only super admin can switch view to other users');
    Repository.setCurrentUser(u.id);
    onSuccessToast?.();
    alert('Switched view to ' + u.name);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-outline" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}><Users size={18} style={{ marginRight: 8 }} /> Admin Controls</h2>
        <div />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Create / Invite User</h3>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input className="form-input" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
          <input className="form-input" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <button className="btn btn-primary" onClick={handleCreate}><PlusCircle size={16} /> Create</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Users</h3>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            {users.map(u => (
              <div key={u.id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => setSelected(u)}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{u.name?.charAt(0) || '?'}</div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{u.email}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="btn btn-outline" onClick={(e) => { e.stopPropagation(); handleSwitchView(u); }}>View as</button>
                  <button className="btn btn-danger" onClick={(e) => { e.stopPropagation(); handleDelete(u.id); }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ width: 420 }}>
            {selected ? (
              <div>
                <h4 style={{ marginTop: 0 }}>Edit — {selected.name}</h4>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <input className="form-input" value={selected.role} readOnly />
                </div>

                <div className="form-group">
                  <label className="form-label">Subscription</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select className="form-input" defaultValue={selected.subscription?.plan || 'free'} onChange={(e) => handleSubscriptionChange(e.target.value, selected.subscription?.expiresAt ? new Date(selected.subscription.expiresAt).toISOString().slice(0,10) : undefined)}>
                      <option value="free">Free</option>
                      <option value="monthly">Monthly</option>
                      <option value="lifetime">Lifetime</option>
                    </select>
                    <input type="date" className="form-input" defaultValue={selected.subscription?.expiresAt ? new Date(selected.subscription.expiresAt).toISOString().slice(0,10) : ''} onChange={(e) => handleSubscriptionChange(selected.subscription?.plan || 'free', e.target.value)} />
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button className={`btn ${selected.permissions.canUseSubscription ? 'btn-primary' : 'btn-outline'}`} onClick={() => { const newPerms = { ...selected.permissions, canUseSubscription: !selected.permissions.canUseSubscription } as PermissionSet; Repository.updateUserPermissions(selected.id, newPerms); setSelected({ ...selected, permissions: newPerms }); refresh(); }}>{selected.permissions.canUseSubscription ? 'Subscription Enabled' : 'Enable Subscription'}</button>
                    <button className="btn btn-outline" onClick={() => handleSubscriptionChange('free')}>Set Free / Remove</button>
                  </div>
                  {selected.subscription?.expiresAt && Date.now() > selected.subscription.expiresAt && (
                    <div style={{ marginTop: 8, color: 'var(--alert-red)', fontWeight: 700 }}>Subscription expired</div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <label className="form-label">Permissions</label>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className={`btn ${selected.permissions.canCreate ? 'btn-primary' : 'btn-outline'}`} onClick={() => handleTogglePerm('canCreate')}>Create</button>
                  <button className={`btn ${selected.permissions.canRead ? 'btn-primary' : 'btn-outline'}`} onClick={() => handleTogglePerm('canRead')}>Read</button>
                  <button className={`btn ${selected.permissions.canUpdate ? 'btn-primary' : 'btn-outline'}`} onClick={() => handleTogglePerm('canUpdate')}>Update</button>
                  <button className={`btn ${selected.permissions.canDelete ? 'btn-danger' : 'btn-outline'}`} onClick={() => handleTogglePerm('canDelete')}>Delete</button>
                </div>

                <div style={{ marginTop: 12 }}>
                  <label className="form-label">Page Access</label>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {['Dashboard','Sales','Bills','Inventory','Profiles','Reports','Settings'].map(p => (
                      <button key={p} className={`btn ${selected.permissions.allowedPages.includes(p) ? 'btn-primary' : 'btn-outline'}`} onClick={() => handleAllowPageToggle(p)}>{p}</button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)' }}>Select a user to edit permissions and view options.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
