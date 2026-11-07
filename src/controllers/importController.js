import { logActivity } from '../services/activity.js';
import ExcelJS from 'exceljs';
import DailyBusiness from '../models/DailyBusiness.js';
import Purchase from '../models/Purchase.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { parseDate } from '../utils/dates.js';
import { parseDailyRows, parsePurchaseRows, readSheet } from '../services/importParser.js';

const cap = (errors) => ({ errors: errors.slice(0, 50), moreErrors: Math.max(0, errors.length - 50) });

export const importDaily = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Please choose a file.');
  const overwrite = req.body.mode === 'overwrite';
  const { valid, errors } = parseDailyRows(await readSheet(req.file));
  let imported = 0; let updated = 0; let skipped = 0;
  if (valid.length) {
    const op = overwrite ? '$set' : '$setOnInsert';
    const r = await DailyBusiness.bulkWrite(valid.map((v) => ({ updateOne: { filter: { date: parseDate(v.date) }, update: { [op]: v.data }, upsert: true } })));
    imported = r.upsertedCount;
    if (overwrite) updated = r.matchedCount; else skipped = r.matchedCount;
  }
  logActivity('import.daily', `Imported daily records: ${imported} new, ${updated} replaced, ${skipped} skipped, ${errors.length} problem rows`);
  res.json({ imported, updated, skipped, failed: errors.length, ...cap(errors) });
});

export const importPurchases = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Please choose a file.');
  const { valid, errors } = parsePurchaseRows(await readSheet(req.file));
  const existing = await Purchase.find({ billNumber: { $in: valid.map((v) => v.data.billNumber) } }).select('supplier billNumber date').lean();
  const key = (s, b, d) => `${String(s).toLowerCase()}|${b}|${new Date(d).toISOString().slice(0, 10)}`;
  const seen = new Set(existing.map((e) => key(e.supplier, e.billNumber, e.date)));
  const fresh = [];
  let skipped = 0;
  for (const v of valid) {
    const k = key(v.data.supplier, v.data.billNumber, v.data.date);
    if (seen.has(k)) { skipped += 1; continue; }
    seen.add(k);
    fresh.push({ ...v.data, date: parseDate(v.data.date) });
  }
  if (fresh.length) await Purchase.insertMany(fresh);
  logActivity('import.purchases', `Imported bills: ${fresh.length} new, ${skipped} skipped, ${errors.length} problem rows`);
  res.json({ imported: fresh.length, updated: 0, skipped, failed: errors.length, ...cap(errors) });
});

const TEMPLATES = {
  daily: { name: 'daily-business-template', head: ['Date', 'Amazon Orders', 'Flipkart Orders', 'Meesho Orders', 'Snapdeal Orders', 'Amazon Returns', 'Flipkart Returns', 'Meesho Returns', 'Snapdeal Returns', 'Amazon RTO', 'Flipkart RTO', 'Meesho RTO', 'Snapdeal RTO'], row: ['2025-01-31', 12, 8, 20, 3, 1, 0, 2, 0, 0, 1, 1, 0] },
  purchases: { name: 'purchases-template', head: ['Date', 'Supplier', 'Bill Number', 'Bill Type', 'Taxable Amount', 'GST Amount', 'Total Amount', 'Status', 'Notes'], row: ['2025-01-31', 'Sample Supplier', 'INV-101', 'GST', 1000, 180, 1180, 'Received', 'Optional note'] },
};
export const template = asyncHandler(async (req, res) => {
  const t = TEMPLATES[req.query.type];
  if (!t) throw new AppError('type must be daily or purchases.');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Data');
  ws.addRow(t.head).font = { bold: true };
  ws.addRow(t.row);
  ws.columns.forEach((c) => { c.width = 18; });
  res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${t.name}.xlsx"` });
  res.send(Buffer.from(await wb.xlsx.writeBuffer()));
});
