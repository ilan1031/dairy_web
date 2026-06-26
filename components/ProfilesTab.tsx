// d:/Gitfiles/dairy/dairy-web/components/ProfilesTab.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/app/providers';
import Repository, { Customer, Sale } from '@/lib/repository';
import { hasPermission } from '@/lib/permissions';
import { Search, Save, Trash2, ArrowLeft, Check, AlertCircle, Phone, MapPin, FileText, Droplet, Clock, CheckCircle2, ReceiptText, Plus, X } from 'lucide-react';

interface ProfilesTabProps {
  viewAsUserId?: string;
  onSuccessToast: () => void;
  initialCustomer?: Customer | null;
  onInitialCustomerConsumed?: () => void;
}

export default function ProfilesTab({ onSuccessToast }: ProfilesTabProps) {
  const { t, language } = useLanguage();
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCust, setSelectedCust] = useState<Customer | null>(null);

  // Selected customer detail form state
  const [editPhone, setEditPhone] = useState('');
  const [editQr, setEditQr] = useState('UPI');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Profile detail sub-tab
  const [profileTab, setProfileTab] = useState(0); // 0 = Customer Info, 1 = Purchase History
  const [historyFilter, setHistoryFilter] = useState('All'); // All, Paid, Pending

  // Quick Add dialogs (mobile alignment)
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [quickCustQr, setQuickCustQr] = useState('UPI');

  const [showQuickAddSale, setShowQuickAddSale] = useState(false);
  const [quickSaleCategory, setQuickSaleCategory] = useState('Cow Milk');
  const [quickSaleLiters, setQuickSaleLiters] = useState('1.0');
  const [quickSalePayment, setQuickSalePayment] = useState('PENDING');
  const [priceConfigs, setPriceConfigs] = useState<{ milkType: string; currentPrice: number }[]>([]);

  const loadData = async () => {
    const custs = await Repository.getAllCustomers();
    const allSales = await Repository.getAllSales();
    const prices = Repository.getPriceConfigs();
    setCustomers(custs);
    setSales(allSales);
    setPriceConfigs(prices);
    if (prices.length > 0) setQuickSaleCategory(prices[0].milkType);
  };

  useEffect(() => {
    loadData();
  }, []);

  if (!hasPermission('canRead')) {
    return (
      <div className="card">
        <h3 style={{ margin: 0 }}>Access Denied</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>You do not have permission to view profiles.</p>
      </div>
    );
  }

  // Update form fields when customer selection changes
  useEffect(() => {
    if (selectedCust) {
      setEditPhone(selectedCust.phone || '');
      setEditQr(selectedCust.qrPreference || 'UPI');
      setEditAddress(selectedCust.address || '');
      setEditNotes(selectedCust.notes || '');
      setProfileTab(0);
      setHistoryFilter('All');
    }
  }, [selectedCust]);

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission('canUpdate')) return alert('Permission denied');
    if (!selectedCust) return;
    if (!window.confirm(t('Are you sure you want to save these customer details?'))) return;

    const updated: Customer = {
      ...selectedCust,
      phone: editPhone,
      qrPreference: editQr,
      address: editAddress,
      notes: editNotes,
      updatedAt: Date.now()
    };

    await Repository.saveCustomer(updated);
    setSelectedCust(updated);
    onSuccessToast();
    loadData();
  };

  const handleDeleteCustomer = async () => {
    if (!hasPermission('canDelete')) return alert('Permission denied');
    if (!selectedCust) return;
    if (confirm(`Are you sure you want to delete ${selectedCust.name}? Historical sales records will be preserved.`)) {
      await Repository.deleteCustomer(selectedCust.id);
      setSelectedCust(null);
      onSuccessToast();
      loadData();
    }
  };

  const handleSettleOne = async (sale: Sale) => {
    if (!hasPermission('canUpdate')) return alert('Permission denied');
    if (!selectedCust) return;
    if (!confirm(`Settle ₹${sale.totalAmount.toFixed(0)} for ${selectedCust.name}?`)) return;
    await Repository.markSaleAsPaid(sale.id, selectedCust.qrPreference || 'CASH');
    onSuccessToast();
    loadData();
  };

  const handleQuickAddCustomer = async () => {
    if (!hasPermission('canCreate')) return alert('Permission denied');
    if (!quickCustName.trim()) return;

    await Repository.saveCustomer({
      id: `cust_${Date.now()}`,
      name: quickCustName.trim(),
      phone: quickCustPhone,
      qrPreference: quickCustQr,
      updatedAt: Date.now()
    });
    setQuickCustName('');
    setQuickCustPhone('');
    setQuickCustQr('UPI');
    setShowQuickAddCustomer(false);
    onSuccessToast();
    loadData();
  };

  const handleQuickAddSale = async () => {
    if (!hasPermission('canCreate')) return alert('Permission denied');
    if (!selectedCust) return;
    const litersVal = parseFloat(quickSaleLiters);
    if (isNaN(litersVal) || litersVal <= 0) return alert('Please enter a valid quantity');

    const rate = priceConfigs.find(p => p.milkType === quickSaleCategory)?.currentPrice || 50;
    const isPaid = quickSalePayment !== 'PENDING';

    await Repository.saveSale({
      id: `sale_${Date.now()}`,
      customerId: selectedCust.id,
      customerName: selectedCust.name,
      milkType: quickSaleCategory,
      liters: litersVal,
      ratePerLiter: rate,
      totalAmount: rate * litersVal,
      paymentStatus: isPaid ? 'PAID' : 'PENDING',
      paymentType: isPaid ? quickSalePayment : 'NONE',
      location: 'Web Terminal',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    setShowQuickAddSale(false);
    setQuickSaleLiters('1.0');
    setQuickSalePayment('PENDING');
    onSuccessToast();
    loadData();
  };

  const handleSettleAll = async () => {
    if (!hasPermission('canUpdate')) return alert('Permission denied');
    if (!selectedCust) return;
    const pendingSales = sales.filter(s => s.customerId === selectedCust.id && s.paymentStatus === 'PENDING');
    if (pendingSales.length === 0) return;

    if (confirm(`Settle all ${pendingSales.length} pending payments for ${selectedCust.name}?`)) {
      for (const sale of pendingSales) {
        await Repository.markSaleAsPaid(sale.id, selectedCust.qrPreference || 'CASH');
      }
      onSuccessToast();
      loadData();
    }
  };

  // Calculations
  const getCustomerMetrics = (customerId: string) => {
    const custSales = sales.filter(s => s.customerId === customerId);
    const totalLiters = custSales.reduce((sum, s) => sum + s.liters, 0);
    const pendingDues = custSales.filter(s => s.paymentStatus === 'PENDING').reduce((sum, s) => sum + s.totalAmount, 0);
    const totalPaid = custSales.filter(s => s.paymentStatus === 'PAID').reduce((sum, s) => sum + s.totalAmount, 0);
    return { totalLiters, pendingDues, totalPaid, salesCount: custSales.length };
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone && c.phone.includes(searchQuery))
  );

  // If a customer is selected, show their detail view
  if (selectedCust) {
    const metrics = getCustomerMetrics(selectedCust.id);
    const custSales = sales.filter(s => s.customerId === selectedCust.id);
    
    const filteredSales = (() => {
      if (historyFilter === 'Paid') return custSales.filter(s => s.paymentStatus === 'PAID');
      if (historyFilter === 'Pending') return custSales.filter(s => s.paymentStatus === 'PENDING');
      return custSales;
    })();

    // Sorted newest first
    const sortedSales = [...filteredSales].sort((a, b) => b.createdAt - a.createdAt);

    const initials = selectedCust.name.trim().substring(0, 2).toUpperCase();

    const milkDotColor = (milkType: string) => {
      if (milkType === 'Cow Milk') return '#64B5F6';
      if (milkType === 'Buffalo Milk') return '#81C784';
      return '#FFB74D';
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Back Button + Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            className="btn btn-outline"
            onClick={() => setSelectedCust(null)}
            style={{ padding: '10px', borderRadius: '50%', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '50%',
              backgroundColor: 'rgba(30,136,229,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: '1.1rem', color: 'var(--primary-milk)',
              flexShrink: 0
            }}>
              {initials}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
                {selectedCust.name}
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Customer Ledger &amp; Account Profile
              </span>
            </div>
          </div>
        </div>

        {/* 3 KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {/* Pending Due */}
          <div style={{
            backgroundColor: 'var(--bg-card)', borderRadius: '14px', padding: '16px',
            border: '1px solid rgba(211,47,47,0.2)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: 'rgba(211,47,47,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} style={{ color: 'var(--alert-red)' }} />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'center' }}>Pending Due</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--alert-red)' }}>
              ₹{metrics.pendingDues.toFixed(0)}
            </span>
          </div>

          {/* Total Paid */}
          <div style={{
            backgroundColor: 'var(--bg-card)', borderRadius: '14px', padding: '16px',
            border: '1px solid rgba(46,125,50,0.2)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: 'rgba(46,125,50,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--organic-green)' }} />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'center' }}>Total Paid</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--organic-green)' }}>
              ₹{metrics.totalPaid.toFixed(0)}
            </span>
          </div>

          {/* Total Liters */}
          <div style={{
            backgroundColor: 'var(--bg-card)', borderRadius: '14px', padding: '16px',
            border: '1px solid rgba(30,136,229,0.2)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: 'rgba(30,136,229,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Droplet size={16} style={{ color: 'var(--primary-milk)' }} />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'center' }}>Total Liters</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--primary-milk)' }}>
              {metrics.totalLiters.toFixed(1)}L
            </span>
          </div>
        </div>

        {/* Profile Sub-Navigation Tabs */}
        <div style={{
          display: 'flex', borderRadius: '12px',
          backgroundColor: 'var(--input-bg)',
          border: '1px solid var(--border-color)',
          padding: '4px', gap: '4px'
        }}>
          {['Customer Info', 'Purchase History'].map((label, idx) => (
            <button
              key={label}
              onClick={() => setProfileTab(idx)}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.9rem', fontFamily: 'inherit',
                transition: 'all 0.15s',
                backgroundColor: profileTab === idx ? 'var(--primary-milk)' : 'transparent',
                color: profileTab === idx ? '#FFFFFF' : 'var(--text-secondary)',
                boxShadow: profileTab === idx ? '0 2px 8px rgba(30,136,229,0.25)' : 'none'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* TAB 0: CUSTOMER INFO */}
        {profileTab === 0 && (
          <div className="card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary-milk)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={17} />
              Delivery &amp; Contact Details
            </h3>

            <form onSubmit={handleSaveDetails} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Phone */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={14} style={{ color: 'var(--primary-milk)' }} /> Logistics Contact Number
                </label>
                <input
                  type="tel"
                  className="form-input"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                />
              </div>

              {/* Address */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} style={{ color: 'var(--primary-milk)' }} /> Delivery Address / Client Base
                </label>
                <textarea
                  className="form-input"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Physical delivery address..."
                  rows={2}
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              {/* Notes */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} style={{ color: 'var(--primary-milk)' }} /> Operational Notes / Preferences
                </label>
                <textarea
                  className="form-input"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Specific notes or remarks..."
                  rows={2}
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              {/* QR Preference */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Standard Payment Preference</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['UPI', 'CASH'].map(pref => (
                    <button
                      key={pref}
                      type="button"
                      onClick={() => setEditQr(pref)}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer',
                        border: `1.5px solid ${editQr === pref ? 'var(--primary-milk)' : 'var(--border-color)'}`,
                        backgroundColor: editQr === pref ? 'rgba(30,136,229,0.08)' : 'transparent',
                        color: editQr === pref ? 'var(--primary-milk)' : 'var(--text-secondary)',
                        fontWeight: 700, fontSize: '0.9rem', fontFamily: 'inherit',
                        transition: 'all 0.15s'
                      }}
                    >
                      {pref}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '10px', paddingTop: '8px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, height: '46px' }}>
                  <Save size={16} /> Update Account Details
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDeleteCustomer}
                  style={{ padding: '0 18px', height: '46px' }}
                  title="Delete Customer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 1: PURCHASE HISTORY */}
        {profileTab === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary-milk)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ReceiptText size={17} /> Purchase History
              </h3>
              <div style={{
                backgroundColor: 'rgba(30,136,229,0.08)', color: 'var(--primary-milk)',
                borderRadius: '8px', padding: '4px 10px', fontSize: '0.8rem', fontWeight: 700
              }}>
                {sortedSales.length} Records
              </div>
            </div>

            {/* Settle All Button (if pending dues exist) */}
            {metrics.pendingDues > 0 && historyFilter !== 'Paid' && (
              <button className="btn btn-success" onClick={handleSettleAll} style={{ width: '100%', height: '46px' }}>
                <Check size={16} />
                Settle All Pending Dues (₹{metrics.pendingDues.toFixed(0)})
              </button>
            )}

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {['All', 'Paid', 'Pending'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setHistoryFilter(filter)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer',
                    fontWeight: 700, fontSize: '0.82rem', fontFamily: 'inherit',
                    backgroundColor: historyFilter === filter ? 'var(--primary-milk)' : 'var(--input-bg)',
                    color: historyFilter === filter ? '#FFFFFF' : 'var(--text-secondary)',
                    border: `1px solid ${historyFilter === filter ? 'var(--primary-milk)' : 'var(--border-color)'}`,
                    transition: 'all 0.15s'
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Sales List */}
            {sortedSales.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                padding: '40px', backgroundColor: 'var(--bg-card)', borderRadius: '16px',
                border: '1px solid var(--border-color)'
              }}>
                <ReceiptText size={36} style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>No transaction records found</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {sortedSales.map(sale => {
                  const dateStr = new Date(sale.createdAt).toLocaleString(language === 'ta' ? 'ta-IN' : 'en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  });
                  return (
                    <div
                      key={sale.id}
                      style={{
                        backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '14px 16px',
                        border: `1px solid ${sale.paymentStatus === 'PENDING' ? 'rgba(211,47,47,0.2)' : 'var(--border-color)'}`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        gap: '12px', boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '10px', height: '10px', borderRadius: '50%',
                            backgroundColor: milkDotColor(sale.milkType), flexShrink: 0
                          }} />
                          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            {sale.liters}L · {t(sale.milkType)}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{dateStr}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          ₹{sale.ratePerLiter}/L · {sale.paymentType !== 'NONE' ? sale.paymentType : '—'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                        <span style={{ fontWeight: 900, fontSize: '1.05rem' }}>₹{sale.totalAmount.toFixed(0)}</span>
                        {sale.paymentStatus === 'PAID' ? (
                          <div style={{
                            backgroundColor: 'rgba(46,125,50,0.1)', color: 'var(--organic-green)',
                            borderRadius: '6px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700
                          }}>
                            Paid
                          </div>
                        ) : (
                          <button
                            onClick={() => handleSettleOne(sale)}
                            style={{
                              backgroundColor: 'rgba(211,47,47,0.08)', color: 'var(--alert-red)',
                              border: '1px solid rgba(211,47,47,0.25)', borderRadius: '6px',
                              padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700,
                              cursor: 'pointer', fontFamily: 'inherit'
                            }}
                          >
                            Collect Payment
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Quick Add Sale FAB (mobile alignment) */}
        <button
          onClick={() => setShowQuickAddSale(true)}
          style={{
            position: 'fixed', bottom: '80px', right: '24px',
            width: '56px', height: '56px', borderRadius: '50%',
            backgroundColor: 'var(--primary-milk)', color: '#FFF', border: 'none',
            boxShadow: 'var(--shadow-lg)', cursor: 'pointer', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          title="Quick Add Sale"
        >
          <Plus size={24} />
        </button>

        {showQuickAddSale && (
          <QuickAddSaleDialog
            customerName={selectedCust.name}
            category={quickSaleCategory}
            liters={quickSaleLiters}
            payment={quickSalePayment}
            prices={priceConfigs}
            onCategoryChange={setQuickSaleCategory}
            onLitersChange={setQuickSaleLiters}
            onPaymentChange={setQuickSalePayment}
            onCancel={() => setShowQuickAddSale(false)}
            onSubmit={handleQuickAddSale}
          />
        )}
      </div>
    );
  }

  // Customer List View
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>{t('Customer Ledgers')}</h2>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {filteredCustomers.length} accounts
        </span>
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary-milk)' }} />
        <input
          type="text"
          className="form-input"
          placeholder={t('Search customer accounts...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ paddingLeft: '48px', width: '100%' }}
        />
      </div>

      {filteredCustomers.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
          padding: '48px', backgroundColor: 'var(--bg-card)', borderRadius: '16px',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--input-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Search size={28} style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
          </div>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
            {searchQuery ? 'No matching customers found.' : 'No customers yet. Add your first customer from the Sales tab.'}
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredCustomers.map(cust => {
            const metrics = getCustomerMetrics(cust.id);
            const initials = cust.name.trim().substring(0, 2).toUpperCase();

            return (
              <div
                key={cust.id}
                onClick={() => setSelectedCust(cust)}
                style={{
                  backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '16px',
                  border: `1px solid ${metrics.pendingDues > 0 ? 'rgba(211,47,47,0.2)' : 'var(--border-color)'}`,
                  display: 'flex', alignItems: 'center', gap: '14px',
                  cursor: 'pointer', transition: 'all 0.15s', boxShadow: 'var(--shadow-sm)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
                  backgroundColor: 'rgba(30,136,229,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: '1rem', color: 'var(--primary-milk)'
                }}>
                  {initials}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    {cust.name}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {cust.phone ? `📞 ${cust.phone}` : 'No phone listed'}
                  </div>
                  {cust.notes && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📝 {cust.notes}
                    </div>
                  )}
                </div>

                {/* Pending Amount */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Pending</span>
                  <span style={{
                    fontWeight: 900, fontSize: '1.1rem',
                    color: metrics.pendingDues > 0 ? 'var(--alert-red)' : 'var(--organic-green)'
                  }}>
                    ₹{metrics.pendingDues.toFixed(0)}
                  </span>
                  {metrics.pendingDues > 0 && (
                    <AlertCircle size={14} style={{ color: 'var(--alert-red)' }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Add Customer FAB (mobile alignment) */}
      <button
        onClick={() => setShowQuickAddCustomer(true)}
        style={{
          position: 'fixed', bottom: '80px', right: '24px',
          width: '56px', height: '56px', borderRadius: '50%',
          backgroundColor: 'var(--primary-milk)', color: '#FFF', border: 'none',
          boxShadow: 'var(--shadow-lg)', cursor: 'pointer', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
        title="Add Customer"
      >
        <Plus size={24} />
      </button>

      {showQuickAddCustomer && (
        <div className="dialog-overlay" onClick={() => setShowQuickAddCustomer(false)}>
          <div className="dialog-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontWeight: 800 }}>Quick Add Cash/UPI Buyer</h3>
              <button className="tab-btn" onClick={() => setShowQuickAddCustomer(false)} style={{ padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Buyer Name (e.g., Arun Sharma)</label>
              <input type="text" className="form-input" value={quickCustName} onChange={(e) => setQuickCustName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Logistics Phone Number</label>
              <input type="tel" className="form-input" value={quickCustPhone} onChange={(e) => setQuickCustPhone(e.target.value)} />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', gap: '8px' }}>
                {['UPI', 'CASH'].map(pref => (
                  <button key={pref} type="button"
                    className={`btn ${quickCustQr === pref ? 'btn-primary' : 'btn-outline'}`}
                    style={{ flex: 1 }} onClick={() => setQuickCustQr(pref)}
                  >{pref}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button className="btn btn-outline" onClick={() => setShowQuickAddCustomer(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleQuickAddCustomer} style={{ flex: 1 }}>Add Buyer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickAddSaleDialog({
  customerName, category, liters, payment, prices,
  onCategoryChange, onLitersChange, onPaymentChange, onCancel, onSubmit
}: {
  customerName: string;
  category: string;
  liters: string;
  payment: string;
  prices: { milkType: string; currentPrice: number }[];
  onCategoryChange: (v: string) => void;
  onLitersChange: (v: string) => void;
  onPaymentChange: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const categories = prices.length > 0 ? prices.map(p => p.milkType) : ['Cow Milk', 'Buffalo Milk', 'A2 Milk'];
  const rate = prices.find(p => p.milkType === category)?.currentPrice || 50;
  const litersVal = parseFloat(liters) || 0;
  const total = rate * litersVal;

  const incrementLiters = (amount: number) => {
    const current = parseFloat(liters) || 0;
    onLitersChange((current + amount).toFixed(1));
  };

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontWeight: 900, color: 'var(--primary-milk)' }}>
          Quick Sale: {customerName}
        </h3>

        <div className="form-group">
          <label className="form-label">Select Milk Grade</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {categories.map(cat => (
              <button key={cat} type="button" onClick={() => onCategoryChange(cat)}
                style={{
                  padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700,
                  fontSize: '0.82rem', fontFamily: 'inherit',
                  border: `1.5px solid ${category === cat ? 'var(--primary-milk)' : 'var(--border-color)'}`,
                  backgroundColor: category === cat ? 'rgba(30,136,229,0.1)' : 'transparent',
                  color: category === cat ? 'var(--primary-milk)' : 'var(--text-secondary)',
                }}
              >{cat}</button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Quantity (Liters)</label>
          <input type="number" step="0.1" className="form-input" value={liters} onChange={(e) => onLitersChange(e.target.value)} />
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            {[0.5, 1, 2, 5].map(inc => (
              <button key={inc} type="button" className="btn btn-outline" style={{ flex: 1, padding: '6px', fontSize: '0.8rem' }}
                onClick={() => incrementLiters(inc)}>+{inc}</button>
            ))}
            <button type="button" className="btn btn-outline" style={{ flex: 1, padding: '6px', fontSize: '0.8rem', color: 'var(--alert-red)' }}
              onClick={() => onLitersChange('0.0')}>CLR</button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Payment Status</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { val: 'PENDING', label: 'Pending Due' },
              { val: 'CASH', label: 'Paid (Cash)' },
              { val: 'UPI', label: 'Paid (UPI)' },
            ].map(opt => (
              <button key={opt.val} type="button" onClick={() => onPaymentChange(opt.val)}
                style={{
                  flex: 1, padding: '10px 6px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700,
                  fontSize: '0.75rem', fontFamily: 'inherit',
                  border: `1.5px solid ${payment === opt.val ? (opt.val === 'PENDING' ? 'var(--alert-red)' : 'var(--organic-green)') : 'var(--border-color)'}`,
                  backgroundColor: payment === opt.val ? (opt.val === 'PENDING' ? 'rgba(211,47,47,0.1)' : 'rgba(46,125,50,0.1)') : 'transparent',
                  color: payment === opt.val ? (opt.val === 'PENDING' ? 'var(--alert-red)' : 'var(--organic-green)') : 'var(--text-secondary)',
                }}
              >{opt.label}</button>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '12px', marginBottom: '16px', backgroundColor: 'rgba(30,136,229,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Estimated Amount</span>
              <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>₹{rate}/L × {litersVal.toFixed(1)} L</div>
            </div>
            <span style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--primary-milk)' }}>₹{total.toFixed(0)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-outline" onClick={onCancel} style={{ flex: 1, color: 'var(--alert-red)' }}>Cancel</button>
          <button className="btn btn-primary" onClick={onSubmit} style={{ flex: 1 }}>Create Sale Log</button>
        </div>
      </div>
    </div>
  );
}
