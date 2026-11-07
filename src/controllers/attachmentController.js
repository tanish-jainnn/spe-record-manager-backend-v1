import { logActivity } from '../services/activity.js';
import mongoose from 'mongoose';
import path from 'node:path';
import Purchase from '../models/Purchase.js';
import Attachment from '../models/Attachment.js';
import { AppError, asyncHandler } from '../utils/AppError.js';

const check = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid purchase id.');
  const p = await Purchase.findById(id);
  if (!p) throw new AppError('Purchase not found.', 404);
  return p;
};
const safeName = (n) => path.basename(String(n || 'bill')).replace(/[^\w.\- ]+/g, '_').slice(0, 100);

export const putAttachment = asyncHandler(async (req, res) => {
  const p = await check(req.params.id);
  const f = req.file;
  const name = safeName(f.originalname);
  await Attachment.findOneAndUpdate({ purchase: p._id }, { name, mime: f.mimetype, size: f.size, data: f.buffer }, { upsert: true, new: true });
  p.attachmentName = name;
  await p.save();
  logActivity('purchase.attach', `Attached a file to bill ${p.billNumber} (${p.supplier})`);
  res.json({ purchase: p });
});

export const getAttachment = asyncHandler(async (req, res) => {
  const a = await Attachment.findOne({ purchase: req.params.id });
  if (!a) throw new AppError('No bill file attached.', 404);
  res.set({ 'Content-Type': a.mime, 'Content-Disposition': `inline; filename="${a.name}"`, 'Cache-Control': 'private, no-store' });
  res.send(a.data);
});

export const removeAttachment = asyncHandler(async (req, res) => {
  const p = await check(req.params.id);
  await Attachment.deleteOne({ purchase: p._id });
  p.attachmentName = '';
  await p.save();
  logActivity('purchase.detach', `Removed the file from bill ${p.billNumber} (${p.supplier})`);
  res.json({ purchase: p });
});
