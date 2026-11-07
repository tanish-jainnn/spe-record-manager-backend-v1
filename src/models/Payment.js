import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', required: true, index: true },
    date: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    method: { type: String, enum: ['CASH', 'PAYTM', 'UPI', 'BANK', 'CHEQUE', 'OTHER'], default: 'OTHER' }, // 'OTHER' = payments saved before methods existed
    note: { type: String, default: '', maxlength: 300 },
  },
  { timestamps: true }
);
schema.set('toJSON', { transform: (_d, r) => { r.date = new Date(r.date).toISOString().slice(0, 10); delete r.__v; return r; } });
export default mongoose.model('Payment', schema);
