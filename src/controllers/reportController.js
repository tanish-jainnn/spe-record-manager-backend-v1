import Purchase from '../models/Purchase.js';
import Payment from '../models/Payment.js';
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

const sumBills = (from, to) => Purchase.aggregate([
  { $match: { date: { $gte: from, $lte: to } } },
  { $group: {
    _id: null,
    bills: { $sum: 1 }, amount: { $sum: '$totalAmount' },
    gstBills: { $sum: { $cond: [{ $eq: ['$billType', 'GST'] }, 1, 0] } }, gstBillAmount: { $sum: { $cond: [{ $eq: ['$billType', 'GST'] }, '$totalAmount', 0] } }, gstTax: { $sum: '$gstAmount' },
    nonGstBills: { $sum: { $cond: [{ $eq: ['$billType', 'NON_GST'] }, 1, 0] } }, nonGstAmount: { $sum: { $cond: [{ $eq: ['$billType', 'NON_GST'] }, '$totalAmount', 0] } },
    receivedBills: { $sum: { $cond: [{ $eq: ['$status', 'RECEIVED'] }, 1, 0] } }, pendingBills: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
    pendingAmount: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, '$totalAmount', 0] } },
  } },
]);

export const monthSummary = asyncHandler(async (req, res) => {
  const { month, from, to } = monthRange(req.query.month);
  const records = await fetchRecords(from, to);
  const totals = totalsOf(records);
  let best = null;
  for (const r of records) {
    const o = r.amazonOrders + r.flipkartOrders + r.meeshoOrders + r.snapdealOrders;
    if (!best || o > best.orders) best = { date: toDateStr(r.date), orders: o };
  }
  const [row] = await sumBills(from, to);
  const paidRows = await Payment.aggregate([{ $match: { date: { $gte: from, $lte: to } } }, { $group: { _id: '$method', amount: { $sum: '$amount' } } }]);
  const paymentsByMethod = Object.fromEntries(paidRows.map((r) => [r._id, Math.round(r.amount * 100) / 100]));
  const [earlier] = await Purchase.aggregate([{ $match: { status: 'PENDING', date: { $lt: from } } }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } }]);
  const zero = { bills: 0, amount: 0, gstBills: 0, gstBillAmount: 0, gstTax: 0, nonGstBills: 0, nonGstAmount: 0, receivedBills: 0, pendingBills: 0, pendingAmount: 0 };
  res.json({
    paymentsByMethod, month, totals, bestDay: best, averagePerDay: totals.days ? Math.round((totals.totalOrders / totals.days) * 10) / 10 : 0,
    purchases: { ...zero, ...(row || {}), _id: undefined }, earlierPending: { count: earlier?.count || 0, amount: earlier?.amount || 0 },
  });
});
