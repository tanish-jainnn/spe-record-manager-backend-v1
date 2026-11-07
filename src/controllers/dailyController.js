import { logActivity } from '../services/activity.js';
import DailyBusiness, { PLATFORMS } from '../models/DailyBusiness.js';
import { asyncHandler } from '../utils/AppError.js';
import { parseDate, parseRange, toDateStr } from '../utils/dates.js';
import { toCount } from '../utils/validate.js';

export const getDay = asyncHandler(async (req, res) => {
  const date = parseDate(req.query.date);
  const record = await DailyBusiness.findOne({ date });
  res.json({ date: toDateStr(date), record });
});

/** Create OR update: one record per calendar date, never a duplicate. */
export const saveDay = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const date = parseDate(b.date);
  const data = {
    amazonOrders: toCount(b.amazonOrders, 'Amazon orders'),
    flipkartOrders: toCount(b.flipkartOrders, 'Flipkart orders'),
    meeshoOrders: toCount(b.meeshoOrders, 'Meesho orders'),
    snapdealOrders: toCount(b.snapdealOrders, 'Snapdeal orders'),
  };
  const split = PLATFORMS.some((p) => b[`${p}Returns`] !== undefined || b[`${p}Rto`] !== undefined);
  if (split) {
    let r = 0; let t = 0;
    PLATFORMS.forEach((p) => {
      const label = p[0].toUpperCase() + p.slice(1);
      data[`${p}Returns`] = toCount(b[`${p}Returns`] ?? 0, `${label} returns`); r += data[`${p}Returns`];
      data[`${p}Rto`] = toCount(b[`${p}Rto`] ?? 0, `${label} RTO`); t += data[`${p}Rto`];
    });
    data.returnsReceived = r; data.rtoReceived = t;
  } else {
    data.returnsReceived = toCount(b.returnsReceived, 'Returns received');
    data.rtoReceived = toCount(b.rtoReceived, 'RTO received');
  }
  const existed = await DailyBusiness.exists({ date });
  const record = await DailyBusiness.findOneAndUpdate({ date }, { $set: data }, { upsert: true, new: true, runValidators: true });
  logActivity('daily.save', `${existed ? 'Updated' : 'Added'} the daily record for ${toDateStr(date)} (${record.toJSON().totalOrders} orders)`);
  res.status(existed ? 200 : 201).json({ record, created: !existed });
});

export const rangeDays = asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req.query);
  const records = await DailyBusiness.find({ date: { $gte: from, $lte: to } }).sort({ date: -1 });
  res.json({ from: toDateStr(from), to: toDateStr(to), records });
});
