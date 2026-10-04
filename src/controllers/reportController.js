import { asyncHandler, AppError } from '../utils/AppError.js';
import { monthRange, parseRange, toDateStr } from '../utils/dates.js';
import { fetchRecords, groupRecords, totalsOf } from '../services/reportService.js';

export const monthReport = asyncHandler(async (req, res) => {
  const { month, from, to } = monthRange(req.query.month);
  const records = await fetchRecords(from, to);
  res.json({ month, from: toDateStr(from), to: toDateStr(to), totals: totalsOf(records), rows: groupRecords(records, 'day') });
});

export const rangeReport = asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req.query);
  const group = req.query.group || 'day';
  if (!['day', 'week', 'month'].includes(group)) throw new AppError('group must be day, week or month.');
  const records = await fetchRecords(from, to);
  res.json({ from: toDateStr(from), to: toDateStr(to), group, totals: totalsOf(records), rows: groupRecords(records, group) });
});
