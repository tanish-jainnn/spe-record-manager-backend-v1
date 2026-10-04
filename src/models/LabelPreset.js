import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    marketplace: { type: String, enum: ['FLIPKART', 'SNAPDEAL'], required: true, unique: true },
    presetName: { type: String, default: 'Default', trim: true, maxlength: 80 },
    x: { type: Number, required: true, min: 0 },
    y: { type: Number, required: true, min: 0 },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
);
schema.set('toJSON', { transform: (_d, r) => { delete r.__v; return r; } });
export default mongoose.model('LabelPreset', schema);
