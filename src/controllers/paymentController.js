import mongoose from 'mongoose';
import Purchase from '../models/Purchase.js';
import Payment from '../models/Payment.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { parseDate } from '../utils/dates.js';
import { cleanStr, toMoney } from '../utils/validate.js';
import { logActivity } from '../services/activity.js';

const METHODS = { CASH: 'Cash', PAYTM: 'Paytm', UPI: 'UPI', BANK: 'Bank transfer', CHEQUE: 'Cheque', OTHER: 'Other' };

const find = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid purchase id.');
  const p = await Purchase.findById(id);
  if (!p) throw new AppError('Purchase not found.', 404);
  return p;
};
async function recalc(p) {
  const [row] = await Payment.aggregate([{ $match: { purchase: p._id } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]);
  p.paidAmount = Math.round((row?.sum || 0) * 100) / 100;
  await p.save();
  return p;
}

export const listPayments = asyncHandler(async (req, res) => {
  const p = await find(req.params.id);
  res.json({ purchase: p, payments: await Payment.find({ purchase: p._id }).sort({ date: -1, createdAt: -1 }) });
});

export const addPayment = asyncHandler(async (req, res) => {
  const p = await find(req.params.id);
  const b = req.body || {};
  const amount = toMoney(b.amount, 'Amount', { required: true });
  if (!(amount > 0)) throw new AppError('Payment amount must be above 0.');
  const due = Math.max(0, p.totalAmount - (p.paidAmount || 0));
  if (amount > due + 0.009) throw new AppError(`That is more than the amount due (₹${due.toFixed(2)}).`);
  const method = b.method === undefined ? 'CASH' : String(b.method).toUpperCase();
  if (!METHODS[method]) throw new AppError('Payment method must be Cash, Paytm, UPI, Bank transfer, Cheque or Other.');
  await Payment.create({ purchase: p._id, date: parseDate(b.date), amount, method, note: cleanStr(b.note, 300) });
  await recalc(p);
  logActivity('payment.add', `Paid ₹${amount} (${METHODS[method]}) to ${p.supplier} for bill ${p.billNumber}`);
  res.status(201).json({ purchase: p, payments: await Payment.find({ purchase: p._id }).sort({ date: -1, createdAt: -1 }) });
});

export const deletePayment = asyncHandler(async (req, res) => {
  const p = await find(req.params.id);
  if (!mongoose.isValidObjectId(req.params.pid)) throw new AppError('Invalid payment id.');
  const d = await Payment.findOneAndDelete({ _id: req.params.pid, purchase: p._id });
  if (!d) throw new AppError('Payment not found.', 404);
  await recalc(p);
  logActivity('payment.delete', `Removed a ₹${d.amount} payment on bill ${p.billNumber} (${p.supplier})`);
  res.json({ purchase: p, payments: await Payment.find({ purchase: p._id }).sort({ date: -1, createdAt: -1 }) });
});
