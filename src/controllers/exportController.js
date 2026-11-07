import ExcelJS from 'exceljs';
import DailyBusiness from '../models/DailyBusiness.js';
import Purchase from '../models/Purchase.js';
import LabelPreset from '../models/LabelPreset.js';
import { asyncHandler, AppError } from '../utils/AppError.js';
import { parseRange, toDateStr } from '../utils/dates.js';
import { toCsv } from '../utils/csv.js';
import { fetchRecords, groupRecords, totalsOf } from '../services/reportService.js';
import Payment from '../models/Payment.js';
import CourierEntry from '../models/CourierEntry.js';
import { courierRows } from './courierController.js';
import { getSettingsDoc } from './settingsController.js';

async function send(res, req, name, headers, rows) {
  const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
  if (format === 'csv') {
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.csv"` });
    return res.send(toCsv(headers, rows));
  }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Report');
  ws.addRow(headers).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3A075C' } };
  rows.forEach((r) => ws.addRow(r.map((c) => (typeof c === 'string' && /^[=+\-@]/.test(c) ? `'${c}` : c))));
  ws.columns.forEach((c, i) => { c.width = Math.max(12, String(headers[i]).length + 4); });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${name}.xlsx"` });
  res.send(Buffer.from(await wb.xlsx.writeBuffer()));
}

const P = ['amazon', 'flipkart', 'meesho', 'snapdeal'];
const dailyRow = (r) => [
  toDateStr(r.date), ...P.map((p) => r[`${p}Orders`] ?? 0), P.reduce((n, p) => n + (r[`${p}Orders`] ?? 0), 0),
  ...P.map((p) => r[`${p}Returns`] ?? 0), r.returnsReceived ?? 0, ...P.map((p) => r[`${p}Rto`] ?? 0), r.rtoReceived ?? 0,
];
const DAILY_HEAD = ['Date', 'Amazon Orders', 'Flipkart Orders', 'Meesho Orders', 'Snapdeal Orders', 'Total Orders', 'Amazon Returns', 'Flipkart Returns', 'Meesho Returns', 'Snapdeal Returns', 'Total Returns', 'Amazon RTO', 'Flipkart RTO', 'Meesho RTO', 'Snapdeal RTO', 'Total RTO'];

export const exportDaily = asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req.query);
  const rows = (await fetchRecords(from, to)).map(dailyRow);
  await send(res, req, `daily-business_${toDateStr(from)}_to_${toDateStr(to)}`, DAILY_HEAD, rows);
});

export const exportReport = asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req.query);
  const group = ['day', 'week', 'month'].includes(req.query.group) ? req.query.group : 'month';
  const records = await fetchRecords(from, to);
  const rows = groupRecords(records, group).map((r) => [r.period, r.amazon, r.flipkart, r.meesho, r.snapdeal, r.totalOrders, r.returns, r.rto]);
  const t = totalsOf(records);
  rows.push(['TOTAL', t.amazon, t.flipkart, t.meesho, t.snapdeal, t.totalOrders, t.returns, t.rto]);
  await send(res, req, `report-${group}_${toDateStr(from)}_to_${toDateStr(to)}`, ['Period', 'Amazon', 'Flipkart', 'Meesho', 'Snapdeal', 'Total Orders', 'Returns', 'RTO'], rows);
});

export const exportPurchases = asyncHandler(async (req, res) => {
  const f = {};
  if (req.query.type) f.billType = req.query.type === 'GST' ? 'GST' : 'NON_GST';
  if (req.query.status) f.status = req.query.status === 'PENDING' ? 'PENDING' : 'RECEIVED';
  if (req.query.from && req.query.to) { const r = parseRange(req.query); f.date = { $gte: r.from, $lte: r.to }; }
  const list = await Purchase.find(f).sort({ date: -1 }).lean();
  const rows = list.map((p) => [toDateStr(p.date), p.supplier, p.billNumber, p.billType === 'GST' ? 'GST' : 'Non-GST', p.taxableAmount, p.gstAmount, p.totalAmount, p.paidAmount ?? 0, Math.max(0, p.totalAmount - (p.paidAmount ?? 0)), p.status === 'RECEIVED' ? 'Received' : 'Pending', p.notes || '']);
  await send(res, req, 'purchases', ['Date', 'Supplier', 'Bill Number', 'Bill Type', 'Taxable Amount', 'GST Amount', 'Total Amount', 'Paid', 'Due', 'Status', 'Notes'], rows);
});

export const exportCouriers = asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req.query);
  const rows = await courierRows(from, to);
  const all = rows.reduce((n, r) => n + r.total, 0);
  await send(res, req, `courier-report_${toDateStr(from)}_to_${toDateStr(to)}`, ['Courier', 'Returns', 'RTO', 'Total', 'Share %', 'Amazon', 'Flipkart', 'Meesho', 'Snapdeal', 'Other'],
    rows.map((r) => [r.courier, r.returns, r.rto, r.total, all ? Math.round((r.total / all) * 1000) / 10 : 0, r.amazon, r.flipkart, r.meesho, r.snapdeal, r.other]));
});

/** Full JSON backup of every collection (no password data). */
export const backup = asyncHandler(async (_req, res) => {
  const [daily, purchases, presets, settings, payments, couriers] = await Promise.all([DailyBusiness.find().sort({ date: 1 }), Purchase.find().sort({ date: 1 }), LabelPreset.find(), getSettingsDoc(), Payment.find(), CourierEntry.find().sort({ date: 1 })]);
  res.set({ 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="spe-backup-${new Date().toISOString().slice(0, 10)}.json"` });
  res.send(JSON.stringify({ exportedAt: new Date().toISOString(), daily, purchases, presets, settings, payments, couriers }, null, 2));
});
