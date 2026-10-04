import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    name: { type: String, default: 'Admin', trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true }
);
export default mongoose.model('User', schema);
