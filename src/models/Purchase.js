import mongoose from 'mongoose';

const money = { type: Number, min: 0, default: 0 };
const schema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    supplier: { type: String, required: true, trim: true, maxlength: 200 },
    billNumber: { type: String, required: true, trim: true, maxlength: 100 },
    billType: { type: String, enum: ['GST', 'NON_GST'], required: true },
    taxableAmount: money,
    gstAmount: money,
    totalAmount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['RECEIVED', 'PENDING'], default: 'PENDING' },
    notes: { type: String, default: '', maxlength: 1000 },
    attachmentName: { type: String, default: '' },
    paidAmount: { type: Number, min: 0, default: 0 },
    supplierGstin: { type: String, default: '', trim: true, uppercase: true, maxlength: 15 },
    igstAmount: { type: Number, default: null }, // optional manual split; when empty it is worked out from the supplier GSTIN state
    cgstAmount: { type: Number, default: null },
    sgstAmount: { type: Number, default: null },
    inGstr2b: { type: Boolean, default: false }, // bill is visible in GSTR-2B / IMS
    itcMonth: { type: String, default: '' }, // 'YYYY-MM' = month in which the credit is claimed; '' = not claimed
  },
  { timestamps: true }
);
schema.index({ date: -1 });
schema.index({ supplier: 1, status: 1 });
schema.set('toJSON', {
  transform: (_d, ret) => {
    ret.date = new Date(ret.date).toISOString().slice(0, 10);
    ret.hasAttachment = Boolean(ret.attachmentName);
    ret.paidAmount = ret.paidAmount ?? 0;
    ret.dueAmount = Math.max(0, Math.round((ret.totalAmount - ret.paidAmount) * 100) / 100);
    delete ret.__v;
    return ret;
  },
});
export default mongoose.model('Purchase', schema);
