import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  at: { type: Date, default: Date.now, index: { expires: '180d' } }, // old entries are removed automatically after ~6 months
  action: { type: String, required: true },
  summary: { type: String, required: true, maxlength: 300 },
});
schema.set('toJSON', { transform: (_d, r) => { delete r.__v; return r; } });
export default mongoose.model('ActivityLog', schema);
