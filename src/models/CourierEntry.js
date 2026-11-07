import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    date: { type: Date, required: true, index: true },
    courier: { type: String, required: true, trim: true, maxlength: 60 },
    courierKey: { type: String, required: true, index: true }, // lower-case, so "delhivery" and "Delhivery" count together
    platform: { type: String, enum: ['amazon', 'flipkart', 'meesho', 'snapdeal', 'other'], default: 'other' },
    type: { type: String, enum: ['RETURN', 'RTO'], required: true },
    count: { type: Number, required: true, min: 1, max: 100000, validate: { validator: Number.isInteger, message: 'count must be a whole number' } },
    note: { type: String, default: '', maxlength: 300 },
  },
  { timestamps: true }
);
schema.set('toJSON', { transform: (_d, r) => { r.date = new Date(r.date).toISOString().slice(0, 10); delete r.__v; delete r.courierKey; return r; } });
export default mongoose.model('CourierEntry', schema);
