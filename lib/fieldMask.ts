import { canAccessField } from './permissions';

export function maskField(page: string, field: string, value: string | number): string {
  if (canAccessField(page, field)) return String(value);
  return '••••';
}

export function maskCurrency(page: string, field: string, value: number): string {
  if (canAccessField(page, field)) return `₹${value.toFixed(2)}`;
  return '₹••••';
}
