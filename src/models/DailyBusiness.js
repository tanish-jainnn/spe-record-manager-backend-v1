import mongoose from 'mongoose';

const count = { type: Number, required: true, min: 0, default: 0, validate: { validator: Number.isInteger, message: '{PATH} must be a whole number' } };

const schema = new mongoose.Schema(
  {
    date: { type: Date, required: true, unique: true }, // stored at UTC midnight => one record per calendar date
    amazonOrders: count,
    flipkartOrders: count,
    meeshoOrders: count,
    snapdealOrders: count,
    returnsReceived: count,
    rtoReceived: count,
  },
  { timestamps: true }
);

schema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.date = new Date(ret.date).toISOString().slice(0, 10);
    ret.totalOrders = ret.amazonOrders + ret.flipkartOrders + ret.meeshoOrders + ret.snapdealOrders;
    delete ret.__v;
    return ret;
  },
});
export default mongoose.model('DailyBusiness', schema);
