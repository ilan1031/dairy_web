'use client';

import React, { useEffect, useState } from 'react';
import Repository, { BrandingConfig } from '@/lib/repository';
import { hasPageAction, isSuperAdminSession } from '@/lib/permissions';
import { ArrowLeft, Save, Droplet } from 'lucide-react';
import CowLoading from '@/components/ui/CowLoading';
import { useLanguage } from '@/app/providers';

interface BrandingControlsEditorProps {
  onBack: () => void;
  onSuccessToast?: () => void;
}

export default function BrandingControlsEditor({ onBack, onSuccessToast }: BrandingControlsEditorProps) {
  const { t } = useLanguage();
  const [config, setConfig] = useState<BrandingConfig>({
    bankName: '',
    systemName: '',
    logo: '',
    address: '',
    updatedAt: 0,
  });
  const [loaded, setLoaded] = useState(false);
  const [logoPreview, setLogoPreview] = useState('');

  useEffect(() => {
    Repository.ensureReady()
      .then(() => {
        const brand = Repository.getBrandingConfig();
        setConfig(brand);
        setLogoPreview(brand.logo || '/abielan_app_logo.png');
      })
      .catch(console.error)
      .finally(() => setLoaded(true));
  }, []);

  const canEdit = hasPageAction('Settings', 'edit') || isSuperAdminSession();

  const handleSave = async () => {
    if (!canEdit) return alert(t('Permission denied'));
    if (!window.confirm(t('Save branding settings?'))) return;

    await Repository.saveBrandingConfig(config, { section: 'branding' });
    onSuccessToast?.();
    alert(t('Branding settings saved successfully!'));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2000000) {
      alert(t('Logo image must be smaller than 2MB'));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setConfig(prev => ({ ...prev, logo: base64 }));
      setLogoPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  if (!loaded) {
    return <CowLoading message={t('Loading branding config...')} size="md" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-outline" onClick={onBack}>
          <ArrowLeft size={16} /> {t('Back')}
        </button>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Droplet size={20} style={{ color: 'var(--primary-milk)' }} />
          {t('Branding settings')}
        </h2>
        <div>
          {canEdit && (
            <button className="btn btn-primary" onClick={handleSave}>
              <Save size={16} /> {t('Save')}
            </button>
          )}
        </div>
      </div>

      <div className="grid-cols-2" style={{ gap: 20 }}>
        {/* Left Side: General Info */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 700 }}>
            {t('System Branding')}
          </h3>

          <div className="form-group">
            <label className="form-label">{t('Cooperative Business Name')}</label>
            <input
              type="text"
              className="form-input"
              value={config.bankName}
              onChange={e => setConfig(prev => ({ ...prev, bankName: e.target.value }))}
              placeholder="e.g. Ganga Premium Dairy"
              disabled={!canEdit}
              maxLength={100}
            />
            <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
              {config.bankName.length}/100
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">{t('System Header / App Name')}</label>
            <input
              type="text"
              className="form-input"
              value={config.systemName}
              onChange={e => setConfig(prev => ({ ...prev, systemName: e.target.value }))}
              placeholder="e.g. Dairy ERP"
              disabled={!canEdit}
              maxLength={100}
            />
            <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
              {config.systemName.length}/100
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">{t('Depot / Farm Address')}</label>
            <textarea
              className="form-input"
              value={config.address}
              onChange={e => setConfig(prev => ({ ...prev, address: e.target.value }))}
              placeholder="e.g. 123 Dairy Farm Lane, Cooperative Hub"
              disabled={!canEdit}
              maxLength={500}
              rows={4}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
            <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
              {config.address.length}/500
            </p>
          </div>
        </div>

        {/* Right Side: Logo Customization */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', justifyContent: 'center' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 700, width: '100%' }}>
            {t('Depot Logo')}
          </h3>

          <div style={{
            width: 140,
            height: 140,
            borderRadius: 16,
            border: '2px dashed var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            backgroundColor: 'var(--input-bg)',
            position: 'relative'
          }}>
            {logoPreview ? (
              <img src={logoPreview} alt="Depot Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('No Logo')}</span>
            )}
          </div>

          {canEdit && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 8 }}>
              <label className="btn btn-outline" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: 8 }}>
                {t('Upload Logo Image')}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  style={{ display: 'none' }}
                />
              </label>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>{t('Or Paste Logo URL')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={config.logo.startsWith('data:') ? '' : config.logo}
                  onChange={e => {
                    setConfig(prev => ({ ...prev, logo: e.target.value }));
                    setLogoPreview(e.target.value || '/abielan_app_logo.png');
                  }}
                  placeholder="https://example.com/logo.jpg"
                  style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
