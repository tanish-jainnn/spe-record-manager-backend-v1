import mongoose from 'mongoose';
import Holiday from '../models/Holiday.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { monthRange, parseDate, todayStr, toDateStr } from '../utils/dates.js';
import { cleanStr } from '../utils/validate.js';
import { logActivity } from '../services/activity.js';
import { monthCalendar } from '../services/calendar.js';

export const getCalendar = asyncHandler(async (req, res) => {
  const { month } = monthRange(req.query.month);
  res.json(await monthCalendar(month, todayStr()));
});

export const listHolidays = asyncHandler(async (_req, res) => {
  const from = new Date(`${todayStr()}T00:00:00.000Z`); from.setUTCDate(from.getUTCDate() - 120);
  res.json({ holidays: await Holiday.find({ to: { $gte: from } }).sort({ from: 1 }).limit(300) });
});

export const addHoliday = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const from = parseDate(b.from, 'From date'); const to = parseDate(b.to || b.from, 'To date');
  if (to < from) throw new AppError('The last day must be on or after the first day.');
  if ((to - from) / 864e5 > 60) throw new AppError('A holiday can cover at most 61 days.');
  const name = cleanStr(b.name, 80) || 'Holiday';
  const h = await Holiday.create({ from, to, name });
  logActivity('holiday.add', `Marked ${name} (${toDateStr(from)}${toDateStr(to) !== toDateStr(from) ? ` to ${toDateStr(to)}` : ''}) as a holiday`);
  res.status(201).json({ holiday: h });
});

export const deleteHoliday = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid holiday id.');
  const h = await Holiday.findByIdAndDelete(req.params.id);
  if (!h) throw new AppError('Holiday not found.', 404);
  logActivity('holiday.delete', `Removed the holiday "${h.name}"`);
  res.json({ message: 'Removed.' });
});
