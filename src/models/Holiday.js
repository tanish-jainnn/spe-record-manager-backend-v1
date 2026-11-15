import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    from: { type: Date, required: true, index: true },
    to: { type: Date, required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
  },
  { timestamps: true }
);
schema.set('toJSON', { transform: (_d, r) => { r.from = new Date(r.from).toISOString().slice(0, 10); r.to = new Date(r.to).toISOString().slice(0, 10); delete r.__v; return r; } });
export default mongoose.model('Holiday', schema);
