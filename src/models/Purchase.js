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
  },
  { timestamps: true }
);
schema.index({ date: -1 });
schema.index({ supplier: 1, status: 1 });
schema.set('toJSON', {
  transform: (_d, ret) => {
    ret.date = new Date(ret.date).toISOString().slice(0, 10);
    delete ret.__v;
    return ret;
  },
});
export default mongoose.model('Purchase', schema);
