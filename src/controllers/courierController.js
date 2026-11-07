import mongoose from 'mongoose';
import CourierEntry from '../models/CourierEntry.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { parseDate, parseRange, toDateStr } from '../utils/dates.js';
import { cleanStr, toCount } from '../utils/validate.js';
import { logActivity } from '../services/activity.js';

const PLATFORMS = ['amazon', 'flipkart', 'meesho', 'snapdeal', 'other'];

export const listEntries = asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req.query);
  res.json({ entries: await CourierEntry.find({ date: { $gte: from, $lte: to } }).sort({ date: -1, createdAt: -1 }).limit(1000) });
});

export const addEntry = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const date = parseDate(b.date);
  const courier = cleanStr(b.courier, 60).replace(/\s+/g, ' ');
  if (!courier) throw new AppError('Courier name is required.');
  if (!['RETURN', 'RTO'].includes(b.type)) throw new AppError('Type must be RETURN or RTO.');
  const platform = PLATFORMS.includes(b.platform) ? b.platform : 'other';
  const count = toCount(b.count, 'Count');
  if (count < 1) throw new AppError('Count must be at least 1.');
  const key = courier.toLowerCase();
  const known = await CourierEntry.findOne({ courierKey: key }).select('courier'); // reuse the spelling already used before
  const entry = await CourierEntry.create({ date, courier: known?.courier || courier, courierKey: key, platform, type: b.type, count, note: cleanStr(b.note, 300) });
  logActivity('courier.add', `Added ${count} ${b.type} via ${entry.courier} on ${toDateStr(date)}`);
  res.status(201).json({ entry });
});

export const deleteEntry = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid id.');
  const e = await CourierEntry.findByIdAndDelete(req.params.id);
  if (!e) throw new AppError('Entry not found.', 404);
  logActivity('courier.delete', `Deleted ${e.count} ${e.type} via ${e.courier} (${toDateStr(e.date)})`);
  res.json({ message: 'Deleted.' });
});

export async function courierRows(from, to) {
  const rows = await CourierEntry.aggregate([
    { $match: { date: { $gte: from, $lte: to } } },
    { $group: {
      _id: '$courierKey', courier: { $first: '$courier' },
      returns: { $sum: { $cond: [{ $eq: ['$type', 'RETURN'] }, '$count', 0] } },
      rto: { $sum: { $cond: [{ $eq: ['$type', 'RTO'] }, '$count', 0] } },
      amazon: { $sum: { $cond: [{ $eq: ['$platform', 'amazon'] }, '$count', 0] } },
      flipkart: { $sum: { $cond: [{ $eq: ['$platform', 'flipkart'] }, '$count', 0] } },
      meesho: { $sum: { $cond: [{ $eq: ['$platform', 'meesho'] }, '$count', 0] } },
      snapdeal: { $sum: { $cond: [{ $eq: ['$platform', 'snapdeal'] }, '$count', 0] } },
      other: { $sum: { $cond: [{ $eq: ['$platform', 'other'] }, '$count', 0] } },
    } },
    { $project: { _id: 0, courier: 1, returns: 1, rto: 1, total: { $add: ['$returns', '$rto'] }, amazon: 1, flipkart: 1, meesho: 1, snapdeal: 1, other: 1 } },
    { $sort: { total: -1, courier: 1 } },
  ]);
  return rows;
}

export const report = asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req.query);
  const rows = await courierRows(from, to);
  const totals = rows.reduce((t, r) => ({ returns: t.returns + r.returns, rto: t.rto + r.rto, total: t.total + r.total }), { returns: 0, rto: 0, total: 0 });
  res.json({ from: toDateStr(from), to: toDateStr(to), rows, totals });
});

export const names = asyncHandler(async (_req, res) => {
  res.json({ names: (await CourierEntry.aggregate([{ $group: { _id: '$courierKey', n: { $first: '$courier' }, c: { $sum: '$count' } } }, { $sort: { c: -1 } }, { $limit: 50 }])).map((x) => x.n) });
});
