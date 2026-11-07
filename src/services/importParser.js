import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { AppError } from '../utils/AppError.js';
import { parseDate } from '../utils/dates.js';

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const plain = (v) => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in v) return plain(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('');
    if ('text' in v) return plain(v.text);
    return '';
  }
  return v;
};
const blank = (v) => v === '' || v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

export async function readSheet(file) {
  const wb = new ExcelJS.Workbook();
  let ws;
  try {
    if (/\.csv$/i.test(file.originalname)) ws = await wb.csv.read(Readable.from([file.buffer]));
    else { await wb.xlsx.load(file.buffer); ws = wb.worksheets[0]; }
  } catch { throw new AppError('Could not read this file. Use the template (.xlsx) or a plain .csv file.', 422); }
  if (!ws || ws.rowCount < 2) throw new AppError('The file has no data rows under the header row.', 422);
  if (ws.rowCount > 5001) throw new AppError('Too many rows. Import up to 5000 rows at a time.', 422);
  const header = [];
  ws.getRow(1).eachCell({ includeEmpty: false }, (c, i) => { header[i] = norm(plain(c.value)); });
  const rows = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const o = {}; let any = false;
    header.forEach((h, i) => { if (!h) return; const v = plain(row.getCell(i).value); if (!blank(v)) any = true; o[h] = v; });
    if (any) rows.push({ n, o });
  });
  if (!rows.length) throw new AppError('The file has no data rows under the header row.', 422);
  return rows;
}

const pick = (o, names) => { for (const k of names) if (!blank(o[k])) return o[k]; return ''; };

export function toIsoDate(v) {
  let s;
  if (v instanceof Date) s = v.toISOString().slice(0, 10);
  else if (typeof v === 'number') s = new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10); // Excel serial
  else {
    const t = String(v).trim();
    const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(t); // Indian style DD/MM/YYYY
    s = dmy ? `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}` : t.slice(0, 10);
  }
  return parseDate(s, 'Date').toISOString().slice(0, 10) && s;
}

const count = (v, label) => {
  if (blank(v)) return 0;
  const n = Number(String(v).replace(/,/g, '').trim());
  if (!Number.isInteger(n) || n < 0 || n > 10_000_000) throw new AppError(`${label} must be a whole number (0 or more)`);
  return n;
};
const money = (v, label) => {
  if (blank(v)) return 0;
  const n = Number(String(v).replace(/[₹,\s]/g, ''));
  if (!Number.isFinite(n) || n < 0) throw new AppError(`${label} must be a number (0 or more)`);
  return Math.round(n * 100) / 100;
};

const PL = ['amazon', 'flipkart', 'meesho', 'snapdeal'];
export function parseDailyRows(rows) {
  const valid = new Map(); const errors = [];
  for (const { n, o } of rows) {
    try {
      if (blank(o.date)) throw new AppError('Date is missing');
      const date = toIsoDate(o.date);
      const data = {};
      let split = false; let r = 0; let t = 0;
      for (const p of PL) {
        const L = p[0].toUpperCase() + p.slice(1);
        data[`${p}Orders`] = count(pick(o, [p, `${p}orders`]), `${L} orders`);
        const rv = pick(o, [`${p}returns`, `${p}return`]); const rt = pick(o, [`${p}rto`]);
        if (!blank(rv) || !blank(rt)) split = true;
        data[`${p}Returns`] = count(rv, `${L} returns`); data[`${p}Rto`] = count(rt, `${L} RTO`);
        r += data[`${p}Returns`]; t += data[`${p}Rto`];
      }
      data.returnsReceived = split ? r : count(pick(o, ['returns', 'returnsreceived', 'totalreturns']), 'Returns');
      data.rtoReceived = split ? t : count(pick(o, ['rto', 'rtoreceived', 'totalrto']), 'RTO');
      valid.set(date, { n, date, data }); // a repeated date in the file: the last row wins
    } catch (e) { errors.push({ row: n, message: e.message }); }
  }
  return { valid: [...valid.values()], errors };
}

export function parsePurchaseRows(rows) {
  const valid = []; const errors = [];
  for (const { n, o } of rows) {
    try {
      if (blank(o.date)) throw new AppError('Date is missing');
      const supplier = String(pick(o, ['supplier', 'suppliername', 'party']) || '').trim();
      const billNumber = String(pick(o, ['billnumber', 'billno', 'bill', 'invoiceno', 'invoicenumber']) || '').trim();
      if (!supplier) throw new AppError('Supplier is missing');
      if (!billNumber) throw new AppError('Bill number is missing');
      const taxable = money(pick(o, ['taxableamount', 'taxable']), 'Taxable amount');
      const gst = money(pick(o, ['gstamount', 'gst']), 'GST amount');
      let total = money(pick(o, ['totalamount', 'total', 'amount']), 'Total amount');
      if (!(total > 0)) total = Math.round((taxable + gst) * 100) / 100;
      if (!(total > 0)) throw new AppError('Total amount must be above 0');
      const billType = /non/i.test(String(pick(o, ['billtype', 'type']))) ? 'NON_GST' : 'GST';
      const status = /receiv/i.test(String(pick(o, ['status']))) ? 'RECEIVED' : 'PENDING';
      valid.push({ n, data: { date: toIsoDate(o.date), supplier: supplier.slice(0, 200), billNumber: billNumber.slice(0, 100), billType, taxableAmount: billType === 'GST' ? taxable : 0, gstAmount: billType === 'GST' ? gst : 0, totalAmount: total, status, notes: String(pick(o, ['notes', 'note', 'remarks']) || '').slice(0, 1000) } });
    } catch (e) { errors.push({ row: n, message: e.message }); }
  }
  return { valid, errors };
}
