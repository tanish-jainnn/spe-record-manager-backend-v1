import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    businessName: { type: String, default: 'SPE', trim: true, maxlength: 120 },
    gstin: { type: String, default: '', trim: true, maxlength: 20 },
    address: { type: String, default: '', trim: true, maxlength: 400 },
    phone: { type: String, default: '', trim: true, maxlength: 30 },
    monthlyOrderTarget: { type: Number, default: 0, min: 0 },
    returnRateAlert: { type: Number, default: 0, min: 0, max: 100 }, // % (returns + RTO) / orders; 0 = off
    profitPerOrder: { amazon: { type: Number, default: 0 }, flipkart: { type: Number, default: 0 }, meesho: { type: Number, default: 0 }, snapdeal: { type: Number, default: 0 } },
    lossPerReturn: { amazon: { type: Number, default: 0, min: 0 }, flipkart: { type: Number, default: 0, min: 0 }, meesho: { type: Number, default: 0, min: 0 }, snapdeal: { type: Number, default: 0, min: 0 } },
    summaryEmailEnabled: { type: Boolean, default: false },
    summaryEmail: { type: String, default: '', trim: true, maxlength: 160 },
    defaultExportFormat: { type: String, enum: ['csv', 'xlsx'], default: 'xlsx' },
  },
  { timestamps: true }
);
schema.set('toJSON', { transform: (_d, r) => { delete r.__v; delete r.key; return r; } });
export default mongoose.model('Settings', schema);
