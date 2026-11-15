import { asyncHandler, AppError } from '../utils/AppError.js';
import { cleanStr } from '../utils/validate.js';
import { todayStr } from '../utils/dates.js';
import { logActivity } from '../services/activity.js';
import { getSettingsDoc } from './settingsController.js';
import { makeLabels, SIZES } from '../services/labelMaker.js';

const MAX_PAGES = 150;

export const labelDefaults = asyncHandler(async (_req, res) => {
  const s = await getSettingsDoc();
  res.json({ sender: { name: s.businessName || '', address: s.address || '', phone: s.phone || '' }, sizes: Object.entries(SIZES).map(([id, v]) => ({ id, name: v.name })) });
});

export const make = asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!Array.isArray(b.labels) || !b.labels.length) throw new AppError('Add at least one label.');
  const out = [];
  b.labels.forEach((l, i) => {
    const n = i + 1;
    const awb = cleanStr(l.awb, 40).replace(/\s/g, '');
    if (!/^[A-Za-z0-9\-_./]{3,40}$/.test(awb)) throw new AppError(`Label ${n}: AWB number must be 3 to 40 letters or numbers.`);
    const name = cleanStr(l.name, 80); if (!name) throw new AppError(`Label ${n}: customer name is required.`);
    const address = String(l.address ?? '').replace(/\u0000/g, '').slice(0, 400).trim(); if (!address) throw new AppError(`Label ${n}: address is required.`);
    const pincode = String(l.pincode ?? '').replace(/\D/g, ''); if (pincode && pincode.length !== 6) throw new AppError(`Label ${n}: pincode must be 6 digits.`);
    const copies = Math.min(50, Math.max(1, Number.parseInt(l.copies, 10) || 1));
    const payment = l.payment === 'COD' ? 'COD' : 'PREPAID'; const codAmount = Number(l.codAmount) || 0;
    if (payment === 'COD' && !(codAmount > 0)) throw new AppError(`Label ${n}: enter the COD amount.`);
    const row = { awb, name, address, city: cleanStr(l.city, 60), state: cleanStr(l.state, 60), pincode, phone: cleanStr(l.phone, 20), courier: cleanStr(l.courier, 30), orderId: cleanStr(l.orderId, 40), product: cleanStr(l.product, 60), qty: Math.min(9999, Math.max(0, Number.parseInt(l.qty, 10) || 0)) || '', weight: cleanStr(l.weight, 15), note: cleanStr(l.note, 24), payment, codAmount, date: cleanStr(l.date, 12) };
    for (let c = 0; c < copies; c += 1) out.push(row);
  });
  if (out.length > MAX_PAGES) throw new AppError(`That makes ${out.length} labels. Please make at most ${MAX_PAGES} at a time.`);
  const sender = b.showSender === false ? null : { name: cleanStr(b.sender?.name, 80), address: String(b.sender?.address ?? '').slice(0, 300), phone: cleanStr(b.sender?.phone, 20) };
  const warnings = [];
  const pdf = await makeLabels(out, { size: SIZES[b.size] ? b.size : '3x5', sender, showSender: b.showSender !== false, date: todayStr().split('-').reverse().join('-'), warnings });
  logActivity('label.make', `Made ${out.length} shipping label(s)`);
  res.json({ filename: `labels-${todayStr()}.pdf`, file: pdf.toString('base64'), pages: out.length, warnings });
});
