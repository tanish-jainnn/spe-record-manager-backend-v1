import Settings from '../models/Settings.js';
import { asyncHandler, AppError } from '../utils/AppError.js';
import { cleanStr } from '../utils/validate.js';

const get = async () => (await Settings.findOne({ key: 'main' })) || (await Settings.create({ key: 'main' }));
export { get as getSettingsDoc };

export const getSettings = asyncHandler(async (_req, res) => res.json({ settings: await get() }));

export const saveSettings = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const data = {};
  if (b.businessName !== undefined) { data.businessName = cleanStr(b.businessName, 120); if (!data.businessName) throw new AppError('Business name cannot be empty.'); }
  if (b.gstin !== undefined) data.gstin = cleanStr(b.gstin, 20).toUpperCase();
  if (b.address !== undefined) data.address = cleanStr(b.address, 400);
  if (b.phone !== undefined) data.phone = cleanStr(b.phone, 30);
  if (b.defaultExportFormat !== undefined) {
    if (!['csv', 'xlsx'].includes(b.defaultExportFormat)) throw new AppError('Export format must be csv or xlsx.');
    data.defaultExportFormat = b.defaultExportFormat;
  }
  await get();
  res.json({ settings: await Settings.findOneAndUpdate({ key: 'main' }, { $set: data }, { new: true, runValidators: true }) });
});
