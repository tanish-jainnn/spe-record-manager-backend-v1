import { AppError } from './AppError.js';
import { env } from '../config/env.js';

export function parseDate(s, label = 'Date') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) throw new AppError(`${label} must be in YYYY-MM-DD format.`);
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw new AppError(`${label} is not a valid calendar date.`);
  return d;
}
export const toDateStr = (d) => new Date(d).toISOString().slice(0, 10);
export const todayStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: env.timezone }).format(new Date());

export function monthRange(month) {
  const m = month || todayStr().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) throw new AppError('Month must be in YYYY-MM format.');
  const [y, mo] = m.split('-').map(Number);
  return { month: m, from: new Date(Date.UTC(y, mo - 1, 1)), to: new Date(Date.UTC(y, mo, 0)) };
}

export function parseRange(query) {
  const from = parseDate(query.from, 'From date');
  const to = parseDate(query.to, 'To date');
  if (from > to) throw new AppError('"From" date must be on or before "To" date.');
  if ((to - from) / 864e5 > 3660) throw new AppError('Date range is too large (max 10 years).');
  return { from, to };
}
