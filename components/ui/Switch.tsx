'use client';

import React from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export default function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', gap: 12 }}>
      {label && (
        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
      )}
      <button
        type="button"
        disabled={disabled}
        aria-pressed={checked}
        onClick={() => !disabled && onChange(!checked)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 999,
          border: 'none',
          padding: 2,
          display: 'flex',
          alignItems: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: checked ? 'var(--primary-milk)' : 'var(--input-border)',
          opacity: disabled ? 0.5 : 1,
          transition: 'background var(--transition-fast)',
        }}
      >
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: 'var(--shadow-sm)',
            transform: checked ? 'translateX(20px)' : 'translateX(0)',
            transition: 'transform var(--transition-fast)',
          }}
        />
      </button>
    </div>
  );
}
