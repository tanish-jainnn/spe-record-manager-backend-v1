import DailyBusiness from '../models/DailyBusiness.js';
import Holiday from '../models/Holiday.js';
import Settings from '../models/Settings.js';
import { monthRange, toDateStr } from '../utils/dates.js';

/**
 * Pure: one entry per day of the month with its status.
 * entered | holiday | weeklyoff | future | today | missing
 */
export function buildMonth(ym, holidays, weeklyOff, records, today) {
  const [y, m] = ym.split('-').map(Number); const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days = [];
  for (let d = 1; d <= n; d += 1) {
    const date = `${ym}-${String(d).padStart(2, '0')}`; const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    const hol = holidays.find((h) => h.from <= date && date <= h.to) || null; const off = weeklyOff.includes(dow); const rec = records.get(date);
    const status = rec !== undefined ? 'entered' : hol ? 'holiday' : off ? 'weeklyoff' : date > today ? 'future' : date === today ? 'today' : 'missing';
    days.push({ date, dow, orders: rec ?? null, holiday: hol ? { id: hol.id, name: hol.name } : null, weeklyOff: off, status });
  }
  const holidayDays = days.filter((x) => x.holiday).length; const offDays = days.filter((x) => !x.holiday && x.weeklyOff).length;
  return { days, summary: { daysInMonth: n, holidayDays, weeklyOffDays: offDays, workingDays: n - holidayDays - offDays, entered: days.filter((x) => x.status === 'entered').length, missing: days.filter((x) => x.status === 'missing').length } };
}

export async function monthCalendar(ym, today) {
  const { from, to } = monthRange(ym);
  const [hols, recs, cfg] = await Promise.all([Holiday.find({ from: { $lte: to }, to: { $gte: from } }).sort({ from: 1 }), DailyBusiness.find({ date: { $gte: from, $lte: to } }), Settings.findOne({ key: 'main' })]);
  const records = new Map(recs.map((r) => [toDateStr(r.date), r.toJSON().totalOrders]));
  const weeklyOff = cfg?.weeklyOff || [];
  return { month: ym, weeklyOff, holidays: hols.map((h) => h.toJSON()).map((h) => ({ ...h, id: String(h._id) })), ...buildMonth(ym, hols.map((h) => ({ id: String(h._id), name: h.name, from: toDateStr(h.from), to: toDateStr(h.to) })), weeklyOff, records, today) };
}
