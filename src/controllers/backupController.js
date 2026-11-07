import { logActivity } from '../services/activity.js';
import mongoose from 'mongoose';
import Backup from '../models/Backup.js';
import { snapshot } from '../services/backupService.js';
import { AppError, asyncHandler } from '../utils/AppError.js';

export const listBackups = asyncHandler(async (_req, res) => res.json({ backups: await Backup.find().sort({ createdAt: -1 }).select('-json') }));
export const createBackup = asyncHandler(async (_req, res) => {
  logActivity('backup.create', 'Made a manual backup');
  try { res.status(201).json({ backup: { ...(await snapshot('manual')).toObject(), json: undefined } }); } catch (e) { throw new AppError(e.message, 413); }
});
export const downloadBackup = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid backup id.');
  const b = await Backup.findById(req.params.id);
  if (!b) throw new AppError('Backup not found.', 404);
  res.set({ 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="spe-backup-${b.createdAt.toISOString().slice(0, 10)}.json"` });
  res.send(b.json);
});
