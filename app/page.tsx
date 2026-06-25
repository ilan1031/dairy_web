// d:/Gitfiles/dairy/dairy-web/app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { AppSettingsProvider, useLanguage, useTheme } from './providers';
import Repository, { Sale, Customer, UserModel } from '@/lib/repository';
import { apiPost } from '@/lib/api';
import { getWhoamiPromise, logoutApi, clearWhoamiPromise } from '@/lib/authApi';
import { canAccessPage } from '@/lib/permissions';
import { getSubscriptionStatus } from '@/lib/subscription';
import AppToast, { ToastType } from '@/components/AppToast';
import PayNowScreen from '@/components/PayNowScreen';
import CowLoading from '@/components/ui/CowLoading';
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

// Lazy load heavy components — show CowLoading while JS chunks are being fetched
const tabLoader = (msg: string) => () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
    <CowLoading message={msg} size="md" />
  </div>
);
const DashboardTab = dynamic(() => import('@/components/DashboardTab'), { ssr: false, loading: tabLoader('Loading Dashboard…') });
const SalesTab = dynamic(() => import('@/components/SalesTab'), { ssr: false, loading: tabLoader('Loading Sales…') });
const ProfilesTab = dynamic(() => import('@/components/ProfilesTab'), { ssr: false, loading: tabLoader('Loading Profiles…') });
const BillsTab = dynamic(() => import('@/components/BillsTab'), { ssr: false, loading: tabLoader('Loading Bills…') });
const ReportsTab = dynamic(() => import('@/components/ReportsTab'), { ssr: false, loading: tabLoader('Loading Reports…') });
const SettingsTab = dynamic(() => import('@/components/SettingsTab'), { ssr: false, loading: tabLoader('Loading Settings…') });
const InvoiceDetailDialog = dynamic(() => import('@/components/InvoiceDetailDialog'), { ssr: false, loading: () => null });

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
  const abielanUrl = process.env.NEXT_PUBLIC_ABIELAN_URL || 'https://www.abielan.in';
  const branding = Repository.getBrandingConfig();
  const appLogoPath = branding.logo || '/abielan_app_logo.png';
  const systemName = branding.systemName || t('Dairy ERP');

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
  const [detectedIp, setDetectedIp] = useState('');
  const [detectingIp, setDetectingIp] = useState(false);
  const [detectIpError, setDetectIpError] = useState('');

  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
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

  // Impersonation / View As User State ('all' = aggregated data for all users)
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [users, setUsers] = useState<UserModel[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    getWhoamiPromise()
      .then(async (session) => {
        if (!session.authenticated) {
          setIsReady(true);
          return;
        }
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
        setUsers(Repository.getUsers());
        setIsReady(true);
      })
      .catch(() => {
        localStorage.removeItem('dairy_is_logged_in');
        setIsReady(true);
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
    setIsAuthLoading(true);

    try {
      const res = await apiPost('/api/auth/login', { email, password });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('dairy_is_logged_in', 'true');
        Repository.clearSession();
        clearWhoamiPromise();
        setIsReady(false);
        await Repository.initialize();
        Repository.setSessionUser(
          (data.user as UserModel) || Repository.getCurrentUser(),
          Boolean(data.isSuperAdmin)
        );
        setSubscriptionBlocked(getSubscriptionStatus().blocked);
        Repository.logAudit('LOGIN', 'session', data.profile?.emailAddress || email);
        setIsLoggedIn(true);
        setUsers(Repository.getUsers());
        setIsReady(true);
        triggerToast(t('Welcome back! Login successful.'));
      } else {
        setAuthError(data.error || 'Invalid credentials');
      }
    } catch {
      setAuthError('Network error. Failed to authenticate.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  useEffect(() => {
    if (authScreen !== 'REGISTER' || detectedIp || detectingIp) return;

    const detectIp = async () => {
      setDetectingIp(true);
      setDetectIpError('');
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        if (!response.ok) {
          throw new Error(`IP detection failed: ${response.statusText}`);
        }
        const json = await response.json();
        if (json.ip) {
          setDetectedIp(String(json.ip));
        } else {
          throw new Error('IP address not found');
        }
      } catch (err) {
        setDetectIpError(err instanceof Error ? err.message : 'Unable to detect IP address');
      } finally {
        setDetectingIp(false);
      }
    };

    void detectIp();
  }, [authScreen, detectedIp, detectingIp]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);

    try {
      const res = await apiPost('/api/auth/register', {
        businessName: regBName,
        ownerName: regOName,
        mobileNumber: regPhone,
        emailAddress: regEmail,
        password: regPass,
        ...(detectedIp ? { ipAddress: detectedIp } : {}),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('dairy_is_logged_in', 'true');
        Repository.clearSession();
        clearWhoamiPromise();
        setIsReady(false);
        await Repository.initialize();
        Repository.setSessionUser(
          (data.user as UserModel) || Repository.getCurrentUser(),
          Boolean(data.isSuperAdmin)
        );
        setSubscriptionBlocked(getSubscriptionStatus().blocked);
        setIsLoggedIn(true);
        setUsers(Repository.getUsers());
        setIsReady(true);
        triggerToast(t('Business registered successfully!'));
      } else {
        setAuthError(data.error || 'Registration failed');
      }
    } catch {
      setAuthError('Network error. Failed to register.');
    } finally {
      setIsAuthLoading(false);
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
    Repository.setSessionSuperAdmin(false);
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

  const currentUser = Repository.getCurrentUser();
  const canSwitchUser =
    isLoggedIn && (
      Repository.isSessionSuperAdmin() ||
      Repository.isSuperAdmin() ||
      Boolean(currentUser?.permissions?.canViewOthers) ||
      currentUser?.permissions?.dataAccessScope?.mode === 'all' ||
      currentUser?.permissions?.dataAccessScope?.mode === 'shared'
    );

  const handleUserChange = async (userId: string) => {
    const viewAs = userId || 'all';
    setSelectedUserId(viewAs);
    setIsReady(false);
    try {
      await Repository.changeActiveUser(viewAs === 'all' ? 'all' : viewAs);
      setUsers(Repository.getUsers());
    } catch (err) {
      console.error(err);
    } finally {
      setIsReady(true);
    }
  };

  if (!isReady) {
    return (
      <div className="auth-wrapper">
        <CowLoading message={t('Loading data...')} size="lg" fullScreen />
      </div>
    );
  }

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
              {systemName}
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
                  placeholder="seller@abielan.in"
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

              <button type="submit" className="btn btn-primary" disabled={isAuthLoading} style={{ width: '100%', height: '48px', borderRadius: '10px', fontSize: '0.95rem', fontWeight: 800, marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isAuthLoading ? 0.8 : 1 }}>
                {isAuthLoading ? <CowLoading size="xs" inline message={t('Signing in…')} /> : t('Sign In')}
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

              <div style={{ width: '100%', textAlign: 'left', fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '0 4px' }}>
                {detectingIp ? 'Detecting your public IP address…' : detectedIp ? `Detected IP: ${detectedIp}` : detectIpError ? `IP detection failed: ${detectIpError}` : 'Public IP will be attached to signup request when available.'}
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

              <button type="submit" className="btn btn-primary" disabled={isAuthLoading} style={{ width: '100%', height: '44px', borderRadius: '10px', fontSize: '0.95rem', fontWeight: 800, marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isAuthLoading ? 0.8 : 1 }}>
                {isAuthLoading ? <CowLoading size="xs" inline message={t('Registering…')} /> : t('Register Business')}
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
          <img src={appLogoPath} alt="Dairy ERP Logo" style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'contain' }} />
          <span className="nav-logo-text">{systemName}</span>
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
          {/* View As User Selector */}
          {canSwitchUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '8px' }}>
              <label className="view-as-label" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {t('View as')}
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => handleUserChange(e.target.value)}
                className="form-input view-as-select"
                style={{ width: '150px', height: '32px', padding: '2px 6px', fontSize: '0.8rem', borderRadius: '6px', cursor: 'pointer' }}
              >
                <option value="all">{t('All')}</option>
                {users.filter(u => u.role !== 'superadmin').map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}

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
            className="btn btn-outline lang-toggle-btn" 
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
            key={selectedUserId}
            viewAsUserId={selectedUserId}
            onNavigateToTab={(idx) => setActiveTab(idx)}
            onSelectCustomer={(c) => {
              setPendingProfileCustomer(c);
              setActiveTab(2);
            }}
            onSettlePayment={handleSettleQuickPayment}
          />
        )}
        {activeTab === 1 && canAccessPage('Sales') && (
          <SalesTab 
            key={selectedUserId}
            viewAsUserId={selectedUserId}
            onSuccessToast={triggerToast} 
            onSaleCreated={(sale) => {
              setActiveTab(3);
              setSelectedSale(sale);
            }}
          />
        )}
        {activeTab === 2 && canAccessPage('Profiles') && (
          <ProfilesTab
            key={selectedUserId}
            viewAsUserId={selectedUserId}
            onSuccessToast={triggerToast}
            initialCustomer={pendingProfileCustomer}
            onInitialCustomerConsumed={() => setPendingProfileCustomer(null)}
          />
        )}
        {activeTab === 3 && canAccessPage('Bills') && (
          <BillsTab key={selectedUserId} viewAsUserId={selectedUserId} onInvoiceClick={(sale) => setSelectedSale(sale)} />
        )}
        {activeTab === 4 && canAccessPage('Reports') && (
          <ReportsTab key={selectedUserId} viewAsUserId={selectedUserId} />
        )}
        {activeTab === 5 && canAccessPage('Settings') && (
          <SettingsTab key={selectedUserId} viewAsUserId={selectedUserId} onSuccessToast={triggerToast} onLogout={handleLogout} />
        )}
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
