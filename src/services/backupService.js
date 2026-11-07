import Backup from '../models/Backup.js';
import DailyBusiness from '../models/DailyBusiness.js';
import Purchase from '../models/Purchase.js';
import LabelPreset from '../models/LabelPreset.js';
import Settings from '../models/Settings.js';
import Payment from '../models/Payment.js';
import CourierEntry from '../models/CourierEntry.js';

const KEEP = 14;
const MAX_BYTES = 8 * 1024 * 1024; // MongoDB documents are limited to 16 MB

export async function snapshot(kind) {
  const [daily, purchases, presets, settings, payments, couriers] = await Promise.all([DailyBusiness.find().sort({ date: 1 }), Purchase.find().sort({ date: 1 }), LabelPreset.find(), Settings.findOne({ key: 'main' }), Payment.find(), CourierEntry.find().sort({ date: 1 })]);
  const json = JSON.stringify({ exportedAt: new Date().toISOString(), daily, purchases, presets, settings, payments, couriers });
  if (Buffer.byteLength(json) > MAX_BYTES) throw new Error('Backup is too large to store inside the database. Use the JSON download instead.');
  const b = await Backup.create({ kind, dailyCount: daily.length, purchaseCount: purchases.length, size: Buffer.byteLength(json), json });
  const old = await Backup.find().sort({ createdAt: -1 }).skip(KEEP).select('_id');
  if (old.length) await Backup.deleteMany({ _id: { $in: old.map((o) => o._id) } });
  return b;
}

/** No scheduler needed: the first visit after 24 hours quietly stores a fresh snapshot. */
export async function maybeAutoBackup() {
  const last = await Backup.findOne().sort({ createdAt: -1 }).select('createdAt');
  if (last && Date.now() - last.createdAt.getTime() < 24 * 3600 * 1000) return null;
  if (!(await DailyBusiness.exists({})) && !(await Purchase.exists({}))) return null; // nothing to protect yet
  return snapshot('auto');
}
