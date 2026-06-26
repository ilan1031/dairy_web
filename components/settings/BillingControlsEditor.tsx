'use client';

import React, { useEffect, useState } from 'react';
import Repository from '@/lib/repository';
import { hasPageAction, isSuperAdminSession } from '@/lib/permissions';
import {
  BillingConfig,
  PaymentIconKey,
  PaymentMethodConfig,
  normalizeBillingConfig,
} from '@/lib/billingConfig';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  CreditCard,
  DollarSign,
  Building,
  Clock,
  Wallet,
  QrCode,
  Lock,
  X,
} from 'lucide-react';
import CowLoading from '@/components/ui/CowLoading';

interface BillingControlsEditorProps {
  onBack: () => void;
  onSuccessToast?: () => void;
}

const ICON_OPTIONS: { key: PaymentIconKey; label: string }[] = [
  { key: 'dollar', label: 'Cash' },
  { key: 'credit-card', label: 'Card' },
  { key: 'building', label: 'Bank' },
  { key: 'clock', label: 'Pending' },
  { key: 'wallet', label: 'Wallet' },
  { key: 'qr', label: 'QR' },
];

const COLOR_OPTIONS = [
  { value: 'var(--organic-green)', label: 'Green' },
  { value: 'var(--primary-gold)', label: 'Gold' },
  { value: 'var(--primary-milk)', label: 'Blue' },
  { value: 'var(--alert-red)', label: 'Red' },
];

function renderIconPreview(icon: PaymentIconKey, size = 16) {
  switch (icon) {
    case 'credit-card': return <CreditCard size={size} />;
    case 'building': return <Building size={size} />;
    case 'clock': return <Clock size={size} />;
    case 'wallet': return <Wallet size={size} />;
    case 'qr': return <QrCode size={size} />;
    default: return <DollarSign size={size} />;
  }
}

export default function BillingControlsEditor({ onBack, onSuccessToast }: BillingControlsEditorProps) {
  const [config, setConfig] = useState<BillingConfig>(() => normalizeBillingConfig(null));
  const [loaded, setLoaded] = useState(false);
  const [presetInput, setPresetInput] = useState('');
  const [newMethod, setNewMethod] = useState<PaymentMethodConfig>({
    code: '',
    label: '',
    color: 'var(--primary-milk)',
    icon: 'dollar',
    enabled: true,
  });

  useEffect(() => {
    Repository.ensureReady()
      .then(() => setConfig(Repository.getBillingConfig()))
      .catch(console.error)
      .finally(() => setLoaded(true));
  }, []);

  const canEdit = hasPageAction('Settings', 'edit') || isSuperAdminSession();

  const handleSave = () => {
    if (!canEdit) return alert('Permission denied');
    if (!window.confirm('Save billing control settings?')) return;
    Repository.saveBillingConfig(config, { changes: 'billing_controls' });
    onSuccessToast?.();
    alert('Billing controls saved.');
  };

  const toggleMethod = (code: string) => {
    setConfig(prev => ({
      ...prev,
      paymentMethods: prev.paymentMethods.map(m =>
        m.code === code ? { ...m, enabled: !m.enabled } : m
      ),
    }));
  };

  const updateMethod = (code: string, patch: Partial<PaymentMethodConfig>) => {
    setConfig(prev => ({
      ...prev,
      paymentMethods: prev.paymentMethods.map(m =>
        m.code === code ? { ...m, ...patch } : m
      ),
    }));
  };

  const removeMethod = (code: string) => {
    const method = config.paymentMethods.find(m => m.code === code);
    if (method?.lockDelete) return alert('This payment method is locked from deletion.');
    if (!window.confirm(`Remove payment method "${code}"?`)) return;
    setConfig(prev => ({
      ...prev,
      paymentMethods: prev.paymentMethods.filter(m => m.code !== code),
    }));
  };

  const addMethod = () => {
    const code = newMethod.code.trim().toUpperCase();
    const label = (newMethod.label || code).trim();
    if (!code) return alert('Code is required');
    if (!/^[A-Z0-9_]{2,12}$/.test(code)) return alert('Use 2–12 uppercase letters/numbers');
    if (config.paymentMethods.some(m => m.code === code)) return alert('Duplicate code');
    setConfig(prev => ({
      ...prev,
      paymentMethods: [...prev.paymentMethods, { ...newMethod, code, label, enabled: true }],
    }));
    setNewMethod({ code: '', label: '', color: 'var(--primary-milk)', icon: 'dollar', enabled: true });
  };

  const addPreset = () => {
    const val = parseFloat(presetInput);
    if (isNaN(val) || val <= 0) return alert('Enter a valid volume');
    if (config.volumePresets.includes(val)) return alert('Preset already exists');
    setConfig(prev => ({
      ...prev,
      volumePresets: [...prev.volumePresets, val].sort((a, b) => a - b),
    }));
    setPresetInput('');
  };

  const removePreset = (val: number) => {
    setConfig(prev => ({
      ...prev,
      volumePresets: prev.volumePresets.filter(v => v !== val),
    }));
  };

  const resetDefaults = () => {
    if (!window.confirm('Reset billing controls to defaults?')) return;
    setConfig(normalizeBillingConfig(null));
  };

  if (!loaded) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <CowLoading message="Loading billing settings from server..." size="md" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-outline" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Billing Controls</h2>
        <div />
      </div>

      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        Configure payment modes, volume presets, and billing form behavior — same pattern as asset master settings.
      </p>

      {/* Payment Methods */}
      <div className="card">
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CreditCard size={18} style={{ color: 'var(--primary-milk)' }} />
          Payment Methods
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {config.paymentMethods.map(method => (
            <div
              key={method.code}
              className="card"
              style={{
                padding: 14,
                borderLeft: `4px solid ${method.color}`,
                opacity: method.enabled ? 1 : 0.65,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: method.color, color: '#fff',
                  }}>
                    {renderIconPreview(method.icon)}
                  </div>
                  <div>
                    <strong>{method.label}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{method.code}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={method.enabled}
                      disabled={!canEdit}
                      onChange={() => toggleMethod(method.code)}
                    />
                    Enabled
                  </label>
                  {!method.lockDelete && canEdit && (
                    <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => removeMethod(method.code)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                  {method.lockDelete && (
                    <span title="Locked" style={{ color: 'var(--primary-gold)' }}><Lock size={14} /></span>
                  )}
                </div>
              </div>

              {canEdit && !method.lockEdit && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 12 }}>
                  <input
                    className="form-input"
                    value={method.label}
                    onChange={e => updateMethod(method.code, { label: e.target.value })}
                    placeholder="Label"
                  />
                  <select
                    className="form-input"
                    value={method.icon}
                    onChange={e => updateMethod(method.code, { icon: e.target.value as PaymentIconKey })}
                  >
                    {ICON_OPTIONS.map(opt => (
                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                  </select>
                  <select
                    className="form-input"
                    value={method.color}
                    onChange={e => updateMethod(method.code, { color: e.target.value })}
                  >
                    {COLOR_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={!!method.marksPending}
                      onChange={e => updateMethod(method.code, { marksPending: e.target.checked })}
                    />
                    Marks as pending debt
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>

        {canEdit && (
          <div style={{ marginTop: 16, padding: 14, border: '1px dashed var(--border-color)', borderRadius: 12 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem' }}>Add Payment Method</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
              <input className="form-input" placeholder="CODE" value={newMethod.code}
                onChange={e => setNewMethod(prev => ({ ...prev, code: e.target.value.toUpperCase() }))} />
              <input className="form-input" placeholder="Label" value={newMethod.label}
                onChange={e => setNewMethod(prev => ({ ...prev, label: e.target.value }))} />
              <select className="form-input" value={newMethod.icon}
                onChange={e => setNewMethod(prev => ({ ...prev, icon: e.target.value as PaymentIconKey }))}>
                {ICON_OPTIONS.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
              </select>
              <button className="btn btn-primary" onClick={addMethod}><Plus size={14} /> Add</button>
            </div>
          </div>
        )}
      </div>

      {/* Volume Presets */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Volume Presets (Liters)</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {config.volumePresets.map(val => (
            <span key={val} style={{
              padding: '6px 12px', borderRadius: 16, backgroundColor: 'var(--input-bg)',
              border: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.85rem',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {val} L
              {canEdit && (
                <button type="button" onClick={() => removePreset(val)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--alert-red)', padding: 0 }}>
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" step="0.01" className="form-input" placeholder="e.g. 3.5"
              value={presetInput} onChange={e => setPresetInput(e.target.value)} style={{ maxWidth: 140 }} />
            <button className="btn btn-outline" onClick={addPreset}><Plus size={14} /> Add Preset</button>
          </div>
        )}
      </div>

      {/* Form Behavior */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Billing Form Behavior</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { key: 'allowCustomRate' as const, label: 'Allow custom rate entry' },
            { key: 'requireLocation' as const, label: 'Require location field' },
            { key: 'showStockWarnings' as const, label: 'Show stock balance warnings' },
          ].map(item => (
            <label key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 8 }}>
              <span style={{ fontSize: '0.9rem' }}>{item.label}</span>
              <input
                type="checkbox"
                checked={config[item.key]}
                disabled={!canEdit}
                onChange={e => setConfig(prev => ({ ...prev, [item.key]: e.target.checked }))}
                style={{ width: 18, height: 18 }}
              />
            </label>
          ))}

          <div className="form-group">
            <label className="form-label">Default location stamp</label>
            <input
              className="form-input"
              value={config.defaultLocation}
              disabled={!canEdit}
              onChange={e => setConfig(prev => ({ ...prev, defaultLocation: e.target.value }))}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Max volume (L)</label>
              <input type="number" className="form-input" value={config.maxVolume}
                disabled={!canEdit}
                onChange={e => setConfig(prev => ({ ...prev, maxVolume: parseFloat(e.target.value) || 200 }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Volume step (L)</label>
              <input type="number" step="0.01" className="form-input" value={config.volumeStep}
                disabled={!canEdit}
                onChange={e => setConfig(prev => ({ ...prev, volumeStep: parseFloat(e.target.value) || 0.25 }))} />
            </div>
          </div>
        </div>
      </div>

      {canEdit && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>
            <Save size={16} /> Save Billing Controls
          </button>
          <button className="btn btn-outline" onClick={resetDefaults}>Reset Defaults</button>
        </div>
      )}
    </div>
  );
}
