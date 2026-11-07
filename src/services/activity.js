import ActivityLog from '../models/ActivityLog.js';

/** Records what changed. Never blocks or breaks the request it belongs to. */
export const logActivity = (action, summary) => {
  ActivityLog.create({ action, summary: String(summary).slice(0, 300) }).catch(() => {});
};
