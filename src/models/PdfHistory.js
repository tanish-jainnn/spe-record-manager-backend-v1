import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    fileName: String,
    tool: { type: String, required: true }, // flipkart | snapdeal | amazon | general
    operation: { type: String, required: true }, // crop | remove-pages | merge | split | reorder
    status: { type: String, enum: ['SUCCESS', 'FAILED'], required: true },
    pagesIn: Number,
    pagesOut: Number,
    error: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
schema.set('toJSON', { transform: (_d, r) => { delete r.__v; return r; } });
export default mongoose.model('PdfHistory', schema);
