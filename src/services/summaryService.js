import nodemailer from 'nodemailer';
import crypto from 'node:crypto';
import DailyBusiness from '../models/DailyBusiness.js';
import Purchase from '../models/Purchase.js';
import { getSettingsDoc } from '../controllers/settingsController.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { monthRange, todayStr, toDateStr, parseDate } from '../utils/dates.js';
import { fetchRecords, totalsOf, purchaseCounters } from './reportService.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inr = (n) => `₹${(Math.round((n || 0) * 100) / 100).toLocaleString('en-IN')}`;
const PL = [['Amazon', 'amazon'], ['Flipkart', 'flipkart'], ['Meesho', 'meesho'], ['Snapdeal', 'snapdeal']];

export async function buildSummaryData(dateStr = todayStr()) {
  const date = parseDate(dateStr);
  const { from, to, month } = monthRange(dateStr.slice(0, 7));
  const [today, records, counters, settings, due, earlier] = await Promise.all([
    DailyBusiness.findOne({ date }), fetchRecords(from, to), purchaseCounters(from, to), getSettingsDoc(),
    Purchase.aggregate([{ $match: { status: 'PENDING' } }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: { $subtract: ['$totalAmount', { $ifNull: ['$paidAmount', 0] }] } } } }]),
    Purchase.countDocuments({ status: 'PENDING', date: { $lt: new Date(date.getTime() - 7 * 864e5) } }),
  ]);
  return { date: toDateStr(date), month, today: today ? today.toJSON() : null, totals: totalsOf(records), counters, pending: { count: due[0]?.count || 0, amount: Math.max(0, due[0]?.amount || 0), over7: earlier }, target: settings.monthlyOrderTarget || 0, business: settings.businessName || 'SPE' };
}

/** Pure: turns the numbers into an email. */
export function formatSummary(d) {
  const t = d.today;
  const day = new Date(`${d.date}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const lines = [];
  if (t) {
    lines.push(`Today: ${t.totalOrders} orders (${PL.map(([n, k]) => `${n} ${t[`${k}Orders`]}`).join(', ')})`);
    lines.push(`Returns ${t.returnsReceived} · RTO ${t.rtoReceived}`);
  } else lines.push('Today: no entry was recorded yet.');
  const m = d.totals;
  let monthLine = `This month so far: ${m.totalOrders} orders over ${m.days} day(s), returns ${m.returns}, RTO ${m.rto}`;
  if (d.target > 0) monthLine += ` · target ${d.target} (${Math.round((m.totalOrders / d.target) * 100)}%)`;
  lines.push(monthLine);
  lines.push(`Purchase bills this month: ${d.counters.totalBills} (GST received ${d.counters.gstReceived}, Non-GST received ${d.counters.nonGstReceived}, pending ${d.counters.pendingBills})`);
  lines.push(d.pending.count ? `Pending bills overall: ${d.pending.count}, about ${inr(d.pending.amount)} still due${d.pending.over7 ? ` (${d.pending.over7} waiting more than 7 days)` : ''}` : 'No pending bills.');
  const subject = `${d.business} daily summary · ${day}${t ? ` · ${t.totalOrders} orders` : ''}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px"><h2 style="color:#3A075C;margin:0 0 4px">${esc(d.business)}</h2><p style="color:#6F6678;margin:0 0 16px">Daily summary · ${esc(day)}</p>${lines.map((l) => `<p style="margin:0 0 10px">${esc(l)}</p>`).join('')}</div>`;
  return { subject, text: `${d.business} · ${day}\n\n${lines.join('\n')}\n`, html };
}

let transport;
export function getTransport() {
  if (transport) return transport;
  if (!env.smtpHost || !env.smtpUser) throw new AppError('Email is not set up on the server yet. Add the SMTP settings on Render (see the README).', 400);
  transport = nodemailer.createTransport({ host: env.smtpHost, port: env.smtpPort, secure: env.smtpPort === 465, auth: { user: env.smtpUser, pass: env.smtpPass } });
  return transport;
}

export async function sendSummary(to, tr = getTransport()) {
  const msg = formatSummary(await buildSummaryData());
  await tr.sendMail({ from: env.mailFrom || env.smtpUser, to, subject: msg.subject, text: msg.text, html: msg.html });
  return msg.subject;
}

export const tokenOk = (given) => {
  const a = Buffer.from(String(given || '')); const b = Buffer.from(env.cronSecret);
  return env.cronSecret.length >= 16 && a.length === b.length && crypto.timingSafeEqual(a, b);
};
