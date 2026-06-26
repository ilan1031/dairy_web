// d:/Gitfiles/dairy/dairy-web/components/BillsTab.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/app/providers';
import Repository, { Sale } from '@/lib/repository';
import { hasPermission } from '@/lib/permissions';
import { Search, Receipt, Filter, CheckCircle, Clock, X, SlidersHorizontal } from 'lucide-react';

interface BillsTabProps {
  viewAsUserId?: string;
  onInvoiceClick: (sale: Sale) => void;
}

function parseDateStr(dateStr: string, isStart: boolean): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  if (isStart) d.setHours(0, 0, 0, 0);
  else d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export default function BillsTab({ onInvoiceClick }: BillsTabProps) {
  const { t, language } = useLanguage();

  const [sales, setSales] = useState<Sale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('All'); // All, Today, Week, Month, Custom Range

  // Advanced filter state (mobile alignment)
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterTimeShift, setFilterTimeShift] = useState('All');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterPaymentType, setFilterPaymentType] = useState('All');

  useEffect(() => {
    Repository.getAllSales().then(setSales).catch(console.error);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterStatus !== 'All') count++;
    if (filterTimeShift !== 'All') count++;
    if (filterStartDate) count++;
    if (filterEndDate) count++;
    if (filterPaymentType !== 'All') count++;
    return count;
  }, [filterStatus, filterTimeShift, filterStartDate, filterEndDate, filterPaymentType]);

  const filteredInvoices = useMemo(() => {
    let pre = sales.filter(s =>
      s.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.milkType.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (filterStatus !== 'All') {
      pre = pre.filter(s => s.paymentStatus === filterStatus);
    }
    if (filterPaymentType !== 'All') {
      pre = pre.filter(s => s.paymentType === filterPaymentType);
    }
    if (filterTimeShift !== 'All') {
      pre = pre.filter(sale => {
        const hour = new Date(sale.createdAt).getHours();
        if (filterTimeShift === 'Morning') return hour >= 5 && hour <= 11;
        if (filterTimeShift === 'Evening') return hour >= 12 && hour <= 21;
        return true;
      });
    }

    if (filterStartDate || filterEndDate) {
      const startMs = parseDateStr(filterStartDate, true);
      const endMs = parseDateStr(filterEndDate, false);
      pre = pre.filter(sale => {
        const matchesStart = startMs === null || sale.createdAt >= startMs;
        const matchesEnd = endMs === null || sale.createdAt <= endMs;
        return matchesStart && matchesEnd;
      });
    } else if (dateFilter !== 'All' && dateFilter !== 'Custom Range') {
      const now = Date.now();
      if (dateFilter === 'Today') pre = pre.filter(s => now - s.createdAt < 86400000);
      else if (dateFilter === 'Week') pre = pre.filter(s => now - s.createdAt < 86400000 * 7);
      else if (dateFilter === 'Month') pre = pre.filter(s => now - s.createdAt < 86400000 * 30);
    }

    return pre.sort((a, b) => b.createdAt - a.createdAt);
  }, [sales, searchQuery, dateFilter, filterStatus, filterTimeShift, filterStartDate, filterEndDate, filterPaymentType]);

  const totalInvoiced = filteredInvoices.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalPaid = filteredInvoices.filter(s => s.paymentStatus === 'PAID').reduce((sum, s) => sum + s.totalAmount, 0);
  const totalPending = filteredInvoices.filter(s => s.paymentStatus !== 'PAID').reduce((sum, s) => sum + s.totalAmount, 0);
  const progressPercent = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 100;

  const resetAdvancedFilters = () => {
    setFilterStatus('All');
    setFilterPaymentType('All');
    setFilterTimeShift('All');
    setFilterStartDate('');
    setFilterEndDate('');
    setDateFilter('All');
  };

  if (!hasPermission('canRead')) {
    return (
      <div className="card">
        <h3 style={{ margin: 0 }}>Access Denied</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>You do not have permission to view bills.</p>
      </div>
    );
  }

  const dateChips = ['Today', 'Week', 'Month', 'All', 'Custom Range'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>
            {t('Ledger Bills & Invoices')}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Generate QR Codes, share records, and export invoices.
          </p>
        </div>
        <div style={{
          width: '44px', height: '44px', borderRadius: '50%',
          backgroundColor: 'rgba(30,136,229,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Receipt size={22} style={{ color: 'var(--primary-milk)' }} />
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        {[
          { label: 'Total Billed', value: totalInvoiced, color: 'var(--primary-milk)' },
          { label: 'Total Paid', value: totalPaid, color: 'var(--organic-green)' },
          { label: 'Total Pending', value: totalPending, color: 'var(--alert-red)' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '14px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{kpi.label}</span>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: kpi.color, marginTop: '4px' }}>
              ₹{kpi.value.toFixed(0)}
            </div>
          </div>
        ))}
      </div>

      {/* Collection Progress Bar */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Collection Progress</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--organic-green)' }}>
            {progressPercent.toFixed(0)}%
          </span>
        </div>
        <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--input-bg)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '4px',
            width: `${progressPercent}%`,
            backgroundColor: 'var(--organic-green)',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      {/* Search + Date Chips + Advanced Filter */}
      <div className="card">
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            className="form-input"
            placeholder={t('Search by buyer name...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '48px', width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          {dateChips.map(chip => (
            <button
              key={chip}
              onClick={() => setDateFilter(chip)}
              style={{
                padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', fontWeight: 700,
                fontSize: '0.82rem', fontFamily: 'inherit', border: 'none',
                backgroundColor: dateFilter === chip ? 'var(--primary-milk)' : 'var(--input-bg)',
                color: dateFilter === chip ? '#FFFFFF' : 'var(--text-secondary)',
                transition: 'all 0.15s'
              }}
            >
              {chip === 'All' ? 'All Time' : t(chip)}
            </button>
          ))}
        </div>

        <button
          className="btn btn-outline"
          onClick={() => setShowFilterDialog(true)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <SlidersHorizontal size={16} />
          Advanced Filters
          {activeFilterCount > 0 && (
            <span style={{
              backgroundColor: 'var(--primary-milk)', color: '#FFF',
              borderRadius: '10px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 800
            }}>
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Invoice List */}
      <div className="card" style={{ padding: '24px 0' }}>
        <div style={{ padding: '0 24px 16px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.2rem', margin: 0 }}>
            Transactions History ({filteredInvoices.length})
          </h3>
        </div>

        {filteredInvoices.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No sales records match the current filters.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredInvoices.map((sale) => (
              <div
                key={sale.id}
                className="list-item"
                onClick={() => onInvoiceClick(sale)}
                style={{ cursor: 'pointer', flexWrap: 'wrap', gap: '12px' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{sale.customerName}</span>
                    {sale.paymentStatus === 'PAID' ? (
                      <CheckCircle size={14} style={{ color: 'var(--organic-green)' }} />
                    ) : (
                      <Clock size={14} style={{ color: 'var(--alert-red)' }} />
                    )}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {new Date(sale.createdAt).toLocaleDateString(language === 'ta' ? 'ta-IN' : 'en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {t(sale.milkType)} • {sale.liters} L • ₹{sale.ratePerLiter}/L
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Bill Amount</span>
                    <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--primary-milk)' }}>
                      ₹{sale.totalAmount.toFixed(2)}
                    </div>
                  </div>
                  <span className={`badge ${sale.paymentStatus === 'PAID' ? 'badge-paid' : 'badge-pending'}`}>
                    {t(sale.paymentStatus)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Advanced Filter Dialog */}
      {showFilterDialog && (
        <div className="dialog-overlay" onClick={() => setShowFilterDialog(false)}>
          <div className="dialog-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={20} style={{ color: 'var(--primary-milk)' }} />
                Filter Ledger
              </h3>
              <button className="tab-btn" onClick={() => setShowFilterDialog(false)} style={{ padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            <FilterSection label="Payment Status">
              {['All', 'PAID', 'PENDING'].map(val => (
                <ChipButton key={val} label={val === 'All' ? 'All' : t(val)} selected={filterStatus === val} onClick={() => setFilterStatus(val)} />
              ))}
            </FilterSection>

            <FilterSection label="Payment Mode Method">
              {['All', 'CASH', 'UPI', 'BANK', 'NONE'].map(val => (
                <ChipButton key={val} label={val === 'All' ? 'All' : t(val)} selected={filterPaymentType === val} onClick={() => setFilterPaymentType(val)} />
              ))}
            </FilterSection>

            <FilterSection label="Dairy Collection Shift">
              {[
                { val: 'All', label: 'All Day' },
                { val: 'Morning', label: 'Morning (5am–12pm)' },
                { val: 'Evening', label: 'Evening (12pm–10pm)' },
              ].map(({ val, label }) => (
                <ChipButton key={val} label={label} selected={filterTimeShift === val} onClick={() => setFilterTimeShift(val)} />
              ))}
            </FilterSection>

            <FilterSection label="Custom Date Range">
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>From Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={filterStartDate}
                    onChange={(e) => {
                      setFilterStartDate(e.target.value);
                      if (e.target.value) setDateFilter('Custom Range');
                    }}
                    style={{ padding: '8px', fontSize: '0.85rem' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>To Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={filterEndDate}
                    onChange={(e) => {
                      setFilterEndDate(e.target.value);
                      if (e.target.value) setDateFilter('Custom Range');
                    }}
                    style={{ padding: '8px', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            </FilterSection>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="btn btn-outline" onClick={resetAdvancedFilters} style={{ flex: 1 }}>
                Reset Filters
              </button>
              <button className="btn btn-primary" onClick={() => setShowFilterDialog(false)} style={{ flex: 1 }}>
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
        {label}
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>{children}</div>
    </div>
  );
}

function ChipButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700,
        fontSize: '0.8rem', fontFamily: 'inherit',
        border: `1.5px solid ${selected ? 'var(--primary-milk)' : 'var(--border-color)'}`,
        backgroundColor: selected ? 'rgba(30,136,229,0.1)' : 'transparent',
        color: selected ? 'var(--primary-milk)' : 'var(--text-secondary)',
        transition: 'all 0.15s'
      }}
    >
      {label}
    </button>
  );
}
