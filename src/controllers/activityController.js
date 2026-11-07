import mongoose from 'mongoose';
import ActivityLog from '../models/ActivityLog.js';
import { asyncHandler } from '../utils/AppError.js';

export const listActivity = asyncHandler(async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
  const f = mongoose.isValidObjectId(req.query.before) ? { _id: { $lt: req.query.before } } : {};
  const items = await ActivityLog.find(f).sort({ _id: -1 }).limit(limit + 1);
  res.json({ items: items.slice(0, limit), hasMore: items.length > limit });
});
