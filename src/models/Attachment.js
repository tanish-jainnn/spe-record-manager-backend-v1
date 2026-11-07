import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', required: true, unique: true },
    name: String,
    mime: String,
    size: Number,
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);
export default mongoose.model('Attachment', schema);
