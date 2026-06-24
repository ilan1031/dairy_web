'use client';

import React from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface AppToastProps {
  message: string;
  show: boolean;
  type?: ToastType;
}

const COLORS: Record<ToastType, string> = {
  success: 'var(--organic-green)',
  error: 'var(--alert-red)',
  info: 'var(--primary-milk)',
};

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '⚠',
  info: 'ℹ',
};

export default function AppToast({ message, show, type = 'success' }: AppToastProps) {
  if (!show || !message) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        backgroundColor: COLORS[type],
        color: '#FFFFFF',
        padding: '14px 20px',
        borderRadius: 'var(--radius-sm)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        zIndex: 2000,
        fontWeight: 600,
        maxWidth: 'min(90vw, 360px)',
        animation: 'toastSlide var(--transition-fast)',
      }}
    >
      <span>{ICONS[type]}</span>
      <span>{message}</span>
    </div>
  );
}
