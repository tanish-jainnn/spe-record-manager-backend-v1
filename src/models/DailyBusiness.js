import mongoose from 'mongoose';

const count = { type: Number, required: true, min: 0, default: 0, validate: { validator: Number.isInteger, message: '{PATH} must be a whole number' } };
export const PLATFORMS = ['amazon', 'flipkart', 'meesho', 'snapdeal'];

const fields = {
  date: { type: Date, required: true, unique: true }, // UTC midnight => one record per calendar date
  amazonOrders: count, flipkartOrders: count, meeshoOrders: count, snapdealOrders: count,
  returnsReceived: count, rtoReceived: count, // totals (always = sum of the platform fields when those are used)
};
PLATFORMS.forEach((p) => { fields[`${p}Returns`] = count; fields[`${p}Rto`] = count; });

const schema = new mongoose.Schema(fields, { timestamps: true });

schema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.date = new Date(ret.date).toISOString().slice(0, 10);
    PLATFORMS.forEach((p) => { ret[`${p}Returns`] ??= 0; ret[`${p}Rto`] ??= 0; });
    ret.totalOrders = ret.amazonOrders + ret.flipkartOrders + ret.meeshoOrders + ret.snapdealOrders;
    // Older records stored returns/RTO as one number; whatever is not split by platform is reported here.
    ret.unassignedReturns = Math.max(0, ret.returnsReceived - PLATFORMS.reduce((n, p) => n + ret[`${p}Returns`], 0));
    ret.unassignedRto = Math.max(0, ret.rtoReceived - PLATFORMS.reduce((n, p) => n + ret[`${p}Rto`], 0));
    delete ret.__v;
    return ret;
  },
});
export default mongoose.model('DailyBusiness', schema);
