import Settings from '../models/Settings.js';
import { asyncHandler, AppError } from '../utils/AppError.js';
import { cleanStr } from '../utils/validate.js';
import { env } from '../config/env.js';
import { logActivity } from '../services/activity.js';

const PL = ['amazon', 'flipkart', 'meesho', 'snapdeal'];
const num = (v, label, min, max) => {
  const n = Number(v);
  if (v === '' || v === null || !Number.isFinite(n) || n < min || n > max) throw new AppError(`${label} must be a number between ${min} and ${max}.`);
  return Math.round(n * 100) / 100;
};

const get = async () => (await Settings.findOne({ key: 'main' })) || (await Settings.create({ key: 'main' }));
export { get as getSettingsDoc };

export const getSettings = asyncHandler(async (_req, res) => res.json({ settings: await get(), capabilities: { email: Boolean(env.smtpHost && env.smtpUser), cron: env.cronSecret.length >= 16 } }));

export const saveSettings = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const data = {};
  if (b.businessName !== undefined) { data.businessName = cleanStr(b.businessName, 120); if (!data.businessName) throw new AppError('Business name cannot be empty.'); }
  if (b.gstin !== undefined) data.gstin = cleanStr(b.gstin, 20).toUpperCase();
  if (b.address !== undefined) data.address = cleanStr(b.address, 400);
  if (b.phone !== undefined) data.phone = cleanStr(b.phone, 30);
  if (b.defaultExportFormat !== undefined) {
    if (!['csv', 'xlsx'].includes(b.defaultExportFormat)) throw new AppError('Export format must be csv or xlsx.');
    data.defaultExportFormat = b.defaultExportFormat;
  }
  if (b.monthlyOrderTarget !== undefined) data.monthlyOrderTarget = Math.round(num(b.monthlyOrderTarget, 'Monthly target', 0, 10_000_000));
  if (b.returnRateAlert !== undefined) data.returnRateAlert = num(b.returnRateAlert, 'Return-rate limit', 0, 100);
  for (const p of PL) {
    if (b.profitPerOrder?.[p] !== undefined) data[`profitPerOrder.${p}`] = num(b.profitPerOrder[p], `${p} profit per order`, -100000, 100000);
    if (b.lossPerReturn?.[p] !== undefined) data[`lossPerReturn.${p}`] = num(b.lossPerReturn[p], `${p} loss per return`, 0, 100000);
  }
  if (b.summaryEmailEnabled !== undefined) data.summaryEmailEnabled = Boolean(b.summaryEmailEnabled);
  if (b.summaryEmail !== undefined) {
    data.summaryEmail = cleanStr(b.summaryEmail, 160);
    if (data.summaryEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.summaryEmail)) throw new AppError('Enter a valid email address.');
  }
  await get();
  logActivity('settings.save', 'Changed business settings');
  res.json({ settings: await Settings.findOneAndUpdate({ key: 'main' }, { $set: data }, { new: true, runValidators: true }) });
});
