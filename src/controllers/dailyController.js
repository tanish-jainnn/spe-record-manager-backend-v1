import DailyBusiness from '../models/DailyBusiness.js';
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
    returnsReceived: toCount(b.returnsReceived, 'Returns received'),
    rtoReceived: toCount(b.rtoReceived, 'RTO received'),
  };
  const existed = await DailyBusiness.exists({ date });
  const record = await DailyBusiness.findOneAndUpdate({ date }, { $set: data }, { upsert: true, new: true, runValidators: true });
  res.status(existed ? 200 : 201).json({ record, created: !existed });
});

export const rangeDays = asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req.query);
  const records = await DailyBusiness.find({ date: { $gte: from, $lte: to } }).sort({ date: -1 });
  res.json({ from: toDateStr(from), to: toDateStr(to), records });
});
