import DailyBusiness from '../models/DailyBusiness.js';
import Purchase from '../models/Purchase.js';
import Backup from '../models/Backup.js';
import Settings from '../models/Settings.js';
import { maybeAutoBackup } from '../services/backupService.js';
import { asyncHandler } from '../utils/AppError.js';
import { monthRange, parseDate, todayStr, toDateStr } from '../utils/dates.js';
import { fetchRecords, purchaseCounters, totalsOf } from '../services/reportService.js';

export const dashboard = asyncHandler(async (req, res) => {
  const date = parseDate(req.query.date || todayStr());
  const { month, from, to } = monthRange(toDateStr(date).slice(0, 7));
  // Purchase counters belong to the current month, so they start from zero when a new month begins.
  const weekAgo = new Date(date.getTime() - 7 * 864e5);
  const [today, monthRecords, monthPurchases, earlierPending, oldest, pendingOver7Days, lastBackup, cfg] = await Promise.all([
    DailyBusiness.findOne({ date }),
    fetchRecords(from, to),
    purchaseCounters(from, to),
    Purchase.countDocuments({ status: 'PENDING', date: { $lt: from } }),
    Purchase.findOne({ status: 'PENDING' }).sort({ date: 1 }).select('date'),
    Purchase.countDocuments({ status: 'PENDING', date: { $lt: weekAgo } }),
    Backup.findOne().sort({ createdAt: -1 }).select('createdAt'),
    Settings.findOne({ key: 'main' }),
  ]);
  const purchases = { ...monthPurchases, earlierPending };
  maybeAutoBackup().catch((e) => console.warn('Auto backup skipped:', e.message));
  res.json({
    date: toDateStr(date), today, month, monthTotals: totalsOf(monthRecords), purchases,
    settings: { monthlyOrderTarget: cfg?.monthlyOrderTarget || 0, returnRateAlert: cfg?.returnRateAlert || 0 },
    checklist: { oldestPending: oldest ? toDateStr(oldest.date) : null, pendingOver7Days, lastBackupAt: lastBackup?.createdAt || null },
  });
});
