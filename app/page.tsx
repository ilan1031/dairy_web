// d:/Gitfiles/dairy/dairy-web/app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { AppSettingsProvider, useLanguage, useTheme } from './providers';
import Repository, { Sale, Customer, UserModel } from '@/lib/repository';
import { apiPost } from '@/lib/api';
import { whoamiApi, logoutApi } from '@/lib/authApi';
import { canAccessPage } from '@/lib/permissions';
import { getSubscriptionStatus } from '@/lib/subscription';
import AppToast, { ToastType } from '@/components/AppToast';
import PayNowScreen from '@/components/PayNowScreen';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Receipt, 
  BarChart3, 
  Settings as SettingsIcon,
  Sun,
  Moon,
  LogOut,
  Droplet,
  Eye,
  EyeOff
} from 'lucide-react';

// Lazy load heavy components to increase speed & prevent hangs
const DashboardTab = dynamic(() => import('@/components/DashboardTab'), { ssr: false });
const SalesTab = dynamic(() => import('@/components/SalesTab'), { ssr: false });
const ProfilesTab = dynamic(() => import('@/components/ProfilesTab'), { ssr: false });
const BillsTab = dynamic(() => import('@/components/BillsTab'), { ssr: false });
const ReportsTab = dynamic(() => import('@/components/ReportsTab'), { ssr: false });
const SettingsTab = dynamic(() => import('@/components/SettingsTab'), { ssr: false });
const InvoiceDetailDialog = dynamic(() => import('@/components/InvoiceDetailDialog'), { ssr: false });

export default function Home() {
  return (
    <AppSettingsProvider>
      <HomeContent />
    </AppSettingsProvider>
  );
}

function HomeContent() {
  const { t, language, setLanguage } = useLanguage();
  const { isLightTheme, toggleTheme } = useTheme();
  const appLogoPath = process.env.NEXT_PUBLIC_APP_LOGO_PATH || '/abielan_app_logo.png';
  const abielanUrl = process.env.NEXT_PUBLIC_ABIELAN_URL || 'https://www.abielan.in';

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authScreen, setAuthScreen] = useState<'SPLASH' | 'LOGIN' | 'REGISTER'>('SPLASH');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Register Fields
  const [regBName, setRegBName] = useState('');
  const [regOName, setRegOName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');

  const [authError, setAuthError] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<ToastType>('success');
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);

  // Password Visibility States (Android alignment)
  const [loginPassVisible, setLoginPassVisible] = useState(false);
  const [registerPassVisible, setRegisterPassVisible] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState(0); // 0: Dashboard, 1: Sales, 2: Profiles (hidden nav), 3: Bills, 4: Reports, 5: Settings
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [pendingProfileCustomer, setPendingProfileCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    whoamiApi()
      .then(async (session) => {
        if (!session.authenticated) return;
        await Repository.initialize();
        Repository.setSessionUser(
          (session.user as UserModel) || Repository.getCurrentUser(),
          Boolean(session.isSuperAdmin)
        );
        if (session.subscriptionStatus) {
          Repository.setSubscriptionStatus(session.subscriptionStatus);
          setSubscriptionBlocked(session.subscriptionStatus.blocked);
        } else {
          setSubscriptionBlocked(getSubscriptionStatus().blocked);
        }
        setIsLoggedIn(true);
      })
      .catch(() => {
        localStorage.removeItem('dairy_is_logged_in');
      });
  }, []);

  const triggerToast = (message?: string, type: ToastType = 'success') => {
    setToastMessage(message || t('Saved successfully!'));
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2800);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    try {
      const res = await apiPost('/api/auth/login', { email, password });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('dairy_is_logged_in', 'true');
        Repository.clearSession();
        await Repository.initialize();
        Repository.setSessionUser(
          (data.user as UserModel) || Repository.getCurrentUser(),
          Boolean(data.isSuperAdmin)
        );
        setSubscriptionBlocked(getSubscriptionStatus().blocked);
        Repository.logAudit('LOGIN', 'session', data.profile?.emailAddress || email);
        setIsLoggedIn(true);
        triggerToast(t('Welcome back! Login successful.'));
      } else {
        setAuthError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setAuthError('Network error. Failed to authenticate.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    try {
      const res = await apiPost('/api/auth/register', {
        businessName: regBName,
        ownerName: regOName,
        mobileNumber: regPhone,
        emailAddress: regEmail,
        password: regPass,
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('dairy_is_logged_in', 'true');
        Repository.clearSession();
        await Repository.initialize();
        Repository.setSessionUser(
          (data.user as UserModel) || Repository.getCurrentUser(),
          Boolean(data.isSuperAdmin)
        );
        setSubscriptionBlocked(getSubscriptionStatus().blocked);
        setIsLoggedIn(true);
        triggerToast(t('Business registered successfully!'));
      } else {
        setAuthError(data.error || 'Registration failed');
      }
    } catch {
      setAuthError('Network error. Failed to register.');
    }
  };

  const handleLogout = async () => {
    Repository.logAudit('LOGOUT', 'session');
    try {
      await logoutApi();
    } catch {
      /* ignore */
    }
    Repository.clearSession();
    localStorage.removeItem('dairy_is_logged_in');
    setIsLoggedIn(false);
    setActiveTab(0);
  };

  const navTabs = [
    { idx: 0, page: 'Dashboard', icon: LayoutDashboard, label: t('Dashboard') },
    { idx: 1, page: 'Sales', icon: PlusCircle, label: t('Sales') },
    { idx: 2, page: 'Profiles', icon: Droplet, label: t('Profiles') },
    { idx: 3, page: 'Bills', icon: Receipt, label: t('Bills') },
    { idx: 4, page: 'Reports', icon: BarChart3, label: t('Reports') },
    { idx: 5, page: 'Settings', icon: SettingsIcon, label: t('Settings') },
  ].filter((tab) => canAccessPage(tab.page));

  const handleSettleQuickPayment = async (sale: Sale, paymentType: string) => {
    await Repository.markSaleAsPaid(sale.id, paymentType);
    triggerToast();
  };

  if (isLoggedIn && subscriptionBlocked && !Repository.isSuperAdmin()) {
    return <PayNowScreen onLogout={handleLogout} />;
  }

  if (!isLoggedIn) {
    if (authScreen === 'SPLASH') {
      return (
        <div className="auth-wrapper" style={{ flexDirection: 'column' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', maxWidth: '375px', width: '100%', textAlign: 'center', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.15)', marginBottom: '24px', backdropFilter: 'blur(4px)', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07)' }}>
              <img src={appLogoPath} alt="Dairy ERP Logo" style={{ width: '70px', height: '70px', borderRadius: '14px', objectFit: 'contain' }} />
            </div>
            <h1 style={{ color: '#FFFFFF', fontSize: '2.6rem', fontWeight: 900, marginBottom: '8px', letterSpacing: '-0.04em' }}>
              {t('Dairy ERP')}
            </h1>
            <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '1rem', fontWeight: 500, lineHeight: 1.5, marginBottom: '56px' }}>
              {t('Manage Milk Sales Anywhere Offline First')}
            </p>

            <button 
              onClick={() => setAuthScreen('LOGIN')}
              className="btn" 
              style={{ width: '100%', height: '52px', borderRadius: '12px', backgroundColor: '#FFFFFF', color: '#0D47A1', fontSize: '1.05rem', fontWeight: 800, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', cursor: 'pointer', marginBottom: '16px' }}
            >
              {t('Login')}
            </button>

            <button 
              onClick={() => setAuthScreen('REGISTER')}
              className="btn btn-outline" 
              style={{ width: '100%', height: '52px', borderRadius: '12px', border: '2px solid #FFFFFF', color: '#FFFFFF', backgroundColor: 'transparent', fontSize: '1.05rem', fontWeight: 800, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            >
              {t('Register Business')}
            </button>

            <div style={{ marginTop: '48px', fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 600 }}>
              {t('Powered by')} <a href={abielanUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#FFFFFF', fontWeight: 800, textDecoration: 'underline' }}>{t('abielan Tech.')}</a> ({t('www.abielan.in')})
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          {authScreen === 'LOGIN' ? (
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <img src={appLogoPath} alt="Dairy ERP Logo" style={{ width: '70px', height: '70px', borderRadius: '14px', marginBottom: '4px', objectFit: 'contain' }} />
              
              <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                <h1 style={{ color: '#0D47A1', fontSize: '1.7rem', fontWeight: 900, marginBottom: '2px', letterSpacing: '-0.03em' }}>
                  {t('Back to Ledger')}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 500 }}>
                  {t('Enter login credentials provided')}
                </p>
              </div>

              {authError && (
                <div style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(211,47,47,0.08)', color: 'var(--alert-red)', fontSize: '0.82rem', fontWeight: 600, borderLeft: '3px solid var(--alert-red)' }}>
                  ⚠️ {authError}
                </div>
              )}

              <div className="form-group" style={{ width: '100%', marginBottom: 0 }}>
                <label className="form-label">{t('Email Address')}</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seller@ganeshdairy.com"
                  style={{ padding: '10px 14px', fontSize: '0.92rem' }}
                  required
                />
              </div>

              <div className="form-group" style={{ width: '100%', marginBottom: 0 }}>
                <label className="form-label">{t('Password')}</label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <input 
                    type={loginPassVisible ? "text" : "password"} 
                    className="form-input" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: '100%', paddingRight: '48px', padding: '10px 14px', fontSize: '0.92rem' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setLoginPassVisible(!loginPassVisible)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-milk)', padding: '4px', display: 'flex', alignItems: 'center' }}
                  >
                    {loginPassVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '48px', borderRadius: '10px', fontSize: '0.95rem', fontWeight: 800, marginTop: '4px' }}>
                {t('Sign In')}
              </button>

              <button type="button" className="tab-btn" onClick={() => setAuthScreen('REGISTER')} style={{ borderBottom: 'none', marginTop: '4px', fontSize: '0.82rem', color: 'var(--primary-milk)', fontWeight: 600 }}>
                {t('New Seller? Register Business Instead')}
              </button>

              <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--primary-milk)', fontWeight: 600 }}>
                {t('Powered by')} <a href="https://www.abielan.in" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-milk)', fontWeight: 700, textDecoration: 'underline' }}>{t('abielan Tech.')}</a> ({t('www.abielan.in')})
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <img src="/abielan_app_logo.png" alt="Dairy ERP Logo" style={{ width: '60px', height: '60px', borderRadius: '12px', marginBottom: '2px', objectFit: 'contain' }} />
              
              <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                <h1 style={{ color: '#0D47A1', fontSize: '1.6rem', fontWeight: 900, marginBottom: '2px', letterSpacing: '-0.03em' }}>
                  {t('Register ERP Account')}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 500 }}>
                  {t('Create seller profile to work completely offline')}
                </p>
              </div>

              <div className="form-group" style={{ width: '100%', marginBottom: 0 }}>
                <label className="form-label">{t('Cooperative Business Name')}</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={regBName}
                  onChange={(e) => setRegBName(e.target.value)}
                  placeholder="Krishna Milk Depot"
                  style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                  required
                />
              </div>

              <div className="form-group" style={{ width: '100%', marginBottom: 0 }}>
                <label className="form-label">{t('Owner Full Name')}</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={regOName}
                  onChange={(e) => setRegOName(e.target.value)}
                  placeholder="Pooja Sharma"
                  style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                  required
                />
              </div>

              <div className="form-group" style={{ width: '100%', marginBottom: 0 }}>
                <label className="form-label">{t('Logistics Phone Contact')}</label>
                <input 
                  type="tel" 
                  className="form-input" 
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="9911223344"
                  style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                  required
                />
              </div>

              <div className="form-group" style={{ width: '100%', marginBottom: 0 }}>
                <label className="form-label">{t('Primary Email Address')}</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="pooja@krishnadairy.com"
                  style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                  required
                />
              </div>

              <div className="form-group" style={{ width: '100%', marginBottom: 0 }}>
                <label className="form-label">{t('ERP Security Password')}</label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <input 
                    type={registerPassVisible ? "text" : "password"} 
                    className="form-input" 
                    value={regPass}
                    onChange={(e) => setRegPass(e.target.value)}
                    placeholder="Create password"
                    style={{ width: '100%', paddingRight: '48px', padding: '8px 12px', fontSize: '0.9rem' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setRegisterPassVisible(!registerPassVisible)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-milk)', padding: '4px', display: 'flex', alignItems: 'center' }}
                  >
                    {registerPassVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '44px', borderRadius: '10px', fontSize: '0.95rem', fontWeight: 800, marginTop: '4px' }}>
                {t('Register Business')}
              </button>

              <button type="button" className="tab-btn" onClick={() => setAuthScreen('LOGIN')} style={{ borderBottom: 'none', marginTop: '4px', fontSize: '0.82rem', color: 'var(--primary-milk)', fontWeight: 600 }}>
                {t('Back to Ledger')}
              </button>

              <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--primary-milk)', fontWeight: 600 }}>
                {t('Powered by')} <a href="https://www.abielan.in" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-milk)', fontWeight: 700, textDecoration: 'underline' }}>{t('abielan Tech.')}</a> ({t('www.abielan.in')})
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sticky top navbar */}
      <header className="navbar">
        <div className="nav-logo" onClick={() => setActiveTab(0)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/abielan_app_logo.png" alt="Dairy ERP Logo" style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'contain' }} />
          {t('Dairy ERP')}
        </div>

        {/* Navigation tabs moved here */}
        <nav className="navbar-menu">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.idx} className={`tab-btn ${activeTab === tab.idx ? 'active' : ''}`} onClick={() => setActiveTab(tab.idx)}>
                <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <Icon size={15} />
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="nav-actions">
          {/* Theme Switcher */}
          <button 
            className="btn btn-outline" 
            onClick={toggleTheme} 
            title="Toggle Appearance Theme"
            style={{ padding: '8px', borderRadius: '50%' }}
          >
            {isLightTheme ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {/* Language Toggle */}
          <button 
            className="btn btn-outline" 
            onClick={() => setLanguage(language === 'en' ? 'ta' : 'en')}
            style={{ fontSize: '0.85rem', padding: '8px 12px' }}
          >
            {language === 'en' ? 'தமிழ்' : 'English'}
          </button>

          {/* Logout button */}
          <button 
            className="btn btn-outline" 
            onClick={handleLogout}
            title="Logout"
            style={{ padding: '8px', borderRadius: '50%' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Active Tab View Body */}
      <main style={{ padding: '8px 0 40px 0', flex: 1 }}>
        {activeTab === 0 && canAccessPage('Dashboard') && (
          <DashboardTab 
            onNavigateToTab={(idx) => setActiveTab(idx)}
            onSelectCustomer={(c) => {
              setPendingProfileCustomer(c);
              setActiveTab(2);
            }}
            onSettlePayment={handleSettleQuickPayment}
          />
        )}
        {activeTab === 1 && canAccessPage('Sales') && <SalesTab onSuccessToast={triggerToast} />}
        {activeTab === 2 && canAccessPage('Profiles') && (
          <ProfilesTab
            onSuccessToast={triggerToast}
            initialCustomer={pendingProfileCustomer}
            onInitialCustomerConsumed={() => setPendingProfileCustomer(null)}
          />
        )}
        {activeTab === 3 && canAccessPage('Bills') && <BillsTab onInvoiceClick={(sale) => setSelectedSale(sale)} />}
        {activeTab === 4 && canAccessPage('Reports') && <ReportsTab />}
        {activeTab === 5 && canAccessPage('Settings') && <SettingsTab onSuccessToast={triggerToast} onLogout={handleLogout} />}
      </main>

      {/* Footer copyright */}
      <footer style={{ padding: '24px 0', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)' }}>
        {t('Powered by')} <a href="https://www.abielan.in" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-milk)', fontWeight: 600, textDecoration: 'none' }}>{t('abielan Tech.')}</a> ({t('www.abielan.in')})
      </footer>

      {/* Floating Success Toast Notification */}
      <AppToast message={toastMessage} show={showToast} type={toastType} />

      {/* Invoice Detail Dialog Overlay */}
      {selectedSale && (
        <InvoiceDetailDialog 
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
          onPaymentSettled={() => {
            setSelectedSale(null);
            triggerToast();
          }}
        />
      )}

      {/* Inline styles for custom keyframe animations */}
      <style jsx global>{`
        @keyframes toastSlide {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
