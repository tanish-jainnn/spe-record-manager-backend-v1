import { r2, taxSummary } from './compute.js';
import { str, num } from './readers.js';

const sum = (a, f) => a.reduce((n, x) => n + f(x), 0);

/** Self-checks, source totals and flags for the "Verification Report" sheet. */
export function verify(M, data) {
  const T = taxSummary(M); const checks = []; const rows = M.b2cs; const S = M.src;
  const P = (p, f = 'net') => r2(sum(rows.filter((r) => r.platform === p), (r) => r[f]));
  const tax = (p) => r2(sum(rows.filter((r) => r.platform === p), (r) => r.total));
  const chk = (group, label, ours, ref, tol, comment = '') => checks.push({ group, label, ours: r2(ours), ref: r2(ref), tol, diff: r2(ours - ref), status: Math.abs(ours - ref) <= tol ? 'PASS' : 'CHECK', comment });
  const info = (group, label, ours, ref, comment) => checks.push({ group, label, ours, ref, tol: null, diff: null, status: 'INFO', comment });
  const A = 'A. Your platform files vs this report'; const B = 'B. Tables agree with each other'; const C = 'C. Tax summary and TCS'; const D = 'D. Purchase bills / ITC';
  if (S.meesho) { chk(A, 'Meesho: net taxable (state-wise) = sales - returns in the files', P('Meesho'), S.meesho.sales - S.meesho.returns, 0.05); chk(A, 'Meesho: tax recalculated = tax in the files (net of returns)', tax('Meesho'), S.meesho.taxS - S.meesho.taxR, 1, 'Small gap is rounding across states'); }
  for (const [name, key] of [['Flipkart', 'flipkart'], ['Snapdeal', 'snapdeal']]) {
    const p = S[key]; if (!p) continue;
    chk(A, `${name}: net taxable (state-wise) = net in its GSTR-8 sheet`, P(name), p.g8.net, 0.05);
    chk(A, `${name}: net taxable = HSN sheet taxable total`, P(name), sum(p.hsnRows, (h) => h.taxable), 0.05);
    chk(A, `${name}: tax recalculated = tax in its GSTR-1 sheets`, tax(name), p.tax, 1, 'Platforms round per invoice, so a few paise can differ');
  }
  if (S.amazon) { chk(A, 'Amazon B2C: net taxable = shipments - refunds in the MTR', P('Amazon B2C'), S.amazon.gross - S.amazon.ret, 0.05); chk(A, 'Amazon B2C: tax recalculated = Amazon tax (net of refunds)', tax('Amazon B2C'), S.amazon.taxNet, 1, 'Small gap is rounding'); }
  if (M.b2b.length) { chk(A, 'Amazon B2B: IGST/CGST/SGST recalculated = Amazon tax', sum(M.b2b, (b) => b.igst + b.cgst + b.sgst), sum(M.b2b, (b) => b.amazonIgst), 0.05, 'Amazon can differ by a paisa or two'); }
  chk(B, 'Table 7 total net taxable = sum of the state-wise platform rows', sum(M.table7, (x) => x.net), sum(rows, (r) => r.net), 0.01);
  chk(B, 'Table 14 net taxable = Table 7 + Amazon B2B', sum(M.eco, (e) => e.net), sum(M.table7, (x) => x.net) + sum(M.b2b, (b) => b.taxable), 0.05);
  chk(B, 'Table 14 IGST = Table 7 IGST + B2B IGST', sum(M.eco, (e) => e.igst), sum(M.table7, (x) => x.igst) + sum(M.b2b, (b) => b.igst), 0.1);
  chk(B, 'Table 14 CGST = Table 7 CGST + B2B CGST', sum(M.eco, (e) => e.cgst), sum(M.table7, (x) => x.cgst) + sum(M.b2b, (b) => b.cgst), 0.1);
  chk(B, 'HSN summary taxable = Table 7 + B2B', sum(M.hsnB, (h) => h.total), sum(M.table7, (x) => x.net) + sum(M.b2b, (b) => b.taxable), 0.05);
  chk(B, 'HSN summary IGST = Table 14 IGST', sum(M.hsnB, (h) => h.igst), sum(M.eco, (e) => e.igst), 0.1);
  chk(B, 'HSN summary CGST = Table 14 CGST', sum(M.hsnB, (h) => h.cgst), sum(M.eco, (e) => e.cgst), 0.1);
  chk(B, 'HSN build-up total = HSN summary total', sum(M.hsnA, (h) => h.total), sum(M.hsnB, (h) => h.total), 0.05);
  chk(B, 'Section 13: net issued = total - cancelled', sum(M.docs.filter((d) => d.total != null), (d) => d.total - d.cancelled), sum(M.docs.filter((d) => d.total != null), (d) => d.total) - sum(M.docs.filter((d) => d.total != null), (d) => d.cancelled), 0);
  const neg = M.table7.filter((x) => x.net < 0);
  chk(B, 'States with negative net taxable after combining platforms (should be 0)', neg.length, 0, 0, neg.length ? neg.map((x) => x.name).join(', ') : 'None');
  chk(B, 'State names not recognised (should be 0)', M.unknownStates.length, 0, 0, M.unknownStates.join(', '));
  chk(B, 'Seller-state rows carry only CGST + SGST (IGST should be 0)', sum(M.table7.filter((x) => x.code === M.sellerState), (x) => x.igst), 0, 0);
  chk(C, 'Output tax = Table 7 + Amazon B2B', T.out.i + T.out.c + T.out.s, sum(M.table7, (x) => x.total || (x.igst + x.cgst + x.sgst)) + sum(M.b2b, (b) => b.igst + b.cgst + b.sgst), 0.01);
  chk(C, 'GSTR-3B 3.2 (inter-state to unregistered) = inter-state B2C taxable', T.inter32, sum(rows.filter((r) => r.supply === 'Inter-State'), (r) => r.net), 0.01);
  chk(C, 'ITC used + unused = ITC to claim', T.use.ii + T.use.ic + T.use.is + T.use.ci + T.use.cc + T.use.si + T.use.ss + T.left.i + T.left.c + T.left.s, T.itc.i + T.itc.c + T.itc.s, 0.01);
  chk(C, 'Cash to pay is never negative', Math.min(T.cash.i, T.cash.c, T.cash.s), Math.max(0, Math.min(T.cash.i, T.cash.c, T.cash.s)), 0);
  for (const t of M.tcs) {
    if (!t.reported) { info(C, `${t.platform}: TCS not in the platform file (estimate only)`, r2(t.expected.i + t.expected.c + t.expected.s), null, t.note); continue; }
    const rep = t.reported.i + t.reported.c + t.reported.s; const exp = t.expected.i + t.expected.c + t.expected.s;
    if (rep < 0) info(C, `${t.platform}: TCS shown by the platform is negative`, r2(rep), r2(exp), t.note);
    else chk(C, `${t.platform}: TCS expected (0.5%) = TCS reported`, exp, rep, 1, t.note);
  }
  const cl = M.itc.filter((b) => b.claim === 'Y');
  info(D, 'Purchase bills marked to claim this month', cl.length, null, cl.length ? '' : 'No bills are marked "Claim" so input tax credit is zero and tax payable is the full amount');
  if (cl.length) { const noG = cl.filter((b) => !b.gstin); chk(D, 'Bills claimed without a supplier GSTIN (should be 0)', noG.length, 0, 0, noG.map((b) => b.invoice).join(', ')); const no2b = cl.filter((b) => b.in2b !== 'Y'); chk(D, 'Bills claimed that are not marked "in GSTR-2B" (should be 0)', no2b.length, 0, 0, no2b.map((b) => b.invoice).join(', ')); }

  // ---------- source totals ----------
  const source = [];
  const add = (l, v, n = '') => source.push({ label: l, value: r2(v), note: n });
  if (S.meesho) { add('Meesho sales: taxable value', S.meesho.sales, `${S.meesho.rowsS} rows`); add('Meesho returns: taxable value', S.meesho.returns, `${S.meesho.rowsR} rows`); add('Meesho net taxable', S.meesho.sales - S.meesho.returns); add('Meesho tax (net)', S.meesho.taxS - S.meesho.taxR); }
  for (const [n, k] of [['Flipkart', 'flipkart'], ['Snapdeal', 'snapdeal']]) { const p = S[k]; if (!p) continue; add(`${n} GSTR-1 gross taxable`, p.gross); add(`${n} GSTR-1 returns`, p.ret); add(`${n} GSTR-1 net taxable`, p.net); add(`${n} GSTR-8 net taxable`, p.g8.net); add(`${n} HSN taxable total`, sum(p.hsnRows, (h) => h.taxable)); add(`${n} TCS (IGST + CGST + SGST)`, p.g8.tcsI + p.g8.tcsC + p.g8.tcsS); }
  if (S.amazon) { add('Amazon B2C shipments: taxable value', S.amazon.gross); add('Amazon B2C refunds: taxable value', S.amazon.ret); add('Amazon B2C tax (net)', S.amazon.taxNet); add('Amazon B2C TCS (all heads)', S.amazon.tcsI + S.amazon.tcsC + S.amazon.tcsS); }
  if (M.b2b.length) { add('Amazon B2B taxable value', sum(M.b2b, (b) => b.taxable), `${M.b2b.length} invoices`); add('Amazon B2B TCS (all heads)', M.b2bTcs.i + M.b2bTcs.c + M.b2bTcs.s); }

  // ---------- flags ----------
  const flags = [...M.flags]; const f = (sev, platform, what, impact, did) => flags.push({ sev, platform, what, impact, did });
  if (M.usedDefaultAmazonEco) f('Medium', 'Amazon', `Amazon's GSTIN is not in the MTR reports. ${M.amazonEco} (saved as the default in the app) is used for Table 14 and the Amazon rows.`, 'None on tax. A wrong GSTIN would not match Amazon\'s own filing.', 'Confirm it against your Amazon tax invoice, then save it in GST settings.');
  if (S.meesho) f('Medium', 'Meesho', 'Meesho files have no TCS amounts and no invoice numbers.', 'None on tax. TCS is an estimate; Section 13 has no Meesho range.', 'TCS estimated at 0.5%; Meesho shown as "Not in Meesho files" in Section 13.');
  if (S.snapdeal && S.snapdeal.g8.tcsI < 0) f('Medium', 'Snapdeal', `TCS is shown as a negative amount (${S.snapdeal.g8.tcsI.toFixed(2)} IGST).`, 'None on tax. Affects only the TCS credit estimate.', 'Used the expected 0.5% instead; check the real credit in your cash ledger.');
  const sdd = M.docs.filter((d) => d.platform === 'Snapdeal'); if (sdd.some((d) => /report error/.test(d.note))) f('Medium', 'Snapdeal', 'Snapdeal shows "net issued" that does not equal issued minus cancelled.', 'None on tax (Table 13 only).', 'Used issued minus cancelled; confirm with Snapdeal.');
  if (S.snapdeal && sdd.find((d) => d.nature === 'Invoices for outward supply' && d.cancelled > 0)) { const d = sdd.find((x) => x.nature === 'Invoices for outward supply'); f('Info', 'Snapdeal', `${d.cancelled} of ${d.total} Snapdeal invoices are cancelled (${Math.round((d.cancelled / d.total) * 100)}%).`, 'None. Cancelled invoices carry no tax.', 'Reported as cancelled in Section 13.'); }
  if (S.flipkart) { const g = S.flipkart; if (Math.abs(g.gross - g.g8.gross) > 0.5 || Math.abs(g.ret - g.g8.ret) > 0.5) f('Info', 'Flipkart', `Gross sales / returns differ between the GSTR-1 sheets (${g.gross.toFixed(2)} / ${g.ret.toFixed(2)}) and the GSTR-8 sheet (${g.g8.gross.toFixed(2)} / ${g.g8.ret.toFixed(2)}). The net is the same.`, 'None. Only the net goes into GSTR-1.', 'Used the net figure.'); const hv = sum(g.hsnRows, (h) => h.value); const ht = sum(g.hsnRows, (h) => h.taxable + h.igst + h.cgst + h.sgst); if (Math.abs(hv - ht) > 1) f('Medium', 'Flipkart', `Flipkart HSN "Total value" (${hv.toFixed(2)}) is far from taxable + tax (${ht.toFixed(2)}).`, 'Affects only the Total value column of the HSN table.', 'Total value here = taxable + tax.'); const hq = sum(g.hsnRows, (h) => h.qty); if (g.g8.qty && Math.abs(hq - g.g8.qty) > 0) f('Info', 'Flipkart', `HSN quantity (${hq}) differs from the GSTR-8 net quantity (${g.g8.qty}).`, 'None on tax.', 'Used the HSN-sheet quantity.'); }
  const mapped = Object.entries(Object.fromEntries(M.hsnA.filter((h) => h.original.length).map((h) => [h.platform, h.original]))); mapped.forEach(([p, o]) => f('Medium', p, `${p} reports HSN code(s) ${o.join(', ')}; merged into your own HSN code(s) by matching the first digits.`, 'None on tax rate (same GST rate). Table 12 must use correct codes.', 'Used your two codes from GST settings; confirm the mapping with your CA.'));
  if (M.hsnB.some((h) => h.unknown)) f('High', 'All', `HSN code(s) ${M.hsnB.filter((h) => h.unknown).map((h) => h.hsn).join(', ')} are not in your GST settings.`, 'Table 12 needs a description and a valid code.', 'Add them in GST settings.');
  const negRows = rows.filter((r) => r.net < 0); if (negRows.length) f('Medium', [...new Set(negRows.map((r) => r.platform))].join(', '), `Negative net sales for ${negRows.map((r) => `${r.stateName} (${r.platform} ${r.net})`).join('; ')}.`, 'Combined with the other platforms the state total is usually positive.', 'Kept as reported; Table 7 combines platforms by state.');
  if (S.meesho) { const z = data.meeshoSales.filter((r) => num(r.quantity) === 0); if (z.length) f('Info', 'Meesho', `${z.length} rows have quantity 0 and negative values (${r2(sum(z, (r) => num(r.total_taxable_sale_value)))}); they look like shipping adjustments.`, 'Included in net taxable as Meesho reports it.', 'Included.'); const ids = new Set(data.meeshoSales.map((r) => r.sub_order_num)); const old = data.meeshoReturns.filter((r) => !ids.has(r.sub_order_num)); if (old.length) f('Info', 'Meesho', `${old.length} returns belong to orders not in this month's sales file (earlier months).`, 'They reduce this month\'s sales, as Meesho reports.', 'Netted this month.'); }
  if (M.amazonOutside.length) f('Medium', 'Amazon', `${M.amazonOutside.join(', ')} are dated before ${M.period.start} but are in this month's MTR (shipped this month).`, 'Counted in this month\'s taxable value as Amazon reports it.', 'Left out of the Section 13 range; remove them if already filed last month.');
  const cx = data.amazonB2C.filter((r) => str(r['transaction type']) === 'Cancel' && str(r['invoice number'])); if (cx.length) f('Info', 'Amazon', `${cx.length} cancelled order(s) carry an invoice number (${cx.map((r) => str(r['invoice number'])).join(', ')}).`, 'None. Cancelled invoices carry no tax.', 'Counted as cancelled in Section 13.');
  const shipOrders = new Set(data.amazonB2C.filter((r) => str(r['transaction type']) === 'Shipment').map((r) => str(r['order id']))); const rn = data.amazonB2C.filter((r) => str(r['transaction type']) === 'Refund' && !shipOrders.has(str(r['order id']))).length; if (rn) f('Info', 'Amazon', `${rn} refund line(s) are for sales that are not in this month's file.`, 'They reduce this month\'s B2C sales.', 'Netted this month.');
  const bd = M.b2b.filter((b) => Math.abs(b.diff) > 0.005); if (bd.length) f('Info', 'Amazon', `Amazon B2B tax differs from 18% by ${bd.map((b) => `${b.diff} on ${b.invoice}`).join(', ')}.`, 'A paisa or two.', 'Used the calculated tax.');
  if (M.unknownStates.length) f('High', 'All', `State name(s) not recognised: ${M.unknownStates.join(', ')}.`, 'Wrong place of supply changes IGST vs CGST/SGST.', 'Shown as "Other Territory"; fix the spelling.');
  const rates = [...new Set(rows.map((r) => r.rate))]; if (rates.length > 1) f('Info', 'All', `More than one GST rate in the data (${rates.join('%, ')}%).`, 'Table 7 has one row per state and rate.', 'Handled separately.');
  const big = data.amazonB2C.filter((r) => str(r['transaction type']) === 'Shipment' && num(r['invoice amount']) > 250000 && str(r['ship to state']).toUpperCase() !== 'DELHI'); f('Info', 'All', big.length ? `${big.length} inter-state B2C invoice(s) are above Rs 2.5 lakh.` : 'No inter-state B2C invoice above Rs 2.5 lakh, so Table 5 (B2C large) is empty.', 'None.', big.length ? 'Report them in Table 5.' : 'Nothing to enter.');
  f('Info', 'All', 'TCS rate assumed 0.5% (0.25% CGST + 0.25% SGST, or 0.5% IGST), in force since 10 July 2024.', 'Only the TCS estimate depends on it.', 'Please confirm the current rate.');
  if (!cl.length) f('High', 'All', 'No purchase bills are marked to claim input tax credit.', 'Tax payable is overstated by the credit you are entitled to.', 'Open the GST screen in the app, tick the bills in GSTR-2B and press Claim, then generate again.');
  const nPass = checks.filter((c) => c.status === 'PASS').length; const nCheck = checks.filter((c) => c.status === 'CHECK').length; const nInfo = checks.filter((c) => c.status === 'INFO').length;
  const overall = nCheck ? `${nCheck} OF ${nPass + nCheck} CHECKS NEED ATTENTION (${nInfo} information items)` : `ALL ${nPass} CHECKS PASS (${nInfo} information items)`;
  return { checks, source, flags, overall, nPass, nCheck, nInfo, T };
}
