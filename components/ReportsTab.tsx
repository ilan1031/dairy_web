// d:/Gitfiles/dairy/dairy-web/components/ReportsTab.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/app/providers';
import Repository, { Sale } from '@/lib/repository';
import { hasPermission } from '@/lib/permissions';
import { BarChart3, PieChart, TrendingUp, AlertCircle, Droplet, DollarSign } from 'lucide-react';

export default function ReportsTab() {
  const { t } = useLanguage();
  const [sales, setSales] = useState<Sale[]>([]);
  const [intervalFilter, setIntervalFilter] = useState('Today'); // Today, Week, Month, Year, Multi-Year

  useEffect(() => {
    Repository.getAllSales().then(setSales).catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    return sales.filter(s => {
      if (intervalFilter === 'Today') return s.createdAt >= todayMs;
      if (intervalFilter === 'Week') return s.createdAt >= todayMs - 7 * 86400000;
      if (intervalFilter === 'Month') return s.createdAt >= todayMs - 30 * 86400000;
      if (intervalFilter === 'Year') return s.createdAt >= todayMs - 365 * 86400000;
      if (intervalFilter === 'Multi-Year') return s.createdAt >= todayMs - 3 * 365 * 86400000;
      return true;
    });
  }, [sales, intervalFilter]);

  const cowLiters = filtered.filter(s => s.milkType === 'Cow Milk').reduce((sum, s) => sum + s.liters, 0);
  const buffaloLiters = filtered.filter(s => s.milkType === 'Buffalo Milk').reduce((sum, s) => sum + s.liters, 0);
  const a2Liters = filtered.filter(s => s.milkType === 'A2 Milk').reduce((sum, s) => sum + s.liters, 0);

  const totalRev = filtered.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalLit = cowLiters + buffaloLiters + a2Liters;
  const paidAmt = filtered.filter(s => s.paymentStatus === 'PAID').reduce((sum, s) => sum + s.totalAmount, 0);
  const pendingAmt = filtered.filter(s => s.paymentStatus !== 'PAID').reduce((sum, s) => sum + s.totalAmount, 0);
  const collectionPct = totalRev > 0 ? (paidAmt / totalRev) * 100 : 100;
  const estProfit = totalRev * 0.35;

  const topCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(s => { map[s.milkType] = (map[s.milkType] || 0) + s.liters; });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? `${sorted[0][0]} (${sorted[0][1].toFixed(1)}L)` : 'N/A';
  }, [filtered]);

  const highestDebtor = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.filter(s => s.paymentStatus === 'PENDING').forEach(s => {
      map[s.customerName] = (map[s.customerName] || 0) + s.totalAmount;
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? `${sorted[0][0]} (₹${sorted[0][1].toFixed(0)})` : 'None';
  }, [filtered]);

  if (!hasPermission('canRead')) {
    return (
      <div className="card">
        <h3 style={{ margin: 0 }}>Access Denied</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>You do not have permission to view reports.</p>
      </div>
    );
  }

  const totalPayments = paidAmt + pendingAmt;
  const paidPercent = totalPayments > 0 ? (paidAmt / totalPayments) * 100 : 100;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffsetPaid = circumference - (paidPercent / 100) * circumference;
  const maxLit = Math.max(cowLiters, buffaloLiters, a2Liters, 1);
  const cowHeight = (cowLiters / maxLit) * 120;
  const buffaloHeight = (buffaloLiters / maxLit) * 120;
  const a2Height = (a2Liters / maxLit) * 120;

  const intervalChips = ['Today', 'Week', 'Month', 'Year', 'Multi-Year'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header + Interval Chips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>{t('Business Analytics')}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {intervalChips.map(chip => (
            <button
              key={chip}
              onClick={() => setIntervalFilter(chip)}
              style={{
                padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 700,
                fontSize: '0.82rem', fontFamily: 'inherit', border: 'none',
                backgroundColor: intervalFilter === chip ? 'var(--primary-milk)' : 'var(--input-bg)',
                color: intervalFilter === chip ? '#FFFFFF' : 'var(--text-secondary)',
              }}
            >
              {chip === 'Week' ? 'Weekly' : chip === 'Month' ? 'Monthly' : chip === 'Year' ? 'Yearly' : chip === 'Multi-Year' ? 'Multi-Year' : t(chip)}
            </button>
          ))}
        </div>
      </div>

      {/* Operational Insights */}
      <div className="card" style={{ borderLeft: '4px solid var(--primary-gold)', padding: '16px' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <TrendingUp size={16} style={{ color: 'var(--primary-gold)' }} />
          Dynamic Operational Insights
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem' }}>
          <span><strong>Top Category:</strong> {topCategory}</span>
          <span><strong>Highest Debtor:</strong> {highestDebtor}</span>
        </div>
      </div>

      {/* Gross Revenue Banner */}
      <div className="card card-premium" style={{ borderLeftColor: 'var(--primary-milk)', textAlign: 'center', padding: '20px' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Overall Gross Revenue</span>
        <h2 style={{ fontSize: '2.2rem', fontWeight: 900, margin: '6px 0', color: 'var(--primary-milk)' }}>
          ₹{totalRev.toFixed(0)}
        </h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--organic-green)', fontWeight: 700 }}>
          {collectionPct.toFixed(0)}% collected
        </span>
      </div>

      {/* KPI Grid (mobile alignment) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        {[
          { label: 'Dues', value: `₹${pendingAmt.toFixed(0)}`, icon: AlertCircle, color: 'var(--alert-red)' },
          { label: 'Volume', value: `${totalLit.toFixed(1)}L`, icon: Droplet, color: 'var(--primary-milk)' },
          { label: 'Collected', value: `₹${paidAmt.toFixed(0)}`, icon: DollarSign, color: 'var(--organic-green)' },
          { label: 'Est. Profit (35%)', value: `₹${estProfit.toFixed(0)}`, icon: TrendingUp, color: 'var(--primary-gold)' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '14px', textAlign: 'center' }}>
            <kpi.icon size={18} style={{ color: kpi.color, marginBottom: '6px' }} />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{kpi.label}</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 900, color: kpi.color, marginTop: '4px' }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid-cols-3">
        <div className="card card-premium" style={{ borderLeftColor: 'var(--primary-milk)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Revenue Billing</span>
          <h3 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '6px 0', color: 'var(--primary-milk)' }}>
            ₹{totalRev.toFixed(2)}
          </h3>
        </div>
        <div className="card card-premium" style={{ borderLeftColor: 'var(--primary-gold)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Volume Distributed</span>
          <h3 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '6px 0', color: 'var(--primary-gold)' }}>
            {totalLit.toFixed(2)} L
          </h3>
        </div>
        <div className="card card-premium" style={{ borderLeftColor: 'var(--organic-green)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('Average Price')}</span>
          <h3 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '6px 0', color: 'var(--organic-green)' }}>
            ₹{(totalLit > 0 ? totalRev / totalLit : 0).toFixed(2)}/L
          </h3>
        </div>
      </div>

      {/* Charts */}
      <div className="grid-cols-2">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={18} style={{ color: 'var(--primary-milk)' }} />
            Volume Distribution by Milk Type (L)
          </h3>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '180px', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
            {[
              { label: 'Cow', liters: cowLiters, height: cowHeight, color: 'var(--primary-milk)' },
              { label: 'Buffalo', liters: buffaloLiters, height: buffaloHeight, color: 'var(--primary-gold)' },
              { label: 'A2', liters: a2Liters, height: a2Height, color: 'var(--organic-green)' },
            ].map(bar => (
              <div key={bar.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '60px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{bar.liters.toFixed(1)}L</span>
                <div style={{ width: '36px', height: `${bar.height}px`, backgroundColor: bar.color, borderRadius: '4px 4px 0 0' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{bar.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieChart size={18} style={{ color: 'var(--primary-gold)' }} />
            Payment Status Ledger Distribution
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', flexWrap: 'wrap', height: '180px' }}>
            <div style={{ position: 'relative', width: '120px', height: '120px' }}>
              <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="60" cy="60" r={radius} fill="transparent" stroke="var(--alert-red)" strokeWidth="14" />
                <circle cx="60" cy="60" r={radius} fill="transparent" stroke="var(--organic-green)" strokeWidth="14"
                  strokeDasharray={circumference} strokeDashoffset={strokeDashoffsetPaid} />
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Paid</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--organic-green)' }}>{paidPercent.toFixed(0)}%</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--organic-green)' }} />
                <span style={{ fontSize: '0.85rem' }}><strong>{t('Paid')}:</strong> ₹{paidAmt.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--alert-red)' }} />
                <span style={{ fontSize: '0.85rem' }}><strong>{t('Pending')}:</strong> ₹{pendingAmt.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Ledger Table */}
      <div className="card">
        <h3 style={{ fontSize: '1.15rem', marginBottom: '16px', fontWeight: 800 }}>Detailed Ledger Table</h3>
        {filtered.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>No transaction rows to show.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 8px', fontWeight: 700 }}>Customer</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700 }}>Liters</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700 }}>Paid/Pending</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 8px' }}>{item.customerName}</td>
                    <td style={{ padding: '10px 8px' }}>{item.liters}L</td>
                    <td style={{
                      padding: '10px 8px', fontWeight: 700,
                      color: item.paymentStatus === 'PAID' ? 'var(--organic-green)' : 'var(--alert-red)'
                    }}>
                      {t(item.paymentStatus)}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700 }}>₹{item.totalAmount.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
