import ExcelJS from 'exceljs';
import AdmZip from 'adm-zip';
import path from 'node:path';
import { parse as parseCsv } from 'csv-parse/sync';
import { AppError } from '../../utils/AppError.js';

const nh = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const plain = (v) => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in v) return plain(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return plain(v.text);
    return '';
  }
  return v;
};
export const num = (v) => { if (v === '' || v === null || v === undefined) return 0; const n = Number(String(v).replace(/[₹,\s]/g, '')); return Number.isFinite(n) ? n : 0; };
export const str = (v) => String(v ?? '').trim();
export const isoDate = (v) => { if (v instanceof Date) return v.toISOString().slice(0, 10); const s = str(v); const m = /^(\d{4}-\d{2}-\d{2})/.exec(s); return m ? m[1] : (Number.isNaN(Date.parse(s)) ? '' : new Date(s).toISOString().slice(0, 10)); };

/** Rows of a worksheet as objects keyed by normalised header text. */
function sheetRows(ws) {
  const head = []; ws.getRow(1).eachCell({ includeEmpty: false }, (c, i) => { head[i] = nh(plain(c.value)); });
  const rows = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const o = {}; let any = false;
    head.forEach((h, i) => { if (!h) return; const v = plain(row.getCell(i).value); if (v !== '') any = true; o[h] = v; });
    if (any) rows.push(o);
  });
  return { headers: head.filter(Boolean), rows };
}
/** Finds the real key in a row/headers list whose text contains every part. */
export const colOf = (headers, ...parts) => headers.find((h) => parts.every((p) => h.includes(p)));
const sheetBy = (wb, frag) => wb.worksheets.find((w) => nh(w.name).includes(frag));

function expand(files) {
  const out = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.originalname)) {
      const zip = new AdmZip(f.buffer); const entries = zip.getEntries().filter((e) => !e.isDirectory && /\.(xlsx|csv)$/i.test(e.entryName) && !/__MACOSX|\/\./.test(e.entryName));
      if (entries.length > 40 || entries.reduce((n, e) => n + e.header.size, 0) > 120 * 1024 * 1024) throw new AppError(`"${f.originalname}" contains too many or too large files.`, 422);
      entries.forEach((e) => out.push({ name: path.basename(e.entryName), buffer: e.getData(), from: f.originalname }));
    } else out.push({ name: f.originalname, buffer: f.buffer });
  }
  return out;
}

/** Reads every uploaded file, works out which platform report it is, and returns them sorted by kind. */
export async function readUploads(files) {
  const res = { flipkart: null, snapdeal: null, meeshoSales: [], meeshoReturns: [], amazonB2C: [], amazonB2B: [], detected: [], ignored: [] };
  for (const item of expand(files)) {
    try {
      if (/\.csv$/i.test(item.name)) {
        const recs = parseCsv(item.buffer, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true, trim: true });
        const heads = Object.keys(recs[0] || {}).map(nh);
        if (!heads.includes('transaction type') || !heads.includes('seller gstin')) { res.ignored.push({ name: item.name, why: 'Not an Amazon tax (MTR) report' }); continue; }
        const rows = recs.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [nh(k), v])));
        const b2b = heads.includes('customer bill to gstid');
        (b2b ? res.amazonB2B : res.amazonB2C).push(...rows);
        res.detected.push({ name: item.name, kind: b2b ? 'Amazon B2B' : 'Amazon B2C', rows: rows.length });
        continue;
      }
      const wb = new ExcelJS.Workbook(); await wb.xlsx.load(item.buffer);
      const g8 = sheetBy(wb, 'gstr-8');
      if (g8) {
        const sg8 = sheetRows(g8);
        const isFk = Boolean(colOf(sg8.headers, 'gstin of flipkart')); const isSd = Boolean(colOf(sg8.headers, 'tcs gstin of snapdeal'));
        if (isFk || isSd) {
          const get = (frag) => { const w = sheetBy(wb, frag); return w ? sheetRows(w) : { headers: [], rows: [] }; };
          const pack = { g8: sg8, a: get('7(a)(2)'), b: get('7(b)(2)'), hsn: get('section 12'), docs: isFk ? get('section 13') : get('invoice series') };
          if (isFk) res.flipkart = pack; else res.snapdeal = pack;
          res.detected.push({ name: item.name, kind: isFk ? 'Flipkart GST report' : 'Snapdeal GST report', rows: pack.b.rows.length + pack.a.rows.length });
          continue;
        }
      }
      const first = sheetRows(wb.worksheets[0]);
      if (first.headers.includes('sub_order_num')) {
        const isRet = first.headers.includes('cancel_return_date') || /return/i.test(item.name);
        (isRet ? res.meeshoReturns : res.meeshoSales).push(...first.rows);
        res.detected.push({ name: item.name, kind: isRet ? 'Meesho returns' : 'Meesho sales', rows: first.rows.length });
        continue;
      }
      res.ignored.push({ name: item.name, why: 'Not recognised as a Flipkart, Snapdeal, Meesho or Amazon tax report' });
    } catch (e) { res.ignored.push({ name: item.name, why: `Could not be read (${e.message})` }); }
  }
  return res;
}
