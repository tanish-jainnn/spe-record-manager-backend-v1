import mongoose from 'mongoose';
import Purchase from '../models/Purchase.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { parseDate, parseRange } from '../utils/dates.js';
import { cleanStr, escapeRegex, toMoney } from '../utils/validate.js';
import { purchaseCounters, supplierSummary } from '../services/reportService.js';

function readBody(b, partial = false) {
  const out = {};
  const has = (k) => b[k] !== undefined;
  if (!partial || has('date')) out.date = parseDate(b.date, 'Purchase date');
  if (!partial || has('supplier')) {
    out.supplier = cleanStr(b.supplier);
    if (!out.supplier) throw new AppError('Supplier name is required.');
  }
  if (!partial || has('billNumber')) {
    out.billNumber = cleanStr(b.billNumber, 100);
    if (!out.billNumber) throw new AppError('Bill number is required.');
  }
  if (!partial || has('billType')) {
    if (!['GST', 'NON_GST'].includes(b.billType)) throw new AppError('Bill type must be GST or NON_GST.');
    out.billType = b.billType;
  }
  if (!partial || has('status')) {
    const s = b.status || 'PENDING';
    if (!['RECEIVED', 'PENDING'].includes(s)) throw new AppError('Status must be RECEIVED or PENDING.');
    out.status = s;
  }
  if (has('taxableAmount')) out.taxableAmount = toMoney(b.taxableAmount, 'Taxable amount');
  if (has('gstAmount')) out.gstAmount = toMoney(b.gstAmount, 'GST amount');
  if (has('totalAmount') || !partial) out.totalAmount = toMoney(b.totalAmount, 'Total amount', { required: !partial });
  if (has('notes')) out.notes = cleanStr(b.notes, 1000);
  return out;
}

export const createPurchase = asyncHandler(async (req, res) => {
  const data = readBody(req.body || {});
  if (data.billType === 'NON_GST') { data.taxableAmount = 0; data.gstAmount = 0; }
  if (!(data.totalAmount > 0)) throw new AppError('Total amount must be greater than 0.');
  res.status(201).json({ purchase: await Purchase.create(data) });
});

export const listPurchases = asyncHandler(async (req, res) => {
  const { type, status, supplier, q, from, to } = req.query;
  const f = {};
  if (type) f.billType = type === 'GST' ? 'GST' : 'NON_GST';
  if (status) f.status = status === 'PENDING' ? 'PENDING' : 'RECEIVED';
  if (supplier) f.supplier = new RegExp(`^${escapeRegex(String(supplier))}$`, 'i');
  if (q) f.$or = [{ supplier: new RegExp(escapeRegex(String(q)), 'i') }, { billNumber: new RegExp(escapeRegex(String(q)), 'i') }];
  if (from && to) { const r = parseRange({ from, to }); f.date = { $gte: r.from, $lte: r.to }; }
  const purchases = await Purchase.find(f).sort({ date: -1, createdAt: -1 }).limit(2000);
  res.json({ purchases });
});

export const updatePurchase = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid purchase id.');
  const data = readBody(req.body || {}, true);
  if (data.billType === 'NON_GST') { data.taxableAmount = 0; data.gstAmount = 0; }
  const purchase = await Purchase.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
  if (!purchase) throw new AppError('Purchase not found.', 404);
  res.json({ purchase });
});

export const deletePurchase = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid purchase id.');
  const p = await Purchase.findByIdAndDelete(req.params.id);
  if (!p) throw new AppError('Purchase not found.', 404);
  res.json({ message: 'Purchase deleted.' });
});

export const purchaseSummary = asyncHandler(async (_req, res) => {
  const [counters, suppliers] = await Promise.all([purchaseCounters(), supplierSummary()]);
  res.json({ counters, suppliers });
});
