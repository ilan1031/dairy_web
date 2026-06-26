// d:/Gitfiles/dairy/dairy-web/components/DashboardTab.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/app/providers';
import Repository, { Sale, Customer } from '@/lib/repository';
import { 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  PlusCircle, 
  UserPlus, 
  DollarSign, 
  MapPin,
  RefreshCw,
  AlertTriangle,
  User,
  Droplet,
  Coins,
  Calendar,
  BarChart3
} from 'lucide-react';
import { hasPageAction, isSuperAdminSession, getCurrentUser, canAccessField } from '@/lib/permissions';
import CowLoading from '@/components/ui/CowLoading';
import RepositoryLib from '@/lib/repository';


interface DashboardTabProps {
  onNavigateToTab: (index: number) => void;
  onSelectCustomer: (customer: Customer) => void;
  onSettlePayment: (sale: Sale, paymentType: string) => void;
}

export default function DashboardTab({ 
  onNavigateToTab, 
  onSelectCustomer,
  onSettlePayment 
}: DashboardTabProps) {
  const { t, language } = useLanguage();
  const [profile, setProfile] = useState(Repository.getProfile());
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalLiters, setTotalLiters] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayLiters, setTodayLiters] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [oldPendingInvoices, setOldPendingInvoices] = useState<Sale[]>([]);

  const loadData = async () => {
    const allSales = await Repository.getAllSales();
    const allCustomers = await Repository.getAllCustomers();
    setSales(allSales);
    setCustomers(allCustomers);
    setProfile(Repository.getProfile());

    // Calculate metrics
    let pending = 0;
    let collected = 0;
    let liters = 0;
    let todayRev = 0;
    let todayLit = 0;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTimestamp = todayStart.getTime();

    const sevenDaysAgo = Date.now() - (86400000 * 7);
    const agedPending: Sale[] = [];

    allSales.forEach(s => {
      liters += s.liters;
      if (s.paymentStatus === 'PAID') {
        collected += s.totalAmount;
      } else {
        pending += s.totalAmount;
        if (s.createdAt < sevenDaysAgo) {
          agedPending.push(s);
        }
      }

      if (s.createdAt >= todayTimestamp) {
        todayRev += s.totalAmount;
        todayLit += s.liters;
      }
    });

    setTotalPending(pending);
    setTotalCollected(collected);
    setTotalLiters(liters);
    setTodayRevenue(todayRev);
    setTodayLiters(todayLit);
    setOldPendingInvoices(agedPending);
  };

  useEffect(() => {
    loadData();
    // Refresh every 5s for rapid pulse
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setUsers(RepositoryLib.getUsers());
    const cur = getCurrentUser();
    setSelectedUserId(cur?.id || null);
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await Repository.triggerBatchSync();
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSettle = (sale: Sale) => {
    if (!hasPageAction('Dashboard', 'edit')) return alert('Permission denied');
    onSettlePayment(sale, 'CASH');
    loadData();
  };

  const handleOpenProfileFromSale = (sale: Sale) => {
    const match = customers.find(
      c => c.id === sale.customerId || c.name.toLowerCase() === sale.customerName.toLowerCase()
    );
    if (match) {
      onSelectCustomer(match);
    } else {
      onSelectCustomer({
        id: sale.customerId,
        name: sale.customerName,
        phone: '',
        qrPreference: 'UPI',
        updatedAt: Date.now()
      });
    }
  };

  const recentSales = sales.slice(0, 5);

  // Time-of-day greeting generator
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('Good Morning');
    if (hour < 17) return t('Good Afternoon');
    return t('Good Evening');
  };

  const formattedDate = new Date().toLocaleDateString(
    language === 'ta' ? 'ta-IN' : 'en-US',
    { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }
  );

  const canSwitchUser =
    isSuperAdminSession() ||
    Boolean(getCurrentUser()?.permissions?.canViewOthers) ||
    getCurrentUser()?.permissions?.dataAccessScope?.mode === 'all' ||
    getCurrentUser()?.permissions?.dataAccessScope?.mode === 'shared';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header welcome & Sync Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.03em' }}>{t('Dairy Hub')}</h1>
        </div>
        <button 
          className="btn btn-outline" 
          onClick={handleSync} 
          disabled={isSyncing}
          style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 16px', borderRadius: 'var(--radius-sm)' }}
        >
          {isSyncing ? <CowLoading size="xs" inline /> : <RefreshCw size={14} />}
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
            {isSyncing ? t('Syncing') : t('🟢 Synced')}
          </span>
        </button>
      </div>

      {/* Hero Welcome Banner Card */}
      <div className="hero-banner">
        <div className="hero-circle-1" />
        <div className="hero-circle-2" />
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '0.95rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 700 }}>
            {getGreeting()}
          </span>
          <h2 style={{ fontSize: '2.1rem', fontWeight: 900, margin: 0, letterSpacing: '-0.04em' }}>
            {profile.ownerName}
          </h2>
          <span style={{ fontSize: '1rem', color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500, marginTop: '2px' }}>
            🏢 {profile.businessName}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.9)', backgroundColor: 'rgba(255, 255, 255, 0.15)', padding: '6px 12px', borderRadius: '20px', width: 'fit-content' }}>
            <Calendar size={13} />
            <span>{formattedDate}</span>
          </div>
        </div>

        {/* Profile Circle Shortcut button */}
        <button 
          onClick={() => onNavigateToTab(2)}
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            border: '2px solid #FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            cursor: 'pointer',
            transition: 'transform var(--transition-fast), background-color var(--transition-fast)',
            outline: 'none',
            boxShadow: 'var(--shadow-md)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          title={t('Customer Ledgers')}
        >
          <User size={24} />
        </button>
      </div>

      {/* Debt Warning Banner Flag */}
      {oldPendingInvoices.length > 0 && (
        <div 
          className="card" 
          style={{ 
            backgroundColor: 'var(--alert-red)', 
            color: '#FFFFFF', 
            border: 'none', 
            borderRadius: 'var(--radius-md)', 
            padding: '18px 24px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '16px',
            boxShadow: 'var(--shadow-md), var(--glow-error)',
            animation: 'fadeIn var(--transition-fast)'
          }}
        >
          <AlertTriangle size={28} style={{ flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <strong style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
              {t('Critical Customer Debt Alert')}
            </strong>
            <span style={{ fontSize: '0.9rem', opacity: 0.95, fontWeight: 500 }}>
              {t('%s milk runs outstanding for over 7 days. Please check customer profiles to settle.', oldPendingInvoices.length)}
            </span>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid-cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        
        {/* Card 1: Today's Revenue */}
        <div className="kpi-card kpi-card-blue">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t("Today's Revenue")}</span>
            <div className="kpi-icon-badge kpi-badge-blue">
              <Coins size={18} />
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 900, margin: '2px 0' }}>
              ₹{todayRevenue.toFixed(0)}
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {t('Today\'s Sales Sum')}
            </span>
          </div>
        </div>

        {/* Card 2: Today's Outflow */}
        <div className="kpi-card kpi-card-blue">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('Total Outflow')}</span>
            <div className="kpi-icon-badge kpi-badge-blue">
              <Droplet size={18} />
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 900, margin: '2px 0' }}>
              {todayLiters.toFixed(1)} L
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {t('Milk Dispatched Today')}
            </span>
          </div>
        </div>

        {/* Card 3: Total Pending */}
        <div className="kpi-card kpi-card-red">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('Total Pending')}</span>
            <div className="kpi-icon-badge kpi-badge-red">
              <Clock size={18} />
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 900, margin: '2px 0', color: 'var(--alert-red)' }}>
              ₹{totalPending.toFixed(0)}
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {t('Outstanding Unpaid')}
            </span>
          </div>
        </div>

        {/* Card 4: Total Collected */}
        <div className="kpi-card kpi-card-green">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('Total Collected')}</span>
            <div className="kpi-icon-badge kpi-badge-green">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 900, margin: '2px 0', color: 'var(--organic-green)' }}>
              ₹{totalCollected.toFixed(0)}
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {t('Paid & Settled Runs')}
            </span>
          </div>
        </div>

      </div>

      {/* Quick ERP Actions Panel */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '18px', fontWeight: 800, letterSpacing: '-0.02em' }}>
          {t('Quick ERP Actions')}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
          <button 
            className="btn btn-primary" 
            onClick={() => onNavigateToTab(1)}
            disabled={!hasPageAction('Sales', 'create')}
            style={{ padding: '14px', borderRadius: 'var(--radius-sm)', justifyContent: 'center' }}
          >
            <PlusCircle size={18} />
            <span>{t('New Sale')}</span>
          </button>
          
          <button 
            className="btn btn-secondary" 
            onClick={() => onNavigateToTab(2)}
            disabled={!hasPageAction('Sales', 'create')}
            style={{ padding: '14px', borderRadius: 'var(--radius-sm)', justifyContent: 'center' }}
          >
            <UserPlus size={18} />
            <span>{t('Add Customer')}</span>
          </button>
          
          <button 
            className="btn btn-outline" 
            onClick={() => onNavigateToTab(3)}
            disabled={!hasPageAction('Dashboard', 'edit')}
            style={{ padding: '14px', borderRadius: 'var(--radius-sm)', justifyContent: 'center', borderWidth: '1.5px' }}
          >
            <DollarSign size={18} />
            <span>{t('Collect Cash')}</span>
          </button>

          <button 
            className="btn btn-outline" 
            onClick={() => onNavigateToTab(4)}
            disabled={!hasPageAction('Reports', 'view')}
            style={{ padding: '14px', borderRadius: 'var(--radius-sm)', justifyContent: 'center', borderWidth: '1.5px' }}
          >
            <BarChart3 size={18} />
            <span>{t('Reports')}</span>
          </button>
        </div>
      </div>

      {/* Recent Sales Pulse */}
      <div className="card" style={{ padding: '24px 0', overflow: 'hidden' }}>
        <div style={{ padding: '0 24px 18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 800 }}>{t('Recent Sales Pulse')}</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, backgroundColor: 'var(--input-bg)', padding: '4px 10px', borderRadius: '12px' }}>
            {t('Total Entries: %s', sales.length)}
          </span>
        </div>

        {recentSales.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {t('No sales recorded today.')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recentSales.map((sale) => (
              <div key={sale.id} className="list-item" style={{ flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, cursor: 'pointer' }}
                  onClick={() => handleOpenProfileFromSale(sale)}
                  title="Open customer profile"
                >
                  <span style={{ fontWeight: 800, fontSize: '1.08rem', color: 'var(--primary-milk)', letterSpacing: '-0.01em' }}>
                    {sale.customerName}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {new Date(sale.createdAt).toLocaleDateString(language === 'ta' ? 'ta-IN' : 'en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                  {sale.ownerName && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--primary-milk)', fontWeight: 600 }}>
                      {sale.ownerName}
                    </span>
                  )}
                  {sale.location && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                      <MapPin size={11} style={{ color: 'var(--primary-milk)' }} /> {sale.location}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {sale.liters} L × ₹{sale.ratePerLiter}
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary-milk)', marginTop: '1px' }}>
                      ₹{sale.totalAmount.toFixed(0)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`badge ${sale.paymentStatus === 'PAID' ? 'badge-paid' : 'badge-pending'}`}>
                      {t(sale.paymentStatus)}
                    </span>
                    {sale.paymentStatus === 'PENDING' && (
                      <button 
                        className="btn btn-success" 
                        onClick={() => handleSettle(sale)} 
                        style={{ padding: '6px 14px', fontSize: '0.82rem', borderRadius: '6px' }}
                      >
                        {t('Mark as Paid')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
