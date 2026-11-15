import ExcelJS from 'exceljs';
import { r2, PLAT } from './compute.js';
import { stateName } from './states.js';

const NAVY = '1F3864'; const YEL = 'FFF2CC'; const GRY = 'F2F2F2';
const MONEY = '#,##0.00;[Red]-#,##0.00;"-"'; const INT = '#,##0;[Red]-#,##0;"-"';
const font = (o = {}) => ({ name: 'Arial', size: 10, ...o });
const sumOf = (a, f) => a.reduce((n, x) => n + f(x), 0);
const q = (s) => `'${s}'`;

export async function buildWorkbook(M, V, opts = {}) {
  const T = V.T; const wb = new ExcelJS.Workbook(); wb.creator = 'SPE Record Manager'; wb.calcProperties.fullCalcOnLoad = true;
  const names = ['Verification Report', 'Table 7 Combined', 'Table 14 ECO', 'HSN Summary', 'Tax Summary', 'Purchase Bills - ITC', 'Credit Notes', 'Amazon B2B Invoices', 'Amazon B2B Credit Notes', 'Section 13 Documents', 'B2CS by Platform'];
  const sh = Object.fromEntries(names.map((n) => [n, wb.addWorksheet(n, { views: [{ showGridLines: false }] })]));
  const sellerNo = Number(M.sellerState); const sellerName = stateName(M.sellerState); const biz = opts.businessName || 'Your business';
  const put = (ws, r, c, v, o = {}) => { const x = ws.getCell(r, c); x.value = v; x.font = font({ bold: o.bold, color: o.color ? { argb: o.color } : undefined, italic: o.italic }); if (o.fmt) x.numFmt = o.fmt; if (o.fill) x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.fill } }; if (o.wrap) x.alignment = { wrapText: true, vertical: 'top' }; if (o.align) x.alignment = { ...(x.alignment || {}), horizontal: o.align }; return x; };
  const fx = (ws, r, c, formula, result, o = {}) => put(ws, r, c, { formula, result }, o);
  const title = (ws, t, sub) => { put(ws, 1, 1, t, { bold: true }).font = font({ bold: true, size: 14, color: { argb: NAVY } }); if (sub) { put(ws, 2, 1, sub, { italic: true, color: '595959' }); } };
  const head = (ws, r, labels) => { labels.forEach((l, i) => { const x = put(ws, r, i + 1, l, { bold: true, color: 'FFFFFF', fill: NAVY }); x.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }; }); ws.getRow(r).height = 32; };
  const widths = (ws, w) => w.forEach((x, i) => { ws.getColumn(i + 1).width = x; });
  const totalStyle = (ws, r, c1, c2) => { for (let c = c1; c <= c2; c++) { const x = ws.getCell(r, c); x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YEL } }; x.font = font({ bold: true }); } };
  const note = (ws, r, text, c2 = 9, h = 30) => { ws.mergeCells(r, 1, r, c2); put(ws, r, 1, text, { wrap: true, italic: true, color: '595959' }); ws.getRow(r).height = h; };

  // =============== B2CS by Platform ===============
  { const ws = sh['B2CS by Platform']; const n = M.b2cs.length; const F = 16; const L = 15 + n; widths(ws, [14, 20, 34, 10, 13, 16, 8, 14, 14, 14, 14, 56]);
    title(ws, 'B2CS by platform - RECONCILIATION DETAIL (not entered on the portal)', `${biz} | GSTIN ${M.sellerGstin} | ${M.period.label}`);
    put(ws, 4, 1, 'SUMMARY BY PLATFORM', { bold: true });
    head(ws, 5, ['Platform', 'Rows', 'Net taxable (Rs)', 'Inter-State taxable', `${sellerName} (Intra) taxable`, 'IGST', 'CGST', 'SGST/UTGST', 'Total tax']);
    const rg = (c) => `$${c}$${F}:$${c}$${L}`;
    PLAT.forEach((p, i) => { const r = 6 + i; const rs = M.b2cs.filter((x) => x.platform === p); put(ws, r, 1, p);
      fx(ws, r, 2, `COUNTIFS(${rg('A')},A${r})`, rs.length, { fmt: INT }); fx(ws, r, 3, `SUMIFS(${rg('F')},${rg('A')},A${r})`, r2(sumOf(rs, (x) => x.net)), { fmt: MONEY });
      fx(ws, r, 4, `SUMIFS(${rg('F')},${rg('A')},A${r},${rg('E')},"Inter-State")`, r2(sumOf(rs.filter((x) => x.supply === 'Inter-State'), (x) => x.net)), { fmt: MONEY }); fx(ws, r, 5, `SUMIFS(${rg('F')},${rg('A')},A${r},${rg('E')},"Intra-State")`, r2(sumOf(rs.filter((x) => x.supply === 'Intra-State'), (x) => x.net)), { fmt: MONEY });
      [['H', 'igst', 6], ['I', 'cgst', 7], ['J', 'sgst', 8]].forEach(([col, k, c]) => fx(ws, r, c, `SUMIFS(${rg(col)},${rg('A')},A${r})`, r2(sumOf(rs, (x) => x[k])), { fmt: MONEY })); fx(ws, r, 9, `F${r}+G${r}+H${r}`, r2(sumOf(rs, (x) => x.total)), { fmt: MONEY }); });
    put(ws, 10, 1, 'B2CS subtotal'); for (let c = 2; c <= 9; c++) { const col = String.fromCharCode(64 + c); const v = c === 2 ? M.b2cs.length : [null, null, r2(sumOf(M.b2cs, (x) => x.net)), r2(sumOf(M.b2cs.filter((x) => x.supply === 'Inter-State'), (x) => x.net)), r2(sumOf(M.b2cs.filter((x) => x.supply === 'Intra-State'), (x) => x.net)), r2(sumOf(M.b2cs, (x) => x.igst)), r2(sumOf(M.b2cs, (x) => x.cgst)), r2(sumOf(M.b2cs, (x) => x.sgst)), r2(sumOf(M.b2cs, (x) => x.total))][c - 1]; fx(ws, 10, c, `SUM(${col}6:${col}9)`, v, { fmt: c === 2 ? INT : MONEY }); } totalStyle(ws, 10, 1, 9);
    const bt = 6 + M.b2b.length; const b2bInter = r2(sumOf(M.b2b.filter((b) => b.code !== M.sellerState), (b) => b.taxable)); const b2bIntra = r2(sumOf(M.b2b.filter((b) => b.code === M.sellerState), (b) => b.taxable));
    put(ws, 11, 1, 'Amazon B2B (4A)'); fx(ws, 11, 2, `COUNTA('Amazon B2B Invoices'!C6:C${bt - 1 < 6 ? 6 : bt - 1})`, M.b2b.length, { fmt: INT }); fx(ws, 11, 3, `'Amazon B2B Invoices'!G${bt}`, r2(sumOf(M.b2b, (b) => b.taxable)), { fmt: MONEY }); put(ws, 11, 4, b2bInter, { fmt: MONEY }); put(ws, 11, 5, b2bIntra, { fmt: MONEY }); fx(ws, 11, 6, `'Amazon B2B Invoices'!I${bt}`, r2(sumOf(M.b2b, (b) => b.igst)), { fmt: MONEY }); fx(ws, 11, 7, `'Amazon B2B Invoices'!J${bt}`, r2(sumOf(M.b2b, (b) => b.cgst)), { fmt: MONEY }); fx(ws, 11, 8, `'Amazon B2B Invoices'!K${bt}`, r2(sumOf(M.b2b, (b) => b.sgst)), { fmt: MONEY }); fx(ws, 11, 9, 'F11+G11+H11', r2(sumOf(M.b2b, (b) => b.igst + b.cgst + b.sgst)), { fmt: MONEY });
    put(ws, 12, 1, 'GRAND TOTAL (B2CS + B2B)'); for (let c = 2; c <= 9; c++) { const col = String.fromCharCode(64 + c); const v = c === 2 ? M.b2cs.length + M.b2b.length : [null, null, T.net, r2(sumOf(M.b2cs, (x) => x.net) * 0 + sumOf(M.b2cs.filter((x) => x.supply === 'Inter-State'), (x) => x.net) + b2bInter), r2(sumOf(M.b2cs.filter((x) => x.supply === 'Intra-State'), (x) => x.net) + b2bIntra), r2(sumOf(M.b2cs, (x) => x.igst) + sumOf(M.b2b, (b) => b.igst)), r2(sumOf(M.b2cs, (x) => x.cgst) + sumOf(M.b2b, (b) => b.cgst)), r2(sumOf(M.b2cs, (x) => x.sgst) + sumOf(M.b2b, (b) => b.sgst)), r2(sumOf(M.b2cs, (x) => x.total) + sumOf(M.b2b, (b) => b.igst + b.cgst + b.sgst))][c - 1]; fx(ws, 12, c, `${col}10+${col}11`, v, { fmt: c === 2 ? INT : MONEY }); } totalStyle(ws, 12, 1, 9);
    put(ws, 14, 1, 'STATE-WISE DETAIL BY PLATFORM (feeds Table 7)', { bold: true });
    head(ws, 15, ['Platform', 'ECO GSTIN (platform that collected TCS)', 'Place of supply (state)', 'State code', 'Supply type', 'Net taxable value (Rs)', 'Rate %', 'IGST', 'CGST', 'SGST/UTGST', 'Total tax', 'Portal note']);
    M.b2cs.forEach((x, i) => { const r = F + i; put(ws, r, 1, x.platform); put(ws, r, 2, x.eco); put(ws, r, 3, x.stateName); put(ws, r, 4, Number(x.code));
      fx(ws, r, 5, `IF(D${r}=${sellerNo},"Intra-State","Inter-State")`, x.supply); put(ws, r, 6, x.net, { fmt: MONEY }); put(ws, r, 7, x.rate);
      fx(ws, r, 8, `IF(E${r}="Inter-State",ROUND(F${r}*G${r}/100,2),0)`, x.igst, { fmt: MONEY }); fx(ws, r, 9, `IF(E${r}="Intra-State",ROUND(F${r}*G${r}/200,2),0)`, x.cgst, { fmt: MONEY }); fx(ws, r, 10, `IF(E${r}="Intra-State",ROUND(F${r}*G${r}/200,2),0)`, x.sgst, { fmt: MONEY }); fx(ws, r, 11, `H${r}+I${r}+J${r}`, x.total, { fmt: MONEY });
      put(ws, r, 12, x.code === M.sellerState ? `${x.stateName} = your own state: CGST + SGST` : x.code === '38' ? 'Ladakh has its own state code (38)' : x.code === '26' ? 'Dadra & Nagar Haveli and Daman & Diu: single code 26' : x.net < 0 ? 'Negative: returns exceeded sales for this platform; nets off in Table 7' : ''); });
    ws.views = [{ showGridLines: false, state: 'frozen', ySplit: 15 }]; M._b2csRange = { F, L }; }

  // =============== Table 7 Combined ===============
  { const ws = sh['Table 7 Combined']; widths(ws, [10, 34, 14, 14, 14, 14, 18, 8, 14, 12, 12, 8, 14]); const n = M.table7.length; const F = 6; const Lr = 5 + n; const tot = Lr + 1; const { F: bF, L: bL } = M._b2csRange;
    title(ws, 'Table 7 - B2C (Others), ALL PLATFORMS COMBINED - enter these rows on the GST portal', 'Meesho + Flipkart + Snapdeal + Amazon B2C, net of returns. Tax is worked out on each state total. Amazon B2B (registered buyers) goes in Table 4A, not here.');
    head(ws, 5, ['State code', 'Place of supply', 'Meesho', 'Flipkart', 'Snapdeal', 'Amazon B2C', 'Net taxable value (ENTER)', 'Rate %', 'IGST', 'CGST', 'SGST/UTGST', 'Cess', 'Total tax']);
    M.table7.forEach((x, i) => { const r = F + i; put(ws, r, 1, Number(x.code)); put(ws, r, 2, x.name);
      PLAT.forEach((p, k) => fx(ws, r, 3 + k, `SUMIFS(${q('B2CS by Platform')}!$F$${bF}:$F$${bL},${q('B2CS by Platform')}!$A$${bF}:$A$${bL},"${p}",${q('B2CS by Platform')}!$D$${bF}:$D$${bL},$A${r},${q('B2CS by Platform')}!$G$${bF}:$G$${bL},$H${r})`, r2(x.by[p] || 0), { fmt: MONEY, color: '008000' }));
      fx(ws, r, 7, `SUM(C${r}:F${r})`, x.net, { fmt: MONEY, bold: true }); put(ws, r, 8, x.rate); fx(ws, r, 9, `IF(A${r}=${sellerNo},0,ROUND(G${r}*H${r}/100,2))`, x.igst, { fmt: MONEY }); fx(ws, r, 10, `IF(A${r}=${sellerNo},ROUND(G${r}*H${r}/200,2),0)`, x.cgst, { fmt: MONEY }); fx(ws, r, 11, `J${r}`, x.sgst, { fmt: MONEY }); put(ws, r, 12, 0, { fmt: MONEY }); fx(ws, r, 13, `I${r}+J${r}+K${r}`, r2(x.igst + x.cgst + x.sgst), { fmt: MONEY }); });
    put(ws, tot, 1, 'TOTAL'); fx(ws, tot, 2, `COUNT(A${F}:A${Lr})&" states"`, `${new Set(M.table7.map((x) => x.code)).size} states`);
    const tv = { 3: 'Meesho', 4: 'Flipkart', 5: 'Snapdeal', 6: 'Amazon B2C' }; for (let c = 3; c <= 13; c++) { if (c === 8) continue; const col = String.fromCharCode(64 + c); const v = tv[c] ? r2(sumOf(M.b2cs.filter((x) => x.platform === tv[c]), (x) => x.net)) : c === 7 ? r2(sumOf(M.table7, (x) => x.net)) : c === 9 ? r2(sumOf(M.table7, (x) => x.igst)) : c === 10 ? r2(sumOf(M.table7, (x) => x.cgst)) : c === 11 ? r2(sumOf(M.table7, (x) => x.sgst)) : c === 12 ? 0 : r2(sumOf(M.table7, (x) => x.igst + x.cgst + x.sgst)); fx(ws, tot, c, `SUM(${col}${F}:${col}${Lr})`, v, { fmt: MONEY }); } totalStyle(ws, tot, 1, 13);
    const negs = M.table7.filter((x) => x.net < 0); note(ws, tot + 2, negs.length ? `Negative after combining: ${negs.map((x) => x.name).join(', ')} - check with your CA.` : 'No state is negative after combining platforms, so every row can be entered as shown.', 13, 20);
    note(ws, tot + 3, `Tax here is calculated on each state's combined total (${sellerName} = CGST + SGST, other states = IGST). Platform columns show where each state total comes from.`, 13, 20); M._t7 = { F, Lr, tot }; ws.views = [{ showGridLines: false, state: 'frozen', ySplit: 5 }]; }

  // =============== Amazon B2B Invoices ===============
  { const ws = sh['Amazon B2B Invoices']; widths(ws, [20, 30, 12, 12, 18, 14, 14, 8, 12, 10, 12, 14, 12, 50]); const m = M.b2b.length; const tot = 6 + m;
    title(ws, 'Amazon B2B invoices (buyer has a GSTIN) - GSTR-1 Table 4A', 'Each invoice is entered one by one. Tax is calculated at the rate on the taxable value; Amazon\'s own figure is shown for comparison.');
    head(ws, 5, ['Buyer GSTIN', 'Buyer name', 'Invoice no', 'Invoice date', 'Place of supply', 'Invoice value (Amazon)', 'Taxable value', 'Rate %', 'IGST (calc)', 'CGST', 'SGST/UTGST', 'Tax per Amazon', 'Difference', 'Note']);
    M.b2b.forEach((b, i) => { const r = 6 + i; put(ws, r, 1, b.gstin); put(ws, r, 2, b.name); put(ws, r, 3, b.invoice); put(ws, r, 4, b.date); put(ws, r, 5, b.pos); put(ws, r, 6, b.value, { fmt: MONEY }); put(ws, r, 7, b.taxable, { fmt: MONEY }); put(ws, r, 8, b.rate);
      const intra = b.code === M.sellerState; fx(ws, r, 9, intra ? '0' : `ROUND(G${r}*H${r}/100,2)`, b.igst, { fmt: MONEY }); fx(ws, r, 10, intra ? `ROUND(G${r}*H${r}/200,2)` : '0', b.cgst, { fmt: MONEY }); fx(ws, r, 11, `J${r}`, b.sgst, { fmt: MONEY }); put(ws, r, 12, b.amazonIgst, { fmt: MONEY }); fx(ws, r, 13, `I${r}+J${r}+K${r}-L${r}`, b.diff, { fmt: '0.00' }); put(ws, r, 14, Math.abs(b.diff) > 0.005 ? `Amazon tax differs by ${Math.abs(b.diff).toFixed(2)}; portal recalculates at ${b.rate}%` : ''); });
    put(ws, tot, 1, 'TOTAL'); [[6, 'value'], [7, 'taxable'], [9, 'igst'], [10, 'cgst'], [11, 'sgst'], [12, 'amazonIgst'], [13, 'diff']].forEach(([c, k]) => fx(ws, tot, c, `SUM(${String.fromCharCode(64 + c)}6:${String.fromCharCode(64 + c)}${Math.max(6, tot - 1)})`, r2(sumOf(M.b2b, (b) => b[k])), { fmt: MONEY })); totalStyle(ws, tot, 1, 14);
    note(ws, tot + 2, `Amazon TCS on these invoices (IGST): ${M.b2b.map((b) => `${b.invoice} ${b.tcsI.toFixed(2)}`).join(' + ')} = ${M.b2bTcs.i.toFixed(2)}. Include a Table 14 row for Amazon as well.`, 14, 20); M._b2bTot = tot; }

  // =============== Amazon B2B Credit Notes ===============
  { const ws = sh['Amazon B2B Credit Notes']; widths(ws, [20, 16, 14, 18, 16, 14, 12, 12, 12]); title(ws, 'Amazon B2B credit notes - GSTR-1 Table 9B', M.b2bCredit.length ? 'Credit notes issued to GST-registered buyers.' : 'NONE this month: the B2B MTR has shipment rows only and no refunds.');
    head(ws, 5, ['Buyer GSTIN', 'Credit note no', 'Credit note date', 'Original invoice no', 'Original invoice date', 'Taxable value', 'IGST', 'CGST', 'SGST/UTGST']);
    if (!M.b2bCredit.length) { put(ws, 6, 1, 'None'); put(ws, 8, 1, 'Total taxable value', { bold: true }); put(ws, 8, 6, 0, { fmt: MONEY }); } else { M.b2bCredit.forEach((c, i) => { const r = 6 + i; const intra = c.code === M.sellerState; put(ws, r, 1, c.gstin); put(ws, r, 2, c.cn); put(ws, r, 3, c.cnDate); put(ws, r, 4, c.invoice); put(ws, r, 5, c.invDate); put(ws, r, 6, c.taxable, { fmt: MONEY }); put(ws, r, 7, intra ? 0 : c.tax, { fmt: MONEY }); put(ws, r, 8, intra ? r2(c.tax / 2) : 0, { fmt: MONEY }); put(ws, r, 9, intra ? r2(c.tax / 2) : 0, { fmt: MONEY }); }); const t = 6 + M.b2bCredit.length + 1; put(ws, t, 1, 'Total taxable value', { bold: true }); fx(ws, t, 6, `SUM(F6:F${t - 2})`, r2(sumOf(M.b2bCredit, (c) => c.taxable)), { fmt: MONEY }); } }

  // =============== Purchase Bills - ITC ===============
  { const ws = sh['Purchase Bills - ITC']; widths(ws, [6, 34, 20, 16, 12, 14, 12, 12, 12, 14, 14, 14, 34]); const n = M.itc.length; const F = 6; const Lr = Math.max(205, 5 + n + 20);
    title(ws, 'Purchase bills / Input tax credit', 'Filled from the Purchases screen of the app (GST bills). Tick "In GSTR-2B" and "Claim" there; or edit this sheet - the totals and the Tax Summary update. Only rows with Claim = Y count.');
    const rg = (c) => `${c}${F}:${c}${Lr}`;
    put(ws, 3, 1, 'All bills entered', { bold: true }); put(ws, 4, 1, 'ITC to claim (L = Y)', { bold: true });
    [[6, 'taxable'], [7, 'igst'], [8, 'cgst'], [9, 'sgst'], [10, 'total']].forEach(([c, k]) => { const col = String.fromCharCode(64 + c); fx(ws, 3, c, `SUM(${rg(col)})`, r2(sumOf(M.itc, (b) => b[k])), { fmt: MONEY, bold: true }); fx(ws, 4, c, `SUMIFS(${rg(col)},$L$${F}:$L$${Lr},"Y")`, r2(sumOf(M.itc.filter((b) => b.claim === 'Y'), (b) => b[k])), { fmt: MONEY, bold: true }); }); totalStyle(ws, 3, 1, 10); totalStyle(ws, 4, 1, 10);
    head(ws, 5, ['#', 'Supplier name', 'Supplier GSTIN', 'Invoice no', 'Invoice date', 'Taxable value', 'IGST', 'CGST', 'SGST/UTGST', 'Total invoice value', 'In GSTR-2B / IMS? (Y/N)', 'Claim this month? (Y/N)', 'Notes']);
    for (let i = 0; i < Lr - F + 1; i++) { const r = F + i; const b = M.itc[i]; put(ws, r, 1, i + 1);
      if (b) { put(ws, r, 2, b.supplier); put(ws, r, 3, b.gstin, { color: '0000FF' }); put(ws, r, 4, b.invoice); put(ws, r, 5, b.date); [['taxable', 6], ['igst', 7], ['cgst', 8], ['sgst', 9]].forEach(([k, c]) => put(ws, r, c, b[k], { fmt: MONEY, color: '0000FF' })); fx(ws, r, 10, `F${r}+G${r}+H${r}+I${r}`, r2(b.taxable + b.igst + b.cgst + b.sgst), { fmt: MONEY }); put(ws, r, 11, b.in2b, { color: '0000FF', align: 'center' }); put(ws, r, 12, b.claim, { color: '0000FF', align: 'center' }); put(ws, r, 13, b.notes || ''); }
      else { fx(ws, r, 10, `F${r}+G${r}+H${r}+I${r}`, 0, { fmt: MONEY }); } }
    ws.views = [{ showGridLines: false, state: 'frozen', ySplit: 5 }]; M._itcRows = { F, Lr }; }

  // =============== Table 14 ECO ===============
  { const ws = sh['Table 14 ECO']; widths(ws, [40, 22, 16, 14, 12, 12, 8, 70]); const k = M.eco.length; const tot = 6 + k; const { F: bF, L: bL } = M._b2csRange;
    title(ws, 'Table 14(a) - Supplies through e-commerce operators (TCS under section 52)', 'Reported IN ADDITION to Tables 4A and 7 (those tables already contain these sales). One row per platform.');
    head(ws, 5, ['Operator', 'Operator GSTIN (ECO)', 'Net taxable value', 'IGST', 'CGST', 'SGST/UTGST', 'Cess', 'Note']);
    M.eco.forEach((e, i) => { const r = 6 + i; put(ws, r, 1, e.name); put(ws, r, 2, e.gstin); const base = `SUMIFS(${q('B2CS by Platform')}!$F$${bF}:$F$${bL},${q('B2CS by Platform')}!$A$${bF}:$A$${bL},"${e.platform}")`; fx(ws, r, 3, e.platform === 'Amazon B2C' ? `${base}+${q('Amazon B2B Invoices')}!G${M._b2bTot}` : base, e.net, { fmt: MONEY }); put(ws, r, 4, e.igst, { fmt: MONEY }); put(ws, r, 5, e.cgst, { fmt: MONEY }); put(ws, r, 6, e.sgst, { fmt: MONEY }); put(ws, r, 7, 0, { fmt: MONEY });
      put(ws, r, 8, e.platform === 'Meesho' ? 'GSTIN from Meesho report (eco_tcs_gstin)' : e.platform === 'Flipkart' ? 'GSTIN from Flipkart GSTR-8 sheet' : e.platform === 'Snapdeal' ? 'GSTIN from Snapdeal reports' : `Amazon B2C + B2B. GSTIN is NOT in the MTR reports - ${M.usedDefaultAmazonEco ? 'default saved in the app; confirm against your Amazon invoice' : 'taken from GST settings'}`, { wrap: true }); });
    put(ws, tot, 1, 'TOTAL'); [[3, 'net'], [4, 'igst'], [5, 'cgst'], [6, 'sgst']].forEach(([c, kk]) => fx(ws, tot, c, `SUM(${String.fromCharCode(64 + c)}6:${String.fromCharCode(64 + c)}${tot - 1})`, r2(sumOf(M.eco, (e) => e[kk])), { fmt: MONEY })); fx(ws, tot, 7, `SUM(G6:G${tot - 1})`, 0, { fmt: MONEY }); totalStyle(ws, tot, 1, 8);
    note(ws, tot + 2, `Tax columns here are ${M.rate}% of each operator's taxable value (${sellerName} sales = CGST + SGST, other states = IGST). Cess is nil.`, 8, 20); M._ecoTot = tot; }

  // =============== HSN Summary ===============
  { const ws = sh['HSN Summary']; widths(ws, [14, 40, 14, 18, 18, 16, 8, 60, 14, 12, 12, 16, 8]); const nA = M.hsnA.length; const aF = 6; const aL = 5 + nA; const aT = aL + 1; const bH = aT + 4; const bF = bH + 1; const nB = M.hsnB.length; const bT = bF + nB;
    title(ws, 'HSN summary (GSTR-1 Table 12) - split Inter-State / ' + sellerName + ' (Intra)', `Only your own HSN codes are used (set in GST settings). Total value = taxable value + tax.`);
    put(ws, 4, 1, 'A. BUILD-UP BY PLATFORM (net of returns)', { bold: true });
    head(ws, 5, ['Platform', 'HSN', 'Net quantity', 'Taxable - Inter-State', `Taxable - ${sellerName} (Intra)`, 'Total taxable', 'Rate %', 'Note']);
    M.hsnA.forEach((x, i) => { const r = aF + i; put(ws, r, 1, x.platform); put(ws, r, 2, x.hsn); put(ws, r, 3, x.qty, { fmt: INT }); put(ws, r, 4, x.inter, { fmt: MONEY }); put(ws, r, 5, x.intra, { fmt: MONEY }); fx(ws, r, 6, `D${r}+E${r}`, x.total, { fmt: MONEY }); put(ws, r, 7, x.rate); put(ws, r, 8, x.original.length ? `Report code ${x.original.join(', ')} merged into ${x.hsn}` : '', { wrap: true }); });
    put(ws, aT, 1, 'TOTAL'); [[3, 'qty'], [4, 'inter'], [5, 'intra'], [6, 'total']].forEach(([c, k]) => fx(ws, aT, c, `SUM(${String.fromCharCode(64 + c)}${aF}:${String.fromCharCode(64 + c)}${aL})`, r2(sumOf(M.hsnA, (x) => x[k])), { fmt: c === 3 ? INT : MONEY })); totalStyle(ws, aT, 1, 8);
    put(ws, bH - 1, 1, 'B. ENTER ON PORTAL - Table 12 rows (one row per HSN)', { bold: true });
    head(ws, bH, ['HSN', 'Description', 'UQC', 'Total quantity', 'Taxable - Inter-State', `Taxable - ${sellerName}`, 'Total taxable value', 'Rate %', 'IGST', 'CGST', 'SGST/UTGST', 'Total value', 'Cess']);
    M.hsnB.forEach((x, i) => { const r = bF + i; const rg = (c) => `$${c}$${aF}:$${c}$${aL}`; const crit = `${rg('B')},$A${r},${rg('G')},$H${r}`; put(ws, r, 1, x.hsn); put(ws, r, 2, x.description); put(ws, r, 3, x.uqc);
      fx(ws, r, 4, `SUMIFS(${rg('C')},${crit})`, x.qty, { fmt: INT }); fx(ws, r, 5, `SUMIFS(${rg('D')},${crit})`, x.inter, { fmt: MONEY }); fx(ws, r, 6, `SUMIFS(${rg('E')},${crit})`, x.intra, { fmt: MONEY }); fx(ws, r, 7, `E${r}+F${r}`, x.total, { fmt: MONEY }); put(ws, r, 8, x.rate);
      fx(ws, r, 9, `ROUND(E${r}*H${r}/100,2)`, x.igst, { fmt: MONEY }); fx(ws, r, 10, `ROUND(F${r}*H${r}/200,2)`, x.cgst, { fmt: MONEY }); fx(ws, r, 11, `J${r}`, x.sgst, { fmt: MONEY }); fx(ws, r, 12, `G${r}+I${r}+J${r}+K${r}+M${r}`, x.value, { fmt: MONEY }); put(ws, r, 13, 0, { fmt: MONEY }); });
    put(ws, bT, 1, 'TOTAL'); [[4, 'qty'], [5, 'inter'], [6, 'intra'], [7, 'total'], [9, 'igst'], [10, 'cgst'], [11, 'sgst'], [12, 'value']].forEach(([c, k]) => fx(ws, bT, c, `SUM(${String.fromCharCode(64 + c)}${bF}:${String.fromCharCode(64 + c)}${bT - 1})`, r2(sumOf(M.hsnB, (x) => x[k])), { fmt: c === 4 ? INT : MONEY })); fx(ws, bT, 13, `SUM(M${bF}:M${bT - 1})`, 0, { fmt: MONEY }); totalStyle(ws, bT, 1, 13);
    note(ws, bT + 2, 'UQC: platforms report quantity in numbers (NOS). Check the unit that suits each HSN code. Cess is nil.', 13, 20); }

  // =============== Credit Notes ===============
  { const ws = sh['Credit Notes']; widths(ws, [28, 28, 18, 18, 30, 70, 14, 14, 14, 14, 14, 14]); const k = M.creditSummary.length; const tot = 6 + k;
    title(ws, `Credit notes / returns by platform (${M.period.label})`, 'B2C returns are NETTED against sales in Table 7 (no separate entry needed). This sheet is for reference and for Section 13.');
    put(ws, 4, 1, 'A. SUMMARY', { bold: true }); head(ws, 5, ['Platform', 'Credit notes / return rows', 'Return taxable value (Rs)', `Tax on returns @${M.rate}% (Rs)`, 'Treatment', 'Note']);
    M.creditSummary.forEach((c, i) => { const r = 6 + i; put(ws, r, 1, c.platform); put(ws, r, 2, c.count); put(ws, r, 3, c.taxable, { fmt: MONEY }); put(ws, r, 4, c.tax, { fmt: MONEY }); put(ws, r, 5, 'Netted state-wise in Table 7'); put(ws, r, 6, c.note, { wrap: true }); });
    put(ws, tot, 1, 'TOTAL'); fx(ws, tot, 3, `SUM(C6:C${tot - 1})`, r2(sumOf(M.creditSummary, (c) => c.taxable)), { fmt: MONEY }); fx(ws, tot, 4, `SUM(D6:D${tot - 1})`, r2(sumOf(M.creditSummary, (c) => c.tax)), { fmt: MONEY }); totalStyle(ws, tot, 1, 6);
    const dh = tot + 2; put(ws, dh, 1, 'B. AMAZON B2C CREDIT NOTES - DETAIL (information only)', { bold: true });
    head(ws, dh + 1, ['Credit note no', 'Credit note date', 'Original invoice', 'Original invoice date', 'Place of supply', 'Supply', 'Qty', 'Taxable value', 'Tax per Amazon', 'IGST', 'CGST', 'SGST/UTGST']);
    M.amazonCn.forEach((c, i) => { const r = dh + 2 + i; [c.cn, c.cnDate, c.invoice, c.invDate, c.pos, c.supply].forEach((v, j) => put(ws, r, j + 1, v)); put(ws, r, 7, c.qty, { fmt: INT }); [c.taxable, c.tax, c.igst, c.cgst, c.sgst].forEach((v, j) => put(ws, r, 8 + j, r2(v), { fmt: MONEY })); });
    const dl = dh + 1 + M.amazonCn.length; const dt = dl + 1; put(ws, dt, 1, 'TOTAL'); if (M.amazonCn.length) { fx(ws, dt, 7, `SUM(G${dh + 2}:G${dl})`, sumOf(M.amazonCn, (c) => c.qty), { fmt: INT }); [[8, 'taxable'], [9, 'tax'], [10, 'igst'], [11, 'cgst'], [12, 'sgst']].forEach(([c, kk]) => fx(ws, dt, c, `SUM(${String.fromCharCode(64 + c)}${dh + 2}:${String.fromCharCode(64 + c)}${dl})`, r2(sumOf(M.amazonCn, (x) => x[kk])), { fmt: MONEY })); } totalStyle(ws, dt, 1, 12); }

  // =============== Section 13 Documents ===============
  { const ws = sh['Section 13 Documents']; widths(ws, [14, 30, 24, 24, 14, 12, 12, 90]); const n = M.docs.length; const L = 5 + n;
    title(ws, 'Section 13 - Documents issued (zero tax impact)', 'Net issued = Total - Cancelled. Meesho files contain no invoice numbers.');
    head(ws, 5, ['Platform', 'Nature of document', 'Series from', 'Series to', 'Total number', 'Cancelled', 'Net issued', 'Note']);
    M.docs.forEach((d, i) => { const r = 6 + i; put(ws, r, 1, d.platform, { fill: d.missing ? 'FFE9E9' : undefined }); put(ws, r, 2, d.nature); put(ws, r, 3, d.from); put(ws, r, 4, d.to); if (d.total != null) { put(ws, r, 5, d.total, { fmt: INT }); put(ws, r, 6, d.cancelled, { fmt: INT }); fx(ws, r, 7, `E${r}-F${r}`, d.total - d.cancelled, { fmt: INT }); } put(ws, r, 8, d.note, { wrap: true }); });
    const inv = M.docs.filter((d) => d.nature === 'Invoices for outward supply' && d.total != null); const cn = M.docs.filter((d) => d.nature === 'Credit Note');
    const t1 = L + 2; put(ws, t1, 1, 'TOTAL invoices'); put(ws, t1, 2, 'Invoices for outward supply'); [[5, 'E', inv.reduce((n, d) => n + d.total, 0)], [6, 'F', inv.reduce((n, d) => n + d.cancelled, 0)], [7, 'G', inv.reduce((n, d) => n + d.total - d.cancelled, 0)]].forEach(([c, col, v]) => fx(ws, t1, c, `SUMIFS(${col}6:${col}${L},$B$6:$B$${L},$B${t1})`, v, { fmt: INT })); totalStyle(ws, t1, 1, 8);
    const t2 = t1 + 1; put(ws, t2, 1, 'TOTAL credit notes'); put(ws, t2, 2, 'Credit Note'); [[5, 'E', cn.reduce((n, d) => n + d.total, 0)], [6, 'F', cn.reduce((n, d) => n + d.cancelled, 0)], [7, 'G', cn.reduce((n, d) => n + d.total - d.cancelled, 0)]].forEach(([c, col, v]) => fx(ws, t2, c, `SUMIFS(${col}6:${col}${L},$B$6:$B$${L},$B${t2})`, v, { fmt: INT })); totalStyle(ws, t2, 1, 8); }

  // =============== Tax Summary ===============
  { const ws = sh['Tax Summary']; widths(ws, [58, 16, 16, 16, 16, 20, 16, 16, 66]); const t7 = M._t7; const bt = M._b2bTot; const itc = M._itcRows; const { F: bF, L: bL } = M._b2csRange; const T7 = q('Table 7 Combined'); const B2B = q('Amazon B2B Invoices');
    title(ws, `Tax summary - liability vs ITC vs estimated cash payment (${M.period.label})`, 'Liability comes from Table 7 Combined + Amazon B2B (what GSTR-1 will show). ITC comes from the Purchase Bills sheet (rows marked Y).');
    put(ws, 4, 1, '1. OUTPUT TAX LIABILITY AND ITC', { bold: true }); head(ws, 5, ['Item', 'IGST', 'CGST', 'SGST/UTGST', 'Total']);
    put(ws, 6, 1, 'Total net taxable value (all sources)'); fx(ws, 6, 5, `${T7}!G${t7.tot}+${B2B}!G${bt}`, T.net, { fmt: MONEY });
    put(ws, 7, 1, 'Output tax liability'); fx(ws, 7, 2, `${T7}!I${t7.tot}+${B2B}!I${bt}`, T.out.i, { fmt: MONEY }); fx(ws, 7, 3, `${T7}!J${t7.tot}+${B2B}!J${bt}`, T.out.c, { fmt: MONEY }); fx(ws, 7, 4, `${T7}!K${t7.tot}+${B2B}!K${bt}`, T.out.s, { fmt: MONEY }); fx(ws, 7, 5, 'SUM(B7:D7)', r2(T.out.i + T.out.c + T.out.s), { fmt: MONEY });
    put(ws, 8, 1, 'Input tax credit to claim (Purchase Bills sheet, rows marked Y)'); [['G', 'i'], ['H', 'c'], ['I', 's']].forEach(([col, k], j) => fx(ws, 8, 2 + j, `${q('Purchase Bills - ITC')}!${col}4`, T.itc[k], { fmt: MONEY })); fx(ws, 8, 5, 'SUM(B8:D8)', r2(T.itc.i + T.itc.c + T.itc.s), { fmt: MONEY });
    put(ws, 10, 1, '2. HOW ITC IS USED (Rule 88A order: IGST credit first against IGST, then CGST, then SGST; CGST/SGST credit against their own tax, then IGST)', { bold: true });
    head(ws, 11, ['ITC head (rows) used against (columns)', 'IGST', 'CGST', 'SGST/UTGST', 'Total used', 'Unused ITC (carry forward)']);
    const u = T.use; put(ws, 12, 1, 'IGST credit'); fx(ws, 12, 2, 'MIN(B8,B7)', u.ii, { fmt: MONEY }); fx(ws, 12, 3, 'MIN(B8-B12,C7)', u.ic, { fmt: MONEY }); fx(ws, 12, 4, 'MIN(B8-B12-C12,D7)', u.is, { fmt: MONEY }); fx(ws, 12, 5, 'SUM(B12:D12)', u.ii + u.ic + u.is, { fmt: MONEY }); fx(ws, 12, 6, 'B8-E12', T.left.i, { fmt: MONEY });
    put(ws, 13, 1, 'CGST credit'); fx(ws, 13, 2, 'MIN(C8-C13,B7-B12)', u.ci, { fmt: MONEY }); fx(ws, 13, 3, 'MIN(C8,C7-C12)', u.cc, { fmt: MONEY }); put(ws, 13, 4, 0, { fmt: MONEY }); fx(ws, 13, 5, 'SUM(B13:D13)', u.ci + u.cc, { fmt: MONEY }); fx(ws, 13, 6, 'C8-E13', T.left.c, { fmt: MONEY });
    put(ws, 14, 1, 'SGST credit'); fx(ws, 14, 2, 'MIN(D8-D14,B7-B12-B13)', u.si, { fmt: MONEY }); put(ws, 14, 3, 0, { fmt: MONEY }); fx(ws, 14, 4, 'MIN(D8,D7-D12)', u.ss, { fmt: MONEY }); fx(ws, 14, 5, 'SUM(B14:D14)', u.si + u.ss, { fmt: MONEY }); fx(ws, 14, 6, 'D8-E14', T.left.s, { fmt: MONEY });
    put(ws, 15, 1, 'Total ITC applied'); [['B', u.ii + u.ci + u.si], ['C', u.ic + u.cc], ['D', u.is + u.ss], ['E', u.ii + u.ic + u.is + u.ci + u.cc + u.si + u.ss], ['F', T.left.i + T.left.c + T.left.s]].forEach(([c, v]) => fx(ws, 15, c.charCodeAt(0) - 64, `SUM(${c}12:${c}14)`, r2(v), { fmt: MONEY })); totalStyle(ws, 15, 1, 6);
    put(ws, 16, 1, 'Tax payable in cash (before TCS credit)', { bold: true }); fx(ws, 16, 2, 'B7-B15', T.pay.i, { fmt: MONEY }); fx(ws, 16, 3, 'C7-C15', T.pay.c, { fmt: MONEY }); fx(ws, 16, 4, 'D7-D15', T.pay.s, { fmt: MONEY }); fx(ws, 16, 5, 'SUM(B16:D16)', r2(T.pay.i + T.pay.c + T.pay.s), { fmt: MONEY, bold: true });
    put(ws, 18, 1, '3. TCS (Section 52) - collected by platforms; credited to your ELECTRONIC CASH LEDGER (not claimed as ITC in GSTR-3B)', { bold: true });
    put(ws, 19, 1, 'TCS rate (since 10-Jul-2024)'); put(ws, 19, 2, 0.005, { fmt: '0.00%', color: '0000FF' }); put(ws, 19, 3, 0.0025, { fmt: '0.00%', color: '0000FF' }); put(ws, 19, 4, 0.0025, { fmt: '0.00%', color: '0000FF' });
    head(ws, 20, ['Platform', 'Expected IGST', 'Expected CGST', 'Expected SGST', 'Expected total', 'Platform-reported IGST', 'Platform-reported CGST', 'Platform-reported SGST', 'Note']);
    ['Meesho', 'Flipkart', 'Snapdeal', 'Amazon'].forEach((p, i) => { const r = 21 + i; const t = M.tcs.find((x) => x.platform === p); put(ws, r, 1, p); const e = t?.expected || { i: 0, c: 0, s: 0 };
      put(ws, r, 2, e.i, { fmt: MONEY }); put(ws, r, 3, e.c, { fmt: MONEY }); put(ws, r, 4, e.s, { fmt: MONEY }); fx(ws, r, 5, `B${r}+C${r}+D${r}`, r2(e.i + e.c + e.s), { fmt: MONEY });
      if (t?.reported) { put(ws, r, 6, r2(t.reported.i), { fmt: MONEY }); put(ws, r, 7, r2(t.reported.c), { fmt: MONEY }); put(ws, r, 8, r2(t.reported.s), { fmt: MONEY }); } put(ws, r, 9, t ? t.note : 'Platform not uploaded', { wrap: true }); });
    put(ws, 25, 1, 'TOTAL'); [['B', T.tcs.i], ['C', T.tcs.c], ['D', T.tcs.s], ['E', r2(T.tcs.i + T.tcs.c + T.tcs.s)], ['F', r2(sumOf(M.tcs, (t) => t.reported?.i || 0))], ['G', r2(sumOf(M.tcs, (t) => t.reported?.c || 0))], ['H', r2(sumOf(M.tcs, (t) => t.reported?.s || 0))]].forEach(([c, v]) => fx(ws, 25, c.charCodeAt(0) - 64, `SUM(${c}21:${c}24)`, v, { fmt: MONEY })); put(ws, 25, 9, 'Estimate uses 0.5% IGST / 0.25% CGST / 0.25% SGST on net taxable value'); totalStyle(ws, 25, 1, 9);
    put(ws, 27, 1, '4. ESTIMATED CASH TO PAY AFTER TCS CREDIT (cash ledger credit is head-wise, so no cross-use between IGST/CGST/SGST)', { bold: true }); head(ws, 28, ['Item', 'IGST', 'CGST', 'SGST/UTGST', 'Total']);
    put(ws, 29, 1, 'Tax payable in cash (from section 2)'); ['B', 'C', 'D'].forEach((c, j) => fx(ws, 29, 2 + j, `${c}16`, T.pay[['i', 'c', 's'][j]], { fmt: MONEY })); fx(ws, 29, 5, 'SUM(B29:D29)', r2(T.pay.i + T.pay.c + T.pay.s), { fmt: MONEY });
    put(ws, 30, 1, 'Less: expected TCS credit in cash ledger'); ['B', 'C', 'D'].forEach((c, j) => fx(ws, 30, 2 + j, `${c}25`, T.tcs[['i', 'c', 's'][j]], { fmt: MONEY })); fx(ws, 30, 5, 'SUM(B30:D30)', r2(T.tcs.i + T.tcs.c + T.tcs.s), { fmt: MONEY });
    put(ws, 31, 1, 'ESTIMATED NET CASH TO PAY (challan)', { bold: true }); ['B', 'C', 'D'].forEach((c, j) => fx(ws, 31, 2 + j, `MAX(0,${c}29-${c}30)`, T.cash[['i', 'c', 's'][j]], { fmt: MONEY, bold: true })); fx(ws, 31, 5, 'SUM(B31:D31)', r2(T.cash.i + T.cash.c + T.cash.s), { fmt: MONEY, bold: true }); totalStyle(ws, 31, 1, 5);
    put(ws, 32, 1, 'TCS credit left over (carries forward)'); ['B', 'C', 'D'].forEach((c, j) => fx(ws, 32, 2 + j, `MAX(0,${c}30-${c}29)`, T.tcsLeft[['i', 'c', 's'][j]], { fmt: MONEY })); fx(ws, 32, 5, 'SUM(B32:D32)', r2(T.tcsLeft.i + T.tcsLeft.c + T.tcsLeft.s), { fmt: MONEY });
    put(ws, 34, 1, '5. FIGURES TO COMPARE WHEN GSTR-3B AUTO-FILLS', { bold: true }); head(ws, 35, ['GSTR-3B table', 'Value']);
    [['3.1(a) Taxable value', 'E6', T.net], ['3.1(a) Integrated tax', 'B7', T.out.i], ['3.1(a) Central tax', 'C7', T.out.c], ['3.1(a) State/UT tax', 'D7', T.out.s]].forEach(([l, f, v], i) => { put(ws, 36 + i, 1, l); fx(ws, 36 + i, 2, f, v, { fmt: MONEY }); });
    put(ws, 40, 1, '3.2 Inter-state supplies to unregistered persons (taxable value)'); fx(ws, 40, 2, `${q('B2CS by Platform')}!D10`, T.inter32, { fmt: MONEY });
    ws.mergeCells('A42:I43'); put(ws, 42, 1, 'Notes: (1) Platform TCS appears only after each platform files GSTR-8 (by the 10th); the credit reaches your cash ledger then. (2) GSTR-3B sales figures come from GSTR-1 and cannot be edited, so file GSTR-1 first and compare. (3) ITC counts only for bills in GSTR-2B. (4) This is a working estimate: please have your CA review before you file.', { wrap: true, italic: true }); }

  // =============== Verification Report ===============
  { const ws = sh['Verification Report']; widths(ws, [5, 74, 18, 18, 14, 11, 10, 70]);
    title(ws, `Verification report - GST ${M.period.label} (${biz})`, 'Every figure below is recomputed from the platform files you uploaded. PASS = agrees within the tolerance. CHECK = look at it. INFO = for your attention, not an error.');
    put(ws, 3, 1, 'OVERALL RESULT:', { bold: true }); ws.mergeCells('C3:H3'); const ov = put(ws, 3, 3, V.overall, { bold: true, fill: V.nCheck ? 'FFE9E9' : 'E2EFDA' });
    let r = 5; let n = 0; let lastGroup = '';
    for (const c of V.checks) {
      if (c.group !== lastGroup) { lastGroup = c.group; head(ws, r, ['#', c.group, 'This report', 'Reference', 'Difference', 'Tolerance', 'Status', 'Comment']); r += 1; }
      n += 1; put(ws, r, 1, n); put(ws, r, 2, c.label, { wrap: true }); put(ws, r, 3, c.ours, { fmt: MONEY }); put(ws, r, 4, c.ref, { fmt: MONEY }); if (c.diff != null) { fx(ws, r, 5, `ROUND(C${r}-D${r},2)`, c.diff, { fmt: MONEY }); put(ws, r, 6, c.tol, { fmt: '0.00' }); fx(ws, r, 7, `IF(ABS(E${r})<=F${r},"PASS","CHECK")`, c.status, { bold: true, align: 'center' }); } else put(ws, r, 7, 'INFO', { bold: true, align: 'center' });
      ws.getCell(r, 7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.status === 'PASS' ? 'E2EFDA' : c.status === 'CHECK' ? 'FFC7CE' : 'DDEBF7' } }; put(ws, r, 8, c.comment || '', { wrap: true }); r += 1;
    }
    r += 1; head(ws, r, ['#', 'SOURCE REPORT TOTALS (read from your files)', 'Value', '', '', '', '', 'Note']); r += 1;
    V.source.forEach((s, i) => { put(ws, r, 1, i + 1); put(ws, r, 2, s.label); put(ws, r, 3, s.value, { fmt: MONEY }); put(ws, r, 8, s.note); r += 1; });
    r += 1; head(ws, r, ['#', 'WHAT WE FOUND (flags)', 'Platform', 'Severity', '', '', '', 'Tax impact / what we did']); r += 1;
    V.flags.forEach((f, i) => { put(ws, r, 1, i + 1); put(ws, r, 2, f.what, { wrap: true }); put(ws, r, 3, f.platform, { wrap: true }); put(ws, r, 4, f.sev, { bold: true, fill: f.sev === 'High' ? 'FFC7CE' : f.sev === 'Medium' ? 'FFEB9C' : 'DDEBF7' }); ws.mergeCells(r, 5, r, 7); put(ws, r, 8, `${f.impact} ${f.did}`, { wrap: true }); ws.getRow(r).height = 44; r += 1; });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
