// d:/Gitfiles/dairy/dairy-web/components/SettingsTab.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage, useTheme } from '@/app/providers';
import Repository, { PriceConfig, PriceLog, MilkInventory } from '@/lib/repository';
import { 
  Settings, 
  User, 
  Palette, 
  Database, 
  HelpCircle, 
  Check, 
  Layers, 
  Calendar,
  Save,
  ChevronRight
} from 'lucide-react';
import InventoryTab from './InventoryTab';
import AdminSettings from './AdminSettings';
import { hasPermission } from '@/lib/permissions';

interface SettingsTabProps {
  viewAsUserId?: string;
  onSuccessToast: () => void;
  onLogout: () => void;
}

export default function SettingsTab({ onSuccessToast, onLogout }: SettingsTabProps) {
  const { t, language, setLanguage } = useLanguage();
  const { isLightTheme, setLightTheme } = useTheme();

  // Profile Form state
  const [bName, setBName] = useState('');
  const [oName, setOName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');

  // Sub-view trigger for Inventory
  const [showInventory, setShowInventory] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  // Register Customer Profile Ledger (mobile alignment)
  const [registerName, setRegisterName] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [qrPreferenceChoice, setQrPreferenceChoice] = useState('UPI');

  useEffect(() => {
    const profile = Repository.getProfile();
    setBName(profile.businessName);
    setOName(profile.ownerName);
    setPhone(profile.mobileNumber);
    setEmail(profile.emailAddress);
    
    // Unmask password in state from localStorage
    const savedPass = localStorage.getItem('dairy_raw_password') || 'SuperAdmin_123';
    setPass(savedPass);
  }, []);

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission('canUpdate')) return alert('Permission denied');
    if (!window.confirm(t('Are you sure you want to save your profile settings?'))) return;

    Repository.saveProfile({
      businessName: bName,
      ownerName: oName,
      mobileNumber: phone,
      emailAddress: email
    });
    // Save plain password in localStorage (non-masked state)
    localStorage.setItem('dairy_raw_password', pass);
    onSuccessToast();
  };

  const handleAddCustomer = async () => {
    if (!hasPermission('canCreate')) return alert('Permission denied');
    if (!registerName.trim()) return;

    await Repository.saveCustomer({
      id: `cust_${Date.now()}`,
      name: registerName.trim(),
      phone: registerPhone,
      qrPreference: qrPreferenceChoice,
      updatedAt: Date.now()
    });
    setRegisterName('');
    setRegisterPhone('');
    setQrPreferenceChoice('UPI');
    onSuccessToast();
  };

  const handleBackup = () => {
    // Standard json export
    const backupData = {
      customers: localStorage.getItem('dairy_customers') || '[]',
      sales: localStorage.getItem('dairy_sales') || '[]',
      prices: localStorage.getItem('dairy_prices') || '[]',
      priceLogs: localStorage.getItem('dairy_price_logs') || '[]',
      inventory: localStorage.getItem('dairy_inventory') || '[]',
      profile: localStorage.getItem('dairy_profile') || '{}'
    };

    const str = JSON.stringify(backupData);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DairySync_Backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onSuccessToast();
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string);
        if (backup.profile) {
          localStorage.setItem('dairy_customers', backup.customers);
          localStorage.setItem('dairy_sales', backup.sales);
          localStorage.setItem('dairy_prices', backup.prices);
          localStorage.setItem('dairy_price_logs', backup.priceLogs);
          localStorage.setItem('dairy_inventory', backup.inventory);
          localStorage.setItem('dairy_profile', backup.profile);
          alert('Ledger restored successfully! Reloading...');
          window.location.reload();
        } else {
          alert('Invalid backup file structure.');
        }
      } catch (err) {
        alert('Failed to parse backup file.');
      }
    };
    reader.readAsText(file);
  };

  // If sub-view inventory is active, render it
  if (showInventory) {
    return (
      <InventoryTab 
        onBack={() => {
          setShowInventory(false);
          onSuccessToast();
        }} 
      />
    );
  }

  if (showAdmin) {
    return (
      <AdminSettings
        onBack={() => {
          setShowAdmin(false);
          onSuccessToast();
        }}
        onSuccessToast={onSuccessToast}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Settings Header */}
      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>{t('Settings')}</h2>

      <div className="grid-cols-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Profile settings */}
          <div className="card">
            <h3 style={{ fontSize: '1.15rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={18} style={{ color: 'var(--primary-milk)' }} />
              {t('Business ERP Profile Settings')}
            </h3>

            <form onSubmit={handleUpdateProfile}>
              <div className="form-group">
                <label className="form-label">{t('Cooperative Business Name')}</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={bName}
                  onChange={(e) => setBName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('Owner Full Name')}</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={oName}
                  onChange={(e) => setOName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('Logistics Phone Contact')}</label>
                <input 
                  type="tel" 
                  className="form-input" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('Primary Email Address')}</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('ERP Security Password')}</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
                <Save size={16} />
                {t('Update Profile')}
              </button>
            </form>
          </div>

          {/* Register Customer Profile Ledger (mobile alignment) */}
          <div className="card">
            <h3 style={{ fontSize: '1.15rem', marginBottom: '8px', fontWeight: 800 }}>
              {t('Register Customer Profile Ledger')}
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Add dairy sync profile
            </p>

            <div className="form-group">
              <label className="form-label">{t('Customer/Retail Outlet Name')}</label>
              <input
                type="text"
                className="form-input"
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                placeholder="e.g. Arun Sharma"
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('Phone Number')}</label>
              <input
                type="tel"
                className="form-input"
                value={registerPhone}
                onChange={(e) => setRegisterPhone(e.target.value)}
                placeholder="9876543210"
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('Preferred QR Sync method')}:</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['UPI', 'CASH'].map(method => (
                  <button
                    key={method}
                    type="button"
                    className={`btn ${qrPreferenceChoice === method ? 'btn-primary' : 'btn-outline'}`}
                    style={{ flex: 1 }}
                    onClick={() => setQrPreferenceChoice(method)}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleAddCustomer} style={{ width: '100%' }}>
              {t('Add New Customer')}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Inventory Navigation Card */}
          <div className="card" onClick={() => setShowInventory(true)} style={{ cursor: 'pointer', borderLeft: '4px solid var(--primary-gold)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <Layers size={22} style={{ color: 'var(--primary-gold)' }} />
              <div>
                <h4 style={{ margin: 0, fontSize: '1.05rem' }}>{t('Milk Stock Inventory')}</h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {t('Manage Daily Milk Inventory')} & Pricing Rates
                </p>
              </div>
            </div>
            <ChevronRight size={20} style={{ color: 'var(--text-secondary)' }} />
          </div>

          {/* Theme & Language Card */}
          <div className="card">
            <h3 style={{ fontSize: '1.15rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Palette size={18} style={{ color: 'var(--primary-gold)' }} />
              {t('Interface Appearance')}
            </h3>

            {/* Language Selector */}
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">System Language</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={`btn ${language === 'en' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ flex: 1 }}
                  onClick={() => setLanguage('en')}
                >
                  English
                </button>
                <button 
                  className={`btn ${language === 'ta' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ flex: 1 }}
                  onClick={() => setLanguage('ta')}
                >
                  தமிழ்
                </button>
              </div>
            </div>

            {/* Theme Toggle */}
            <div className="form-group">
              <label className="form-label">{t('Interface Appearance')}</label>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.9rem' }}>{t('Enable Light Theme')}</span>
                <input 
                  type="checkbox" 
                  checked={isLightTheme}
                  onChange={(e) => setLightTheme(e.target.checked)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>

          {/* Local Backup Card */}
          <div className="card">
            <h3 style={{ fontSize: '1.15rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} style={{ color: 'var(--organic-green)' }} />
              {t('Local Backups & Subscriptions')}
            </h3>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={handleBackup} style={{ flex: 1 }}>
                {t('Local Backup')}
              </button>

              {hasPermission('canUpdate') || hasPermission('superadmin') ? (
                <button className="btn btn-outline" onClick={() => setShowAdmin(true)} style={{ flex: 1 }}>
                  {t('Admin Controls')}
                </button>
              ) : null}

              <label className="btn btn-outline" style={{ flex: 1, cursor: 'pointer', textAlign: 'center' }}>
                {t('Cloud Restore')}
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={handleRestore} 
                  style={{ display: 'none' }}
                />
              </label>
            </div>
            
            <button className="btn btn-danger" onClick={onLogout} style={{ width: '100%', marginTop: '16px' }}>
              {t('Logout from ERP Console')}
            </button>
          </div>

          {/* System Integrity & License */}
          <div className="card card-premium" style={{ borderLeftColor: 'var(--organic-green)', backgroundColor: 'var(--input-bg)' }}>
            <h4 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--organic-green)', margin: 0 }}>
              <HelpCircle size={18} />
              {t('License Status')}: {t('PREMIUM LIFETIME')}
            </h4>
            <p style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {t('Your application is fully licensed for life! This offline terminal database is unlocked, protected, and secure.')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
