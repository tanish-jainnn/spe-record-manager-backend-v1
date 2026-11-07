import { asyncHandler, AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';
import { getSettingsDoc } from './settingsController.js';
import { sendSummary, tokenOk } from '../services/summaryService.js';
import { logActivity } from '../services/activity.js';

const recipient = async (req) => {
  const s = await getSettingsDoc();
  const to = s.summaryEmail || env.mailTo || req?.user?.email || env.adminEmail;
  if (!to) throw new AppError('Add an email address in Settings first.');
  return { to, settings: s };
};

export const sendNow = asyncHandler(async (req, res) => {
  const { to } = await recipient(req);
  try { await sendSummary(to); } catch (e) { if (e instanceof AppError) throw e; console.error(e); throw new AppError(`The email could not be sent: ${e.message}`, 502); }
  logActivity('summary.send', `Sent the daily summary to ${to}`);
  res.json({ message: `Sent to ${to}.` });
});

/** Called by an outside scheduler (e.g. cron-job.org) every evening. */
export const cron = asyncHandler(async (req, res) => {
  if (!env.cronSecret) throw new AppError('Not found.', 404);
  if (!tokenOk(req.query.token)) throw new AppError('Not allowed.', 403);
  const { to, settings } = await recipient();
  if (!settings.summaryEmailEnabled) return res.json({ skipped: true, reason: 'Daily summary email is switched off in Settings.' });
  await sendSummary(to);
  logActivity('summary.send', `Sent the scheduled daily summary to ${to}`);
  return res.json({ sent: true });
});
