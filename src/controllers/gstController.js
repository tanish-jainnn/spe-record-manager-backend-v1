import Purchase from '../models/Purchase.js';
import Settings from '../models/Settings.js';
import { asyncHandler, AppError } from '../utils/AppError.js';
import { monthRange, todayStr } from '../utils/dates.js';
import { cleanStr } from '../utils/validate.js';
import { logActivity } from '../services/activity.js';
import { getSettingsDoc } from './settingsController.js';
import { readUploads } from '../services/gst/readers.js';
import { compute, DEFAULT_HSN, DEFAULT_AMAZON_ECO, r2 } from '../services/gst/compute.js';
import { verify } from '../services/gst/verify.js';
import { buildWorkbook } from '../services/gst/workbook.js';

const GSTIN = /^\d{2}[A-Z0-9]{13}$/;

const gstOf = (s) => ({ sellerGstin: s.gst?.sellerGstin || '', amazonEcoGstin: s.gst?.amazonEcoGstin || '', hsn: s.gst?.hsn?.length ? s.gst.hsn.map((h) => ({ code: h.code, description: h.description, uqc: h.uqc })) : DEFAULT_HSN });

export const getGstSettings = asyncHandler(async (_req, res) => {
  const s = await getSettingsDoc();
  res.json({ gst: gstOf(s), defaults: { amazonEcoGstin: DEFAULT_AMAZON_ECO } });
});

export const saveGstSettings = asyncHandler(async (req, res) => {
  const b = req.body || {}; const set = {};
  const g = (v, label) => { const x = cleanStr(v, 20).toUpperCase().replace(/\s/g, ''); if (x && !GSTIN.test(x)) throw new AppError(`${label} must be 15 characters, like 07ABCDE1234F1Z5.`); return x; };
  if (b.sellerGstin !== undefined) set['gst.sellerGstin'] = g(b.sellerGstin, 'Your GSTIN');
  if (b.amazonEcoGstin !== undefined) set['gst.amazonEcoGstin'] = g(b.amazonEcoGstin, 'Amazon GSTIN');
  if (b.hsn !== undefined) {
    if (!Array.isArray(b.hsn) || b.hsn.length > 20) throw new AppError('Add up to 20 HSN codes.');
    const seen = new Set();
    set['gst.hsn'] = b.hsn.map((h) => {
      const code = String(h.code ?? '').replace(/\D/g, '');
      if (!/^\d{4,8}$/.test(code)) throw new AppError(`HSN code "${h.code}" must be 4 to 8 digits.`);
      if (seen.has(code)) throw new AppError(`HSN code ${code} is listed twice.`);
      seen.add(code);
      return { code, description: cleanStr(h.description, 120) || 'ADD DESCRIPTION', uqc: cleanStr(h.uqc, 30) || 'NOS-NUMBERS' };
    });
  }
  await getSettingsDoc();
  const s = await Settings.findOneAndUpdate({ key: 'main' }, { $set: set }, { new: true });
  logActivity('gst.settings', 'Changed GST settings');
  res.json({ gst: gstOf(s) });
});

/** One purchase bill as a row of the ITC sheet. Tax split is worked out from the supplier GSTIN state when not entered. */
export function itcRow(p, month, sellerState) {
  const gstin = p.supplierGstin || '';
  const manual = [p.igstAmount, p.cgstAmount, p.sgstAmount].some((v) => v !== null && v !== undefined);
  let igst = 0; let cgst = 0; let sgst = 0; let derived = false;
  if (manual) { igst = p.igstAmount || 0; cgst = p.cgstAmount || 0; sgst = p.sgstAmount || 0; } else {
    derived = true; const tax = p.gstAmount || 0;
    if (gstin && gstin.slice(0, 2) === sellerState) { cgst = r2(tax / 2); sgst = r2(tax - cgst); } else igst = tax;
  }
  return { id: String(p._id), supplier: p.supplier, gstin, invoice: p.billNumber, date: new Date(p.date).toISOString().slice(0, 10), taxable: p.taxableAmount || 0, igst, cgst, sgst, total: p.totalAmount, in2b: p.inGstr2b ? 'Y' : 'N', claim: p.itcMonth === month ? 'Y' : 'N', notes: p.notes || '', derived, missingGstin: !gstin };
}

async function itcFor(month, sellerState) {
  const { to } = monthRange(month);
  const from = new Date(to); from.setUTCMonth(from.getUTCMonth() - 3); from.setUTCDate(1);
  const list = await Purchase.find({ billType: 'GST', date: { $gte: from, $lte: to }, $or: [{ itcMonth: '' }, { itcMonth: null }, { itcMonth: month }, { itcMonth: { $exists: false } }] }).sort({ date: 1, createdAt: 1 }).limit(500);
  return list.map((p) => itcRow(p, month, sellerState));
}

export const listItc = asyncHandler(async (req, res) => {
  const month = String(req.query.month || todayStr().slice(0, 7));
  monthRange(month);
  const s = await getSettingsDoc();
  res.json({ month, sellerState: (s.gst?.sellerGstin || '').slice(0, 2) || '07', bills: await itcFor(month, (s.gst?.sellerGstin || '').slice(0, 2) || '07') });
});

export const generate = asyncHandler(async (req, res) => {
  if (!req.files?.length) throw new AppError('Please add the platform report files first.');
  const s = await getSettingsDoc(); const cfg = gstOf(s);
  const data = await readUploads(req.files);
  if (!data.detected.length) throw new AppError('None of the files looked like a Flipkart, Snapdeal, Meesho or Amazon tax report. Please check the files you selected.', 422);
  const reqMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(req.body?.month || '') ? req.body.month : null;
  const settings = { hsn: cfg.hsn, amazonEcoGstin: cfg.amazonEcoGstin };
  const probe = compute(data, settings, [], { period: reqMonth });
  const itc = await itcFor(probe.period.ym, probe.sellerState);
  const M = compute(data, settings, itc, { period: probe.period.ym });
  M.detected = data.detected;
  const V = verify(M, data);
  const buffer = await buildWorkbook(M, V, { businessName: s.businessName });
  if (M.sellerGstin && M.sellerGstin !== s.gst?.sellerGstin) await Settings.updateOne({ key: 'main' }, { $set: { 'gst.sellerGstin': M.sellerGstin } });
  const T = V.T;
  logActivity('gst.report', `Generated the GST report for ${M.period.label} (${V.nCheck ? `${V.nCheck} checks need attention` : 'all checks pass'})`);
  const slug = String(s.businessName || 'GST').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'GST';
  res.json({
    filename: `GST_${M.period.ym}_${slug}.xlsx`, file: buffer.toString('base64'),
    summary: {
      period: M.period.label, ym: M.period.ym, sellerGstin: M.sellerGstin, netTaxable: T.net, output: { ...T.out, total: r2(T.out.i + T.out.c + T.out.s) }, itc: { ...T.itc, total: r2(T.itc.i + T.itc.c + T.itc.s), bills: T.claimCount },
      tcs: { ...T.tcs, total: r2(T.tcs.i + T.tcs.c + T.tcs.s) }, cash: { ...T.cash, total: r2(T.cash.i + T.cash.c + T.cash.s) }, states: new Set(M.table7.map((x) => x.code)).size,
      platforms: M.eco.map((e) => ({ platform: e.platform === 'Amazon B2C' ? 'Amazon' : e.platform, net: e.net, tax: r2(e.igst + e.cgst + e.sgst) })),
    },
    checks: { overall: V.overall, pass: V.nPass, check: V.nCheck, info: V.nInfo, failing: V.checks.filter((c) => c.status === 'CHECK').map((c) => ({ label: c.label, ours: c.ours, ref: c.ref })) },
    flags: V.flags, detected: data.detected, ignored: data.ignored,
  });
});
