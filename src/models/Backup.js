import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['auto', 'manual'], required: true },
    dailyCount: Number,
    purchaseCount: Number,
    size: Number,
    json: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
export default mongoose.model('Backup', schema);
