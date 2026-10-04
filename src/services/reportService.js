import DailyBusiness from '../models/DailyBusiness.js';
import Purchase from '../models/Purchase.js';

const PLATFORMS = ['amazon', 'flipkart', 'meesho', 'snapdeal'];

export const emptyTotals = () => ({ amazon: 0, flipkart: 0, meesho: 0, snapdeal: 0, totalOrders: 0, returns: 0, rto: 0, days: 0 });

export function addRecord(t, r) {
  t.amazon += r.amazonOrders;
  t.flipkart += r.flipkartOrders;
  t.meesho += r.meeshoOrders;
  t.snapdeal += r.snapdealOrders;
  t.totalOrders += r.amazonOrders + r.flipkartOrders + r.meeshoOrders + r.snapdealOrders;
  t.returns += r.returnsReceived;
  t.rto += r.rtoReceived;
  t.days += 1;
  return t;
}

export const fetchRecords = (from, to) => DailyBusiness.find({ date: { $gte: from, $lte: to } }).sort({ date: 1 }).lean();
export const totalsOf = (records) => records.reduce(addRecord, emptyTotals());

const mondayOf = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

/** group = day | week | month */
export function groupRecords(records, group) {
  const map = new Map();
  for (const r of records) {
    const iso = r.date.toISOString().slice(0, 10);
    const key = group === 'month' ? iso.slice(0, 7) : group === 'week' ? mondayOf(iso) : iso;
    if (!map.has(key)) map.set(key, emptyTotals());
    addRecord(map.get(key), r);
  }
  return [...map.entries()].map(([period, t]) => ({ period, ...t }));
}

export async function purchaseCounters() {
  const [row] = await Purchase.aggregate([
    {
      $group: {
        _id: null,
        gstReceived: { $sum: { $cond: [{ $and: [{ $eq: ['$billType', 'GST'] }, { $eq: ['$status', 'RECEIVED'] }] }, 1, 0] } },
        nonGstReceived: { $sum: { $cond: [{ $and: [{ $eq: ['$billType', 'NON_GST'] }, { $eq: ['$status', 'RECEIVED'] }] }, 1, 0] } },
        totalBills: { $sum: 1 },
        pendingBills: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
      },
    },
  ]);
  return { gstReceived: row?.gstReceived || 0, nonGstReceived: row?.nonGstReceived || 0, totalBills: row?.totalBills || 0, pendingBills: row?.pendingBills || 0 };
}

export const supplierSummary = () =>
  Purchase.aggregate([
    {
      $group: {
        _id: '$supplier',
        totalBills: { $sum: 1 },
        receivedBills: { $sum: { $cond: [{ $eq: ['$status', 'RECEIVED'] }, 1, 0] } },
        pendingBills: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
        pendingAmount: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, '$totalAmount', 0] } },
      },
    },
    { $project: { _id: 0, supplier: '$_id', totalBills: 1, receivedBills: 1, pendingBills: 1, pendingAmount: 1 } },
    { $sort: { pendingBills: -1, supplier: 1 } },
  ]);

export { PLATFORMS };
