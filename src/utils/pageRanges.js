import { AppError } from './AppError.js';

const asParts = (input) => (Array.isArray(input) ? input.map(String) : String(input ?? '').split(','));

/** "1,3-5" or [1,3,'4-5'] -> sorted unique zero-based page indexes. */
export function parsePages(input, total) {
  const set = new Set();
  for (const raw of asParts(input)) {
    const t = raw.trim();
    if (!t) continue;
    const m = /^(\d+)\s*(?:-\s*(\d+))?$/.exec(t);
    if (!m) throw new AppError(`"${t}" is not a valid page number or range.`);
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < a || b > total) throw new AppError(`Pages must be between 1 and ${total} ("${t}" is not).`);
    for (let i = a; i <= b; i++) set.add(i - 1);
  }
  if (!set.size) throw new AppError('No pages were selected.');
  return [...set].sort((x, y) => x - y);
}

/** "1-3,4-6" -> [[0,1,2],[3,4,5]] (one output PDF per range). */
export function parseRanges(input, total) {
  const groups = asParts(input).map((s) => s.trim()).filter(Boolean);
  if (!groups.length) throw new AppError('Enter at least one page range, e.g. 1-3,4-6.');
  if (groups.length > 100) throw new AppError('Too many ranges (max 100).');
  return groups.map((g) => parsePages(g, total));
}

/** Full new order (1-based) -> zero-based permutation. */
export function parseOrder(input, total) {
  const arr = (Array.isArray(input) ? input : String(input ?? '').split(',')).map((x) => Number(String(x).trim()));
  const ok = arr.length === total && new Set(arr).size === total && arr.every((n) => Number.isInteger(n) && n >= 1 && n <= total);
  if (!ok) throw new AppError(`The new order must list every page from 1 to ${total} exactly once.`);
  return arr.map((n) => n - 1);
}
