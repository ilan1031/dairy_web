'use client';

import React from 'react';
import { CreditCard, Phone, Mail } from 'lucide-react';
import Repository from '@/lib/repository';
import { getSubscriptionStatus } from '@/lib/subscription';

interface PayNowScreenProps {
  onLogout: () => void;
}

export default function PayNowScreen({ onLogout }: PayNowScreenProps) {
  const status = getSubscriptionStatus();
  const profile = Repository.getProfile();

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(211,47,47,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <CreditCard size={36} style={{ color: 'var(--alert-red)' }} />
        </div>
        <h1 style={{ color: '#0D47A1', fontSize: '1.6rem', fontWeight: 900, marginBottom: 8 }}>Renew Subscription</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 20 }}>
          {status.paymentMessage || 'Your subscription has expired. Please contact admin to renew access.'}
        </p>
        {status.expiresAt && (
          <p style={{ fontSize: '0.82rem', color: 'var(--alert-red)', fontWeight: 700, marginBottom: 16 }}>
            Due date: {new Date(status.expiresAt).toLocaleDateString()}
          </p>
        )}
        <div style={{ background: 'var(--input-bg)', borderRadius: 10, padding: 16, marginBottom: 20, textAlign: 'left' }}>
          <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.85rem' }}>Contact support to pay &amp; restore access:</p>
          <p style={{ margin: '4px 0', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={14} /> {profile.emailAddress || 'admin@dairy.local'}
          </p>
          <p style={{ margin: '4px 0', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Phone size={14} /> {profile.mobileNumber || 'Contact admin'}
          </p>
        </div>
        <button type="button" className="btn btn-primary" style={{ width: '100%', marginBottom: 10 }} onClick={() => window.location.reload()}>
          Check Again
        </button>
        <button type="button" className="btn btn-outline" style={{ width: '100%' }} onClick={onLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}
