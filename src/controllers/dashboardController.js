import DailyBusiness from '../models/DailyBusiness.js';
import { asyncHandler } from '../utils/AppError.js';
import { monthRange, parseDate, todayStr, toDateStr } from '../utils/dates.js';
import { fetchRecords, purchaseCounters, totalsOf } from '../services/reportService.js';

export const dashboard = asyncHandler(async (req, res) => {
  const date = parseDate(req.query.date || todayStr());
  const { month, from, to } = monthRange(toDateStr(date).slice(0, 7));
  const [today, monthRecords, purchases] = await Promise.all([DailyBusiness.findOne({ date }), fetchRecords(from, to), purchaseCounters()]);
  res.json({ date: toDateStr(date), today, month, monthTotals: totalsOf(monthRecords), purchases });
});
