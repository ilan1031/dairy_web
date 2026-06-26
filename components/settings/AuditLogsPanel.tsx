'use client';

import React, { useEffect, useState } from 'react';
import Repository from '@/lib/repository';
import { hasPageAction, isSuperAdminSession } from '@/lib/permissions';
import { listAuditApi } from '@/lib/dataApi';
import type { AuditLogEntry } from '@/lib/auditLog';
import { formatAuditAction } from '@/lib/auditLog';
import { ArrowLeft, Search, RefreshCw, Download, ClipboardList } from 'lucide-react';
import CowLoading from '@/components/ui/CowLoading';

interface AuditLogsPanelProps {
  onBack: () => void;
}

export default function AuditLogsPanel({ onBack }: AuditLogsPanelProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const limit = 25;

  const canExport = hasPageAction('Settings', 'export') || isSuperAdminSession();

  const loadLogs = async () => {
    setLoading(true);
    try {
      const selectedUserId = Repository.isSuperAdmin() ? undefined : (Repository.getCurrentUser()?.id || undefined);
      const result = await listAuditApi({
        page,
        limit,
        search,
        resourceType: resourceFilter || undefined,
        selectedUserId,
      });
      setLogs((result.logs || []) as unknown as AuditLogEntry[]);
      setTotal(result.total);
      setPages(result.pages);
    } catch {
      const fallback = Repository.getAuditLogs({ page, limit, search, resourceType: resourceFilter || undefined });
      setLogs(fallback.logs);
      setTotal(fallback.total);
      setPages(fallback.pages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [page, search, resourceFilter]);

  const handleExport = () => {
    const data = Repository.exportAuditLogs();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DairySync_AuditLogs_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const actionColor = (action: string) => {
    if (action.includes('DELETE')) return 'var(--alert-red)';
    if (action.includes('UPDATE') || action.includes('CONFIG') || action.includes('PRICE')) return 'var(--primary-milk)';
    if (action.includes('CREATE') || action.includes('SALE')) return 'var(--organic-green)';
    return 'var(--primary-gold)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-outline" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ClipboardList size={20} /> Audit Logs
        </h2>
        <div />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            className="form-input"
            placeholder="Search actions, users, resources..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ paddingLeft: 36, width: '100%' }}
          />
        </div>
        <select
          className="form-input"
          value={resourceFilter}
          onChange={e => { setResourceFilter(e.target.value); setPage(1); }}
          style={{ minWidth: 160 }}
        >
          <option value="">All resources</option>
          <option value="sale">Sales</option>
          <option value="customer">Customers</option>
          <option value="billing_config">Billing Config</option>
          <option value="price_config">Price Config</option>
          <option value="user">Users</option>
        </select>
        <button className="btn btn-outline" onClick={loadLogs} disabled={loading}>
          {loading ? <CowLoading size="xs" inline /> : <><RefreshCw size={14} /> Refresh</>}
        </button>
        {canExport && (
          <button className="btn btn-outline" onClick={handleExport}><Download size={14} /> Export</button>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading && <CowLoading size="xs" inline />}
          {total} total entries
        </div>

        {logs.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
            No audit logs found.
          </div>
        ) : (
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {logs.map(log => (
              <div
                key={log.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'grid',
                  gridTemplateColumns: 'minmax(120px, 1fr) minmax(100px, 0.8fr) minmax(80px, 0.6fr) minmax(100px, 0.8fr) 1fr',
                  gap: 12,
                  alignItems: 'start',
                  fontSize: '0.82rem',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{new Date(log.createdAt).toLocaleString()}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{log.id}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{log.userName}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{log.userEmail || log.userId}</div>
                </div>
                <div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 6, fontWeight: 800, fontSize: '0.72rem',
                    color: actionColor(log.action),
                    backgroundColor: `color-mix(in srgb, ${actionColor(log.action)} 12%, transparent)`,
                  }}>
                    {formatAuditAction(log.action)}
                  </span>
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{log.resourceType}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    {log.resourceId || '—'}
                  </div>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', wordBreak: 'break-word' }}>
                  {log.details ? JSON.stringify(log.details) : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <button className="btn btn-outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
          <span style={{ padding: '8px 12px', fontSize: '0.85rem' }}>Page {page} of {pages}</span>
          <button className="btn btn-outline" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

