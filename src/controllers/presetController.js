import LabelPreset from '../models/LabelPreset.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { cleanStr } from '../utils/validate.js';

// Starting values only. Calibrate with a real label in Settings / Label Manager.
export const DEFAULTS = {
  FLIPKART: { presetName: 'Flipkart label', x: 0, y: 420, width: 595, height: 422 },
  SNAPDEAL: { presetName: 'Snapdeal label', x: 0, y: 420, width: 595, height: 422 },
};
const key = (m) => {
  const k = String(m || '').toUpperCase();
  if (!DEFAULTS[k]) throw new AppError('Marketplace must be FLIPKART or SNAPDEAL.', 400);
  return k;
};
export async function getPreset(marketplace) {
  const k = key(marketplace);
  return (await LabelPreset.findOne({ marketplace: k })) || (await LabelPreset.create({ marketplace: k, ...DEFAULTS[k] }));
}

export const listPresets = asyncHandler(async (_req, res) => {
  const presets = await Promise.all(['FLIPKART', 'SNAPDEAL'].map(getPreset));
  res.json({ presets });
});

export const savePreset = asyncHandler(async (req, res) => {
  const k = key(req.params.marketplace);
  const b = req.body || {};
  const num = (v, label, min) => {
    const n = Number(v);
    if (v === '' || v === null || !Number.isFinite(n) || n < min || n > 20000) throw new AppError(`${label} must be a number${min > 0 ? ' above 0' : ' (0 or more)'}.`);
    return n;
  };
  const data = { presetName: cleanStr(b.presetName, 80) || DEFAULTS[k].presetName, x: num(b.x, 'X', 0), y: num(b.y, 'Y', 0), width: num(b.width, 'Width', 1), height: num(b.height, 'Height', 1) };
  const preset = await LabelPreset.findOneAndUpdate({ marketplace: k }, { $set: data }, { upsert: true, new: true, runValidators: true });
  res.json({ preset });
});
