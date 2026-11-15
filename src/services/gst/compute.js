import { stateCode, stateName } from './states.js';
import { colOf, num, str, isoDate } from './readers.js';

export const r2 = (x) => { const s = x < 0 ? -1 : 1; return s * Math.round((Math.abs(x) + 1e-9) * 100) / 100; };
export const PLAT = ['Meesho', 'Flipkart', 'Snapdeal', 'Amazon B2C'];
export const DEFAULT_HSN = [{ code: '39231090', description: 'Plastic food containers (boxes, cases etc.)', uqc: 'NOS-NUMBERS' }, { code: '39241090', description: 'Plastic tableware / kitchenware', uqc: 'NOS-NUMBERS' }];
export const DEFAULT_AMAZON_ECO = '07AAICA3918J1CV';
const mode = (arr) => { const m = new Map(); arr.forEach((x) => m.set(x, (m.get(x) || 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]; };
const rate100 = (r) => Math.round((num(r['igst rate']) > 0 ? num(r['igst rate']) : num(r['cgst rate']) + num(r['sgst rate']) + num(r['utgst rate'])) * 10000) / 100;
const suffix = (s) => { const m = /^(.*?)(\d+)$/.exec(str(s)); return m ? { pre: m[1], n: Number(m[2]), w: m[2].length } : null; };
const monthLabel = (ym) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Maps a platform's HSN code onto one of the seller's own HSN codes (exact, then 6-digit, then 4-digit prefix). */
export function mapHsn(code, mine) {
  const c = str(code).replace(/\D/g, '');
  const codes = mine.map((x) => x.code);
  if (codes.includes(c)) return { hsn: c, mapped: false, original: c };
  for (const n of [6, 4]) { const m = codes.find((x) => c.length >= n && x.startsWith(c.slice(0, n))); if (m) return { hsn: m, mapped: true, original: c }; }
  return { hsn: c, mapped: true, original: c, unknown: true };
}

export function compute(data, settings = {}, purchases = [], opts = {}) {
  const myHsn = settings.hsn?.length ? settings.hsn : DEFAULT_HSN;
  const amazonEco = settings.amazonEcoGstin || DEFAULT_AMAZON_ECO;
  const flags = []; const warn = (o) => flags.push(o);
  const M = { platforms: {}, flags, usedDefaultAmazonEco: !settings.amazonEcoGstin };

  // ---------- seller & period ----------
  const gs = [];
  if (data.flipkart) gs.push(str(data.flipkart.g8.rows[0]?.[colOf(data.flipkart.g8.headers, 'gstin')]));
  if (data.snapdeal) gs.push(str(data.snapdeal.g8.rows[0]?.[colOf(data.snapdeal.g8.headers, 'gstin of seller')]));
  if (data.meeshoSales[0]) gs.push(str(data.meeshoSales[0].gstin));
  if (data.amazonB2C[0]) gs.push(str(data.amazonB2C[0]['seller gstin']));
  const sellerGstin = mode(gs.filter(Boolean)) || '';
  const sellerState = sellerGstin.slice(0, 2) || '07';
  if (new Set(gs.filter(Boolean)).size > 1) warn({ sev: 'High', platform: 'All', what: 'The reports carry different seller GSTINs.', impact: 'Sales may belong to more than one registration.', did: 'Used the most common one.' });
  const dates = [...data.meeshoSales.map((r) => isoDate(r.order_date)), ...data.amazonB2C.filter((r) => str(r['transaction type']) === 'Shipment').map((r) => isoDate(r['shipment date']))].filter(Boolean).map((d) => d.slice(0, 7));
  const ym = opts.period || mode(dates) || new Date().toISOString().slice(0, 7);
  const [Y, Mo] = ym.split('-').map(Number);
  const periodStart = `${ym}-01`; const periodEnd = `${ym}-${String(new Date(Y, Mo, 0).getDate()).padStart(2, '0')}`;
  Object.assign(M, { sellerGstin, sellerState, period: { ym, label: monthLabel(ym), start: periodStart, end: periodEnd } });
  const unknownStates = new Set();
  const sc = (raw) => { const c = stateCode(raw); if (!c) unknownStates.add(str(raw)); return c || '97'; };

  // ---------- B2CS rows (net of returns) per platform / state / rate ----------
  const rows = []; const src = {};
  const add = (platform, eco, code, rate, net, extra = {}) => rows.push({ platform, eco, code, rate, net: r2(net), ...extra });
  if (data.meeshoSales.length) {
    const g = new Map();
    const take = (list, sign) => list.forEach((r) => { const code = sc(r.end_customer_state_new); const rate = num(r.gst_rate); const k = `${code}|${rate}`; const o = g.get(k) || { code, rate, s: 0, r: 0, ts: 0, tr: 0 }; if (sign > 0) { o.s += num(r.total_taxable_sale_value); o.ts += num(r.tax_amount); } else { o.r += num(r.total_taxable_sale_value); o.tr += num(r.tax_amount); } g.set(k, o); });
    take(data.meeshoSales, 1); take(data.meeshoReturns, -1);
    const eco = str(data.meeshoSales[0].eco_tcs_gstin);
    for (const o of g.values()) add('Meesho', eco, o.code, o.rate, o.s - o.r, { gross: o.s, ret: o.r });
    src.meesho = { sales: data.meeshoSales.reduce((n, r) => n + num(r.total_taxable_sale_value), 0), returns: data.meeshoReturns.reduce((n, r) => n + num(r.total_taxable_sale_value), 0), taxS: data.meeshoSales.reduce((n, r) => n + num(r.tax_amount), 0), taxR: data.meeshoReturns.reduce((n, r) => n + num(r.tax_amount), 0), rowsS: data.meeshoSales.length, rowsR: data.meeshoReturns.length, eco };
  }
  const gst1Platform = (name, pack) => {
    if (!pack) return;
    const hb = pack.b.headers; const ha = pack.a.headers; const g8h = pack.g8.headers; const g8 = pack.g8.rows[0] || {};
    const eco = str(g8[colOf(g8h, 'gstin of flipkart') || colOf(g8h, 'tcs gstin')]);
    const info = { gross: 0, ret: 0, net: 0, tax: 0 };
    for (const r of pack.a.rows) { const net = num(r[colOf(ha, 'aggregate')]); add(name, eco, sellerState, num(r[colOf(ha, 'cgst', '%')]) + num(r[colOf(ha, 'sgst', '%')]), net); info.gross += num(r[colOf(ha, 'gross')]); info.ret += Math.abs(num(r[colOf(ha, 'return')])); info.net += net; info.tax += num(r[colOf(ha, 'cgst', 'amount')]) + num(r[colOf(ha, 'sgst', 'amount')]); }
    for (const r of pack.b.rows) { const net = num(r[colOf(hb, 'aggregate')]); add(name, eco, sc(r[colOf(hb, 'delivered', 'state')]), num(r[colOf(hb, 'igst', '%')]), net); info.gross += num(r[colOf(hb, 'gross')]); info.ret += Math.abs(num(r[colOf(hb, 'return')])); info.net += net; info.tax += num(r[colOf(hb, 'igst', 'amount')]); }
    const hh = pack.hsn.headers; const qtyH = colOf(hh, 'quantity'); const taxH = colOf(hh, 'taxable'); const valH = hh.find((h) => h.includes('total') && h.includes('value') && !h.includes('taxable'));
    info.hsnRows = pack.hsn.rows.map((r) => ({ code: str(r[colOf(hh, 'hsn')]).split('.')[0], qty: num(r[qtyH]), taxable: num(r[taxH]), value: num(r[valH]), igst: num(r[colOf(hh, 'igst', 'amount')]), cgst: num(r[colOf(hh, 'cgst', 'amount')]), sgst: num(r[colOf(hh, 'sgst', 'amount')]) }));
    info.g8 = { gross: num(g8[colOf(g8h, 'gross')]), ret: Math.abs(num(g8[colOf(g8h, 'return')])), net: num(g8[colOf(g8h, 'net taxable')]), tcsI: num(g8[colOf(g8h, 'tcs igst')]), tcsC: num(g8[colOf(g8h, 'tcs cgst')]), tcsS: num(g8[colOf(g8h, 'tcs sgst')]), qty: num(g8[colOf(g8h, 'qty')]) };
    info.eco = eco; info.docs = pack.docs;
    src[name.toLowerCase()] = info;
  };
  gst1Platform('Flipkart', data.flipkart); gst1Platform('Snapdeal', data.snapdeal);
  const amLive = data.amazonB2C.filter((r) => ['Shipment', 'Refund'].includes(str(r['transaction type'])));
  if (amLive.length) {
    const g = new Map();
    for (const r of amLive) { const code = sc(r['ship to state']); const rate = rate100(r); const k = `${code}|${rate}`; const o = g.get(k) || { code, rate, s: 0, r: 0 }; const gross = num(r['tax exclusive gross']); if (str(r['transaction type']) === 'Refund') o.r += Math.abs(gross); else o.s += gross; g.set(k, o); }
    for (const o of g.values()) add('Amazon B2C', amazonEco, o.code, o.rate, o.s - o.r, { gross: o.s, ret: o.r });
    src.amazon = { gross: amLive.filter((r) => str(r['transaction type']) === 'Shipment').reduce((n, r) => n + num(r['tax exclusive gross']), 0), ret: amLive.filter((r) => str(r['transaction type']) === 'Refund').reduce((n, r) => n + Math.abs(num(r['tax exclusive gross'])), 0), taxNet: amLive.reduce((n, r) => n + num(r['total tax amount']), 0), tcsI: amLive.reduce((n, r) => n + num(r['tcs igst amount']), 0), tcsC: amLive.reduce((n, r) => n + num(r['tcs cgst amount']), 0), tcsS: amLive.reduce((n, r) => n + num(r['tcs sgst amount']), 0) };
  }
  rows.forEach((r) => {
    r.supply = r.code === sellerState ? 'Intra-State' : 'Inter-State';
    r.igst = r.supply === 'Inter-State' ? r2(r.net * r.rate / 100) : 0;
    r.cgst = r.supply === 'Intra-State' ? r2(r.net * r.rate / 200) : 0; r.sgst = r.cgst; r.total = r2(r.igst + r.cgst + r.sgst); r.stateName = stateName(r.code);
  });
  rows.sort((a, b) => PLAT.indexOf(a.platform) - PLAT.indexOf(b.platform) || Number(a.code) - Number(b.code) || a.rate - b.rate);
  M.b2cs = rows;

  // ---------- Table 7 combined ----------
  const t7 = new Map();
  for (const r of rows) { const k = `${r.code}|${r.rate}`; const o = t7.get(k) || { code: r.code, name: r.stateName, rate: r.rate, by: {} }; o.by[r.platform] = (o.by[r.platform] || 0) + r.net; t7.set(k, o); }
  M.table7 = [...t7.values()].sort((a, b) => Number(a.code) - Number(b.code) || a.rate - b.rate).map((o) => {
    const net = r2(Object.values(o.by).reduce((n, v) => n + v, 0)); const intra = o.code === sellerState;
    return { ...o, net, igst: intra ? 0 : r2(net * o.rate / 100), cgst: intra ? r2(net * o.rate / 200) : 0, sgst: intra ? r2(net * o.rate / 200) : 0 };
  });

  // ---------- Amazon B2B invoices / credit notes ----------
  const b2bAll = data.amazonB2B; const b2b = new Map(); const b2bCn = [];
  for (const r of b2bAll) {
    const type = str(r['transaction type']); const code = sc(r['ship to state']); const rate = rate100(r);
    if (type === 'Shipment') {
      const k = `${str(r['invoice number'])}|${rate}`; const o = b2b.get(k) || { gstin: str(r['customer bill to gstid']), name: str(r['buyer name']), invoice: str(r['invoice number']), date: isoDate(r['invoice date']), code, pos: stateName(code), value: 0, taxable: 0, rate, amazonTax: 0, qty: 0, tcsI: 0, tcsC: 0, tcsS: 0 };
      o.value += num(r['invoice amount']); o.taxable += num(r['tax exclusive gross']); o.amazonTax += num(r['total tax amount']); o.qty += Math.abs(num(r.quantity)); o.tcsI += num(r['tcs igst amount']); o.tcsC += num(r['tcs cgst amount']); o.tcsS += num(r['tcs sgst amount']); b2b.set(k, o);
    } else if (type === 'Refund') b2bCn.push({ gstin: str(r['customer bill to gstid']), cn: str(r['credit note no']), cnDate: isoDate(r['credit note date']), invoice: str(r['invoice number']), invDate: isoDate(r['invoice date']), taxable: num(r['tax exclusive gross']), tax: num(r['total tax amount']), code });
  }
  M.b2b = [...b2b.values()].sort((a, b) => a.invoice.localeCompare(b.invoice, undefined, { numeric: true })).map((o) => {
    const intra = o.code === sellerState; const taxable = r2(o.taxable);
    const igst = intra ? 0 : r2(taxable * o.rate / 100); const cgst = intra ? r2(taxable * o.rate / 200) : 0;
    return { ...o, value: r2(o.value), taxable, igst, cgst, sgst: cgst, amazonIgst: r2(o.amazonTax), diff: r2(igst + 2 * cgst - o.amazonTax) };
  });
  M.b2bCredit = b2bCn;
  M.b2bTcs = { i: [...b2b.values()].reduce((n, o) => n + o.tcsI, 0), c: [...b2b.values()].reduce((n, o) => n + o.tcsC, 0), s: [...b2b.values()].reduce((n, o) => n + o.tcsS, 0) };

  // ---------- Table 14 (per operator) ----------
  const opName = { Meesho: 'MEESHO TECHNOLOGIES PRIVATE LIMITED', 'Amazon B2C': 'AMAZON SELLER SERVICES PRIVATE LIMITED', Flipkart: 'FLIPKART INTERNET PRIVATE LIMITED', Snapdeal: 'ACEVECTOR LIMITED (SNAPDEAL)' };
  const ecoOf = { Meesho: src.meesho?.eco, 'Amazon B2C': amazonEco, Flipkart: src.flipkart?.eco, Snapdeal: src.snapdeal?.eco };
  M.eco = ['Meesho', 'Amazon B2C', 'Flipkart', 'Snapdeal'].filter((p) => rows.some((r) => r.platform === p) || (p === 'Amazon B2C' && M.b2b.length)).map((p) => {
    const rs = rows.filter((r) => r.platform === p); const bs = p === 'Amazon B2C' ? M.b2b : [];
    const groups = new Map(); // rate -> {inter, intra}
    const bump = (rate, intra, v) => { const g = groups.get(rate) || { inter: 0, intra: 0 }; g[intra ? 'intra' : 'inter'] += v; groups.set(rate, g); };
    rs.forEach((r) => bump(r.rate, r.supply === 'Intra-State', r.net)); bs.forEach((b) => bump(b.rate, b.code === sellerState, b.taxable));
    let igst = 0; let cgst = 0; let net = 0;
    for (const [rate, g] of groups) { igst += r2(g.inter * rate / 100); cgst += r2(g.intra * rate / 200); net += g.inter + g.intra; }
    return { platform: p, name: opName[p], gstin: ecoOf[p], net: r2(net), igst: r2(igst), cgst: r2(cgst), sgst: r2(cgst), inter: r2([...groups.values()].reduce((n, g) => n + g.inter, 0)), intra: r2([...groups.values()].reduce((n, g) => n + g.intra, 0)) };
  });

  // ---------- HSN ----------
  const hsnA = []; const hsnNote = new Map();
  const note = (platform, code, orig) => { if (code !== orig) hsnNote.set(platform, [...new Set([...(hsnNote.get(platform) || []), orig])]); };
  const pushA = (platform, hsn, qty, inter, intra, rate, extra = '') => { const ex = hsnA.find((x) => x.platform === platform && x.hsn === hsn && x.rate === rate); if (ex) { ex.qty += qty; ex.inter += inter; ex.intra += intra; } else hsnA.push({ platform, hsn, qty, inter, intra, rate, extra }); };
  if (data.meeshoSales.length) {
    const g = new Map();
    const take = (list, sign) => list.forEach((r) => { const m = mapHsn(r.hsn_code, myHsn); note('Meesho', m.hsn, m.original); const rate = num(r.gst_rate); const intra = sc(r.end_customer_state_new) === sellerState; const k = `${m.hsn}|${rate}`; const o = g.get(k) || { hsn: m.hsn, rate, qty: 0, inter: 0, intra: 0 }; o.qty += sign * num(r.quantity); o[intra ? 'intra' : 'inter'] += sign * num(r.total_taxable_sale_value); g.set(k, o); });
    take(data.meeshoSales, 1); take(data.meeshoReturns, -1);
    for (const o of g.values()) pushA('Meesho', o.hsn, o.qty, r2(o.inter), r2(o.intra), o.rate);
  }
  for (const [name, p] of [['Flipkart', src.flipkart], ['Snapdeal', src.snapdeal]]) {
    if (!p) continue;
    const rs = rows.filter((r) => r.platform === name); const interT = rs.filter((r) => r.supply === 'Inter-State').reduce((n, r) => n + r.net, 0); const intraT = rs.filter((r) => r.supply === 'Intra-State').reduce((n, r) => n + r.net, 0);
    const rate = mode(rs.map((r) => r.rate)); const tot = p.hsnRows.reduce((n, h) => n + h.taxable, 0) || 1;
    const by = new Map(); p.hsnRows.forEach((h) => { const m = mapHsn(h.code, myHsn); note(name, m.hsn, m.original); const o = by.get(m.hsn) || { qty: 0, taxable: 0 }; o.qty += h.qty; o.taxable += h.taxable; by.set(m.hsn, o); });
    let i = 0; let usedInter = 0; let usedIntra = 0;
    for (const [hsn, o] of by) { i += 1; const last = i === by.size; const inter = last ? r2(interT - usedInter) : r2(interT * o.taxable / tot); const intra = last ? r2(intraT - usedIntra) : r2(intraT * o.taxable / tot); usedInter += inter; usedIntra += intra; pushA(name, hsn, o.qty, inter, intra, rate); }
  }
  const amHsn = (list, label) => {
    const g = new Map();
    list.forEach((r) => { const m = mapHsn(str(r['hsn/sac']).split('.')[0], myHsn); note(label, m.hsn, m.original); const sign = str(r['transaction type']) === 'Refund' ? -1 : 1; const rate = rate100(r); const intra = sc(r['ship to state']) === sellerState; const k = `${m.hsn}|${rate}`; const o = g.get(k) || { hsn: m.hsn, rate, qty: 0, inter: 0, intra: 0 }; o.qty += sign * Math.abs(num(r.quantity)); o[intra ? 'intra' : 'inter'] += sign * Math.abs(num(r['tax exclusive gross'])); g.set(k, o); });
    for (const o of g.values()) pushA(label, o.hsn, o.qty, r2(o.inter), r2(o.intra), o.rate);
  };
  amHsn(amLive, 'Amazon B2C'); amHsn(b2bAll.filter((r) => str(r['transaction type']) === 'Shipment'), 'Amazon B2B');
  hsnA.forEach((x) => { x.total = r2(x.inter + x.intra); x.original = hsnNote.get(x.platform) || []; });
  M.hsnA = hsnA;
  const hb = new Map();
  hsnA.forEach((x) => { const k = `${x.hsn}|${x.rate}`; const o = hb.get(k) || { hsn: x.hsn, rate: x.rate, qty: 0, inter: 0, intra: 0 }; o.qty += x.qty; o.inter += x.inter; o.intra += x.intra; hb.set(k, o); });
  M.hsnB = [...hb.values()].sort((a, b) => a.hsn.localeCompare(b.hsn)).map((o) => { const meta = myHsn.find((m) => m.code === o.hsn); const inter = r2(o.inter); const intra = r2(o.intra); const igst = r2(inter * o.rate / 100); const cgst = r2(intra * o.rate / 200); return { ...o, inter, intra, total: r2(inter + intra), igst, cgst, sgst: cgst, description: meta?.description || 'ADD DESCRIPTION', uqc: meta?.uqc || 'NOS-NUMBERS', unknown: !meta, value: r2(inter + intra + igst + 2 * cgst) }; });

  // ---------- Section 13 documents ----------
  const docs = [];
  const seriesNote = (from, to, total, cancelled) => { const a = suffix(from); const b = suffix(to); if (a && b && a.pre === b.pre) { const exp = b.n - a.n + 1; return exp === total ? `No gaps in sequence; ${cancelled} cancelled` : `Range holds ${exp} numbers but ${total} issued - please check`; } return ''; };
  if (data.meeshoSales.length) docs.push({ platform: 'Meesho', nature: 'Invoices for outward supply', from: 'Not in Meesho files', to: 'Not in Meesho files', total: null, cancelled: null, note: 'Get the invoice range from your Meesho panel; no tax impact', missing: true });
  if (src.flipkart) src.flipkart.docs.rows.forEach((r) => { const h = src.flipkart.docs.headers; const from = str(r[colOf(h, 'series', 'from')]); const to = str(r[colOf(h, 'series', 'to')]); const total = num(r[colOf(h, 'total')]); const c = num(r[colOf(h, 'cancel')]); docs.push({ platform: 'Flipkart', nature: 'Invoices for outward supply', from, to, total, cancelled: c, note: seriesNote(from, to, total, c) }); });
  if (src.snapdeal) src.snapdeal.docs.rows.forEach((r) => { const h = src.snapdeal.docs.headers; const credit = /credit/i.test(str(r[colOf(h, 'trx')])); const from = str(r[colOf(h, 'from')]); const to = str(r[colOf(h, 'series', 'to')] ?? r[colOf(h, 'to')]); const total = num(r[colOf(h, 'total')]); const c = num(r[colOf(h, 'cancel')]); const net = num(r[colOf(h, 'net')]); const a = suffix(from); const b = suffix(to);
    let nt = credit ? seriesNote(from, to, total, c) : `${c} cancelled invoices (seq ${a?.n}-${b?.n} = ${total})`; if (net !== total - c) nt = `Snapdeal shows net issued ${net} - report error; ${total - c} used`; docs.push({ platform: 'Snapdeal', nature: credit ? 'Credit Note' : 'Invoices for outward supply', from, to, total, cancelled: c, note: nt }); });
  const amAll = [...data.amazonB2C, ...b2bAll];
  const inPeriod = (r) => { const d = isoDate(r['invoice date']); return !d || (d >= periodStart && d <= periodEnd); };
  const shipNums = new Set(); const cancelNums = new Set(); const outside = new Set();
  amAll.forEach((r) => { const n = str(r['invoice number']); if (!n) return; const t = str(r['transaction type']); if (t === 'Shipment' || t === 'Cancel') { if (!inPeriod(r)) { outside.add(n); return; } (t === 'Shipment' ? shipNums : cancelNums).add(n); } });
  const cancelOnly = [...cancelNums].filter((n) => !shipNums.has(n));
  const all = [...shipNums, ...cancelOnly]; const bySer = new Map();
  all.forEach((n) => { const s = suffix(n); if (!s) return; const arr = bySer.get(s.pre) || []; arr.push({ n: s.n, s: n }); bySer.set(s.pre, arr); });
  for (const arr of bySer.values()) { arr.sort((a, b) => a.n - b.n); const exp = arr[arr.length - 1].n - arr[0].n + 1; const canc = arr.filter((x) => cancelOnly.includes(x.s)).map((x) => x.s);
    const out = [...outside].filter((n) => !shipNums.has(n) && !cancelOnly.includes(n)).sort((a, b) => suffix(a).n - suffix(b).n);
    docs.push({ platform: 'Amazon', nature: 'Invoices for outward supply', from: arr[0].s, to: arr[arr.length - 1].s, total: arr.length, cancelled: canc.length, note: `Shared B2C+B2B series; ${exp === arr.length ? 'no gaps' : `${exp - arr.length} number(s) missing in the range`}.${canc.length ? ` Cancelled: ${canc.join(', ')}.` : ''}${out.length ? ` ${out.join(', ')} are dated before ${periodStart} (shipped this month): not counted here; remove them from taxable value if already filed last month.` : ''}` }); }
  M.amazonOutside = [...outside].filter((n) => !shipNums.has(n)).sort();
  const cnLines = [...data.amazonB2C, ...b2bAll].filter((r) => str(r['transaction type']) === 'Refund' && str(r['credit note no']));
  const cnSet = [...new Set(cnLines.map((r) => str(r['credit note no'])))].map((s) => ({ s, ...suffix(s) })).filter((x) => x.n !== undefined).sort((a, b) => a.n - b.n);
  if (cnSet.length) docs.push({ platform: 'Amazon', nature: 'Credit Note', from: cnSet[0].s, to: cnSet[cnSet.length - 1].s, total: cnSet.length, cancelled: 0, note: `${cnLines.length} refund lines; ${cnSet[cnSet.length - 1].n - cnSet[0].n + 1 === cnSet.length ? 'no gaps' : 'gaps in range - check'}` });
  M.docs = docs;

  // ---------- credit notes ----------
  const rate = mode(rows.map((r) => r.rate)) || 18; M.rate = rate;
  const cs = [];
  if (src.meesho) cs.push({ platform: 'Meesho', count: `${src.meesho.rowsR} return rows`, taxable: r2(src.meesho.returns), tax: r2(src.meesho.taxR), note: 'Return file; no credit-note numbers in report' });
  if (src.flipkart) cs.push({ platform: 'Flipkart', count: 'Net figures only', taxable: r2(src.flipkart.ret), tax: r2(src.flipkart.ret * rate / 100), note: `7(B)(2)+7(A)(2) returns; GSTR-8 shows ${src.flipkart.g8.ret.toLocaleString('en-IN', { minimumFractionDigits: 2 })} - net sales is the same` });
  const sdCn = docs.find((d) => d.platform === 'Snapdeal' && d.nature === 'Credit Note');
  if (src.snapdeal) cs.push({ platform: 'Snapdeal', count: sdCn ? `${sdCn.total} credit notes` : 'Net figures only', taxable: r2(src.snapdeal.ret), tax: r2(src.snapdeal.ret * rate / 100), note: 'Series in Section 13 sheet' });
  if (src.amazon) cs.push({ platform: 'Amazon', count: `${cnLines.length} lines / ${cnSet.length} credit notes`, taxable: r2(src.amazon.ret), tax: r2(src.amazon.ret * rate / 100), note: 'Detail below' });
  M.creditSummary = cs;
  M.amazonCn = data.amazonB2C.filter((r) => str(r['transaction type']) === 'Refund').map((r) => { const code = sc(r['ship to state']); const intra = code === sellerState; const tax = num(r['total tax amount']); return { cn: str(r['credit note no']), cnDate: isoDate(r['credit note date']), invoice: str(r['invoice number']), invDate: isoDate(r['invoice date']), pos: stateName(code), supply: intra ? 'Intra-State' : 'Inter-State', qty: Math.abs(num(r.quantity)), taxable: num(r['tax exclusive gross']), tax, igst: intra ? 0 : tax, cgst: intra ? tax / 2 : 0, sgst: intra ? tax / 2 : 0 }; }).sort((a, b) => suffix(a.cn).n - suffix(b.cn).n);

  // ---------- TCS ----------
  const exp = (platform) => { const rs = rows.filter((r) => r.platform === platform); const b2bI = platform === 'Amazon B2C' ? M.b2b.filter((b) => b.code !== sellerState).reduce((n, b) => n + b.taxable, 0) : 0; const b2bA = platform === 'Amazon B2C' ? M.b2b.filter((b) => b.code === sellerState).reduce((n, b) => n + b.taxable, 0) : 0; const inter = b2bI + rs.filter((r) => r.supply === 'Inter-State').reduce((n, r) => n + r.net, 0); const intra = b2bA + rs.filter((r) => r.supply === 'Intra-State').reduce((n, r) => n + r.net, 0); return { i: r2(inter * 0.005), c: r2(intra * 0.0025), s: r2(intra * 0.0025) }; };
  M.tcs = ['Meesho', 'Flipkart', 'Snapdeal', 'Amazon B2C'].filter((p) => rows.some((r) => r.platform === p)).map((p) => {
    const e = exp(p); let rep = null; let nt = '';
    if (p === 'Meesho') nt = 'Not in files - estimate only; check Meesho GSTR-8 after the 10th';
    if (p === 'Flipkart') { rep = { i: src.flipkart.g8.tcsI, c: src.flipkart.g8.tcsC, s: src.flipkart.g8.tcsS }; nt = 'Per GSTR-8 Section 3'; }
    if (p === 'Snapdeal') { rep = { i: src.snapdeal.g8.tcsI, c: src.snapdeal.g8.tcsC, s: src.snapdeal.g8.tcsS }; nt = rep.i < 0 ? 'Snapdeal shows NEGATIVE TCS - unexplained; rely on the actual credit, not this' : 'Per GSTR-8 Section 3'; }
    if (p === 'Amazon B2C') { rep = { i: r2(src.amazon.tcsI + M.b2bTcs.i), c: r2(src.amazon.tcsC + M.b2bTcs.c), s: r2(src.amazon.tcsS + M.b2bTcs.s) }; nt = `MTR: B2C ${src.amazon.tcsI.toFixed(2)} + B2B ${M.b2bTcs.i.toFixed(2)} IGST; CGST/SGST ${rep.c.toFixed(2)} each`; }
    return { platform: p === 'Amazon B2C' ? 'Amazon' : p, expected: e, reported: rep, note: nt };
  });

  // ---------- ITC from purchase bills ----------
  M.itc = purchases;
  M.src = src; M.unknownStates = [...unknownStates]; M.myHsn = myHsn; M.amazonEco = amazonEco;
  return M;
}

const sum = (a, f) => a.reduce((n, x) => n + f(x), 0);
/** Tax summary figures (output tax, ITC, Rule 88A set-off, TCS credit, cash to pay, GSTR-3B figures). */
export function taxSummary(M) {
  const net = r2(sum(M.table7, (x) => x.net) + sum(M.b2b, (x) => x.taxable));
  const out = { i: r2(sum(M.table7, (x) => x.igst) + sum(M.b2b, (x) => x.igst)), c: r2(sum(M.table7, (x) => x.cgst) + sum(M.b2b, (x) => x.cgst)), s: r2(sum(M.table7, (x) => x.sgst) + sum(M.b2b, (x) => x.sgst)) };
  const claim = M.itc.filter((b) => b.claim === 'Y');
  const itc = { i: r2(sum(claim, (b) => b.igst)), c: r2(sum(claim, (b) => b.cgst)), s: r2(sum(claim, (b) => b.sgst)) };
  const a1 = Math.min(itc.i, out.i); const a2 = Math.min(itc.i - a1, out.c); const a3 = Math.min(itc.i - a1 - a2, out.s);
  const b1 = Math.min(itc.c, out.c - a2); const b2 = Math.min(itc.c - b1, out.i - a1);
  const c1 = Math.min(itc.s, out.s - a3); const c2 = Math.min(itc.s - c1, out.i - a1 - b2);
  const use = { ii: a1, ic: a2, is: a3, ci: b2, cc: b1, si: c2, ss: c1 };
  const pay = { i: r2(out.i - a1 - b2 - c2), c: r2(out.c - a2 - b1), s: r2(out.s - a3 - c1) };
  const left = { i: r2(itc.i - a1 - a2 - a3), c: r2(itc.c - b1 - b2), s: r2(itc.s - c1 - c2) };
  const tcs = { i: r2(sum(M.tcs, (t) => t.expected.i)), c: r2(sum(M.tcs, (t) => t.expected.c)), s: r2(sum(M.tcs, (t) => t.expected.s)) };
  const cash = { i: Math.max(0, r2(pay.i - tcs.i)), c: Math.max(0, r2(pay.c - tcs.c)), s: Math.max(0, r2(pay.s - tcs.s)) };
  const tcsLeft = { i: Math.max(0, r2(tcs.i - pay.i)), c: Math.max(0, r2(tcs.c - pay.c)), s: Math.max(0, r2(tcs.s - pay.s)) };
  const inter32 = r2(sum(M.b2cs.filter((r) => r.supply === 'Inter-State'), (r) => r.net));
  return { net, out, itc, use, pay, left, tcs, cash, tcsLeft, inter32, claimCount: claim.length };
}
