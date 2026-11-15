import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import bwipjs from 'bwip-js';

// Page sizes in points (72 pt = 1 inch). Portrait.
export const SIZES = { '3x5': { w: 216, h: 360, name: '3 x 5 inch' }, '4x6': { w: 288, h: 432, name: '4 x 6 inch' }, '100x150': { w: 283.46, h: 425.2, name: '100 x 150 mm' } };
const GRAY = rgb(0.35, 0.35, 0.35); const BLACK = rgb(0, 0, 0);

/** The built-in PDF fonts only print Latin letters. Anything else is replaced and reported. */
function printable(text, onReplace) {
  const t = String(text ?? '').replace(/₹/g, 'Rs ').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/\r/g, '');
  let out = '';
  for (const ch of t) { const c = ch.codePointAt(0); if (ch === '\n' || (c >= 32 && c <= 126) || (c >= 160 && c <= 255)) out += ch; else { out += '?'; onReplace?.(); } }
  return out;
}
function wrap(font, text, size, maxW) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let cur = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = cur ? `${cur} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= maxW) { cur = test; continue; }
      if (cur) lines.push(cur);
      cur = word;
      while (font.widthOfTextAtSize(cur, size) > maxW && cur.length > 1) { let i = cur.length - 1; while (i > 1 && font.widthOfTextAtSize(cur.slice(0, i), size) > maxW) i -= 1; lines.push(cur.slice(0, i)); cur = cur.slice(i); }
    }
    if (cur || !para) lines.push(cur);
  }
  return lines;
}
/** Largest font size (start..min) at which the text fits the box. */
function fit(font, text, maxW, maxH, start, min, lead = 1.2) {
  for (let s = start; s >= min; s -= 0.5) { const lines = wrap(font, text, s, maxW); if (lines.length * s * lead <= maxH) return { size: s, lines }; }
  const lines = wrap(font, text, min, maxW); const n = Math.max(1, Math.floor(maxH / (min * lead)));
  if (lines.length > n) { lines.length = n; lines[n - 1] = `${lines[n - 1].replace(/.{2}$/, '')}...`; }
  return { size: min, lines };
}

export async function makeLabels(labels, opts = {}) {
  const size = SIZES[opts.size] || SIZES['3x5']; const warnings = [];
  const pdf = await PDFDocument.create(); pdf.setTitle('Shipping labels'); pdf.setCreator('SPE Record Manager');
  const reg = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.CourierBold);
  const barCache = new Map();
  const barcode = async (awb) => {
    if (!barCache.has(awb)) barCache.set(awb, await pdf.embedPng(await bwipjs.toBuffer({ bcid: 'code128', text: awb, scale: 4, height: 14, includetext: false, paddingwidth: 0, paddingheight: 0, backgroundcolor: 'FFFFFF' })));
    return barCache.get(awb);
  };
  const s = size.w / 216; const Hd = size.h / s; // design units: 216 wide
  const sender = opts.showSender === false ? null : opts.sender;

  for (const [idx, l] of labels.entries()) {
    const rep = () => { if (!warnings.includes(`Label ${idx + 1}`)) warnings.push(`Label ${idx + 1}`); };
    const T = (v) => printable(v, rep);
    const page = pdf.addPage([size.w, size.h]);
    const Y = (y) => size.h - y * s; // design y (from top) -> pdf y
    const text = (str, x, y, o = {}) => page.drawText(str, { x: x * s, y: Y(y), size: (o.size || 9) * s, font: o.font || reg, color: o.color || BLACK });
    const centered = (str, y, o = {}) => { const f = o.font || reg; const sz = (o.size || 9); text(str, (216 - f.widthOfTextAtSize(str, sz * s) / s) / 2, y, o); };
    const hr = (y, dash) => page.drawLine({ start: { x: 8 * s, y: Y(y) }, end: { x: (216 - 8) * s, y: Y(y) }, thickness: 0.6 * s, color: GRAY, dashArray: dash ? [3 * s, 2 * s] : undefined });
    const M = 9; const W = 216 - 2 * M;

    page.drawRectangle({ x: 3 * s, y: 3 * s, width: size.w - 6 * s, height: size.h - 6 * s, borderColor: BLACK, borderWidth: 1 * s });

    // ---- header: courier + payment ----
    const courier = T(l.courier || '').toUpperCase();
    text(courier || 'SHIPPING LABEL', M, 20, { font: bold, size: courier ? 11 : 9 });
    const cod = l.payment === 'COD';
    const badge = cod ? `COD Rs ${Number(l.codAmount || 0).toLocaleString('en-IN')}` : 'PREPAID'; const bw = bold.widthOfTextAtSize(badge, 9 * s) / s + 12;
    if (cod) { page.drawRectangle({ x: (216 - M - bw) * s, y: Y(26), width: bw * s, height: 18 * s, color: BLACK }); text(badge, 216 - M - bw + 6, 20, { font: bold, size: 9, color: rgb(1, 1, 1) }); }
    else { page.drawRectangle({ x: (216 - M - bw) * s, y: Y(26), width: bw * s, height: 18 * s, borderColor: BLACK, borderWidth: 1 * s }); text(badge, 216 - M - bw + 6, 20, { font: bold, size: 9 }); }

    // ---- barcode + AWB ----
    const awb = T(l.awb).replace(/\s/g, '');
    const img = await barcode(awb); const bwid = Math.min(W, 190); const bh = 46;
    page.drawImage(img, { x: ((216 - bwid) / 2) * s, y: Y(34 + bh), width: bwid * s, height: bh * s });
    const awbSize = awb.length > 18 ? 11 : 14; centered(awb, 34 + bh + 15, { font: mono, size: awbSize });
    let top = 34 + bh + 24; hr(top);

    // ---- bottom-anchored blocks ----
    const footH = 30; const footTop = Hd - 6 - footH;
    const senderH = sender ? 64 : 0; const senderTop = footTop - senderH;
    const pinTop = senderTop - 36;

    // ---- SHIP TO ----
    text('SHIP TO', M, top + 11, { size: 7, font: bold, color: GRAY });
    const name = fit(bold, T(l.name), W, 30, 14, 10);
    name.lines.forEach((ln, i) => text(ln, M, top + 26 + i * name.size * 1.15, { font: bold, size: name.size }));
    const nameBottom = top + 26 + (name.lines.length - 1) * name.size * 1.15 + 5;
    const addr = [T(l.address), [T(l.city), T(l.state)].filter(Boolean).join(', ')].filter(Boolean).join('\n');
    const af = fit(reg, addr, W, Math.max(20, pinTop - nameBottom - (l.note ? 16 : 4)), 10.5, 7);
    af.lines.forEach((ln, i) => text(ln, M, nameBottom + 9 + i * af.size * 1.2, { size: af.size }));
    const pin = T(l.pincode).replace(/\D/g, '').slice(0, 6);
    if (l.note) { const nf = fit(bold, `NOTE: ${T(l.note).toUpperCase()}`, W, 10, 8.5, 6, 1.1); text(nf.lines[0], M, pinTop + 4, { font: bold, size: nf.size }); }
    if (pin) text(`PIN ${pin}`, M, pinTop + 22, { font: bold, size: 17 });
    if (l.phone) { const ph = T(l.phone); text(`Ph: ${ph}`, 216 - M - reg.widthOfTextAtSize(`Ph: ${ph}`, 10 * s) / s, pinTop + 22, { size: 10 }); }
    if (sender) {
      hr(senderTop - 2, true);
      text('FROM (RETURN ADDRESS)', M, senderTop + 9, { size: 6.5, font: bold, color: GRAY });
      text(T(sender.name || ''), M, senderTop + 20, { font: bold, size: 8.5 });
      const sf = fit(reg, T(sender.address || ''), W, senderH - 36, 7.5, 5.5);
      sf.lines.forEach((ln, i) => text(ln, M, senderTop + 30 + i * sf.size * 1.2, { size: sf.size }));
      if (sender.phone) text(`Ph: ${T(sender.phone)}`, M, senderTop + 30 + sf.lines.length * sf.size * 1.2 + 1, { size: 7.5 });
    }
    // ---- footer ----
    hr(footTop - 1);
    const dt = l.date || opts.date || '';
    const line1 = [l.orderId && `Order: ${T(l.orderId)}`, dt && `Date: ${dt}`].filter(Boolean).join('   ');
    const line2 = [l.product && `${T(l.product)}${l.qty ? ` x ${l.qty}` : ''}`, l.weight && `Wt: ${T(l.weight)}`].filter(Boolean).join('   ');
    const f1 = fit(reg, line1, W, 10, 7.5, 5.5, 1.1); const f2 = fit(reg, line2, W, 10, 7.5, 5.5, 1.1);
    if (line1) text(f1.lines[0], M, footTop + 11, { size: f1.size }); if (line2) text(f2.lines[0], M, footTop + 22, { size: f2.size });
  }
  if (warnings.length) opts.warnings?.push(`${warnings.join(', ')}: characters that cannot be printed (for example Hindi) were replaced with "?". Write the address in English letters.`);
  return Buffer.from(await pdf.save());
}
