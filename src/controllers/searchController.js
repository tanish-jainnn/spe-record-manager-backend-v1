import DailyBusiness from '../models/DailyBusiness.js';
import Purchase from '../models/Purchase.js';
import { asyncHandler } from '../utils/AppError.js';
import { monthRange, toDateStr } from '../utils/dates.js';
import { escapeRegex } from '../utils/validate.js';

export const search = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (q.length < 2) return res.json({ purchases: [], days: [] });
  const rx = new RegExp(escapeRegex(q), 'i');
  const purchases = await Purchase.find({ $or: [{ supplier: rx }, { billNumber: rx }, { notes: rx }] }).sort({ date: -1 }).limit(8);
  let days = [];
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(q);
  if (m) {
    let from; let to;
    if (m[3]) { from = new Date(`${q}T00:00:00.000Z`); to = from; } else if (+m[2] >= 1 && +m[2] <= 12) { ({ from, to } = monthRange(`${m[1]}-${m[2]}`)); }
    if (from && !Number.isNaN(from.getTime())) days = await DailyBusiness.find({ date: { $gte: from, $lte: to } }).sort({ date: -1 }).limit(8);
  }
  res.json({ purchases, days: days.map((d) => ({ date: toDateStr(d.date), totalOrders: d.toJSON().totalOrders })) });
});
