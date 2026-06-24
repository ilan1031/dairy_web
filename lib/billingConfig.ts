export type PaymentIconKey = 'dollar' | 'credit-card' | 'building' | 'clock' | 'wallet' | 'qr';

export interface PaymentMethodConfig {
  code: string;
  label: string;
  color: string;
  icon: PaymentIconKey;
  enabled: boolean;
  marksPending?: boolean;
  lockEdit?: boolean;
  lockDelete?: boolean;
}

export interface BillingConfig {
  paymentMethods: PaymentMethodConfig[];
  volumePresets: number[];
  allowCustomRate: boolean;
  requireLocation: boolean;
  defaultLocation: string;
  showStockWarnings: boolean;
  maxVolume: number;
  volumeStep: number;
  updatedAt: number;
}

export const DEFAULT_BILLING_CONFIG: BillingConfig = {
  paymentMethods: [
    { code: 'CASH', label: 'CASH', color: 'var(--organic-green)', icon: 'dollar', enabled: true },
    { code: 'UPI', label: 'UPI', color: 'var(--primary-gold)', icon: 'credit-card', enabled: true },
    { code: 'BANK', label: 'BANK', color: 'var(--primary-milk)', icon: 'building', enabled: true },
    { code: 'PENDING', label: 'PENDING', color: 'var(--alert-red)', icon: 'clock', enabled: true, marksPending: true },
  ],
  volumePresets: [0.25, 0.5, 1.0, 2.0, 5.0, 10.0],
  allowCustomRate: true,
  requireLocation: true,
  defaultLocation: 'Simulated Location (GPS Locked)',
  showStockWarnings: true,
  maxVolume: 200,
  volumeStep: 0.25,
  updatedAt: Date.now(),
};

export function normalizeBillingConfig(raw?: Partial<BillingConfig> | null): BillingConfig {
  const base = { ...DEFAULT_BILLING_CONFIG, ...(raw || {}) };
  return {
    ...base,
    paymentMethods: (base.paymentMethods?.length ? base.paymentMethods : DEFAULT_BILLING_CONFIG.paymentMethods).map(m => ({
      ...m,
      enabled: m.enabled !== false,
    })),
    volumePresets: (base.volumePresets?.length ? base.volumePresets : DEFAULT_BILLING_CONFIG.volumePresets)
      .map(n => Number(n))
      .filter(n => !Number.isNaN(n) && n > 0)
      .sort((a, b) => a - b),
    updatedAt: base.updatedAt || Date.now(),
  };
}
