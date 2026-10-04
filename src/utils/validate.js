import { AppError } from './AppError.js';

export function toCount(value, label) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 10_000_000) {
    throw new AppError(`${label} must be a whole number (0 or more).`);
  }
  return n;
}
export function toMoney(value, label, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new AppError(`${label} is required.`);
    return 0;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1e10) throw new AppError(`${label} must be a number (0 or more).`);
  return Math.round(n * 100) / 100;
}
export const cleanStr = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
