import path from 'node:path';
import PdfHistory from '../models/PdfHistory.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { getPreset } from './presetController.js';
import { cropFlipkart } from '../services/pdf/flipkart/cropFlipkart.js';
import { cropSnapdeal } from '../services/pdf/snapdeal/cropSnapdeal.js';
import { removeAmazonPages } from '../services/pdf/amazon/removeAmazonPages.js';
import { mergePdfs } from '../services/pdf/general/merge.js';
import { splitPdf } from '../services/pdf/general/split.js';
import { removePages } from '../services/pdf/general/removePages.js';
import { reorderPdf } from '../services/pdf/general/reorder.js';

const safeBase = (name = 'document') => path.basename(String(name)).replace(/\.pdf$/i, '').replace(/[^\w\- ]+/g, '_').trim().slice(0, 80) || 'document';

/** Wraps a processor: logs history, streams the new file back, never touches the original. */
const handle = (tool, operation, fn) =>
  asyncHandler(async (req, res) => {
    const first = (req.files && req.files[0]) || req.file;
    const fileName = first ? `${safeBase(first.originalname)}.pdf` : 'unknown.pdf';
    try {
      const r = await fn(req);
      PdfHistory.create({ fileName, tool, operation, status: 'SUCCESS', pagesIn: r.pagesIn, pagesOut: r.pagesOut }).catch(() => {});
      const isZip = Boolean(r.zip);
      res.set({
        'Content-Type': isZip ? 'application/zip' : 'application/pdf',
        'Content-Disposition': `attachment; filename="${r.outName}"`,
        'X-Page-Count': String(r.pagesOut),
        'Cache-Control': 'no-store',
      });
      res.send(r.buffer);
    } catch (e) {
      PdfHistory.create({ fileName, tool, operation, status: 'FAILED', error: String(e.message).slice(0, 300) }).catch(() => {});
      throw e;
    }
  });

const one = (req) => {
  if (!req.file) throw new AppError('Please choose a PDF file.');
  return { buf: req.file.buffer, name: req.file.originalname, base: safeBase(req.file.originalname) };
};

export const flipkartCrop = handle('flipkart', 'crop', async (req) => {
  const { buf, name, base } = one(req);
  const p = await getPreset('FLIPKART');
  const r = await cropFlipkart(buf, p, name);
  return { ...r, outName: `${base}-flipkart-cropped.pdf` };
});
export const snapdealCrop = handle('snapdeal', 'crop', async (req) => {
  const { buf, name, base } = one(req);
  const p = await getPreset('SNAPDEAL');
  const r = await cropSnapdeal(buf, p, name);
  return { ...r, outName: `${base}-snapdeal-cropped.pdf` };
});
export const amazonRemove = handle('amazon', 'remove-pages', async (req) => {
  const { buf, name, base } = one(req);
  const r = await removeAmazonPages(buf, req.body.pages, name);
  return { ...r, outName: `${base}-amazon-cleaned.pdf` };
});
export const merge = handle('general', 'merge', async (req) => {
  const r = await mergePdfs(req.files);
  return { ...r, outName: 'merged.pdf' };
});
export const split = handle('general', 'split', async (req) => {
  const { buf, name, base } = one(req);
  const r = await splitPdf(buf, req.body.ranges, base, name);
  return { ...r, zip: true, outName: `${base}-split.zip` };
});
export const removeGeneral = handle('general', 'remove-pages', async (req) => {
  const { buf, name, base } = one(req);
  const r = await removePages(buf, req.body.pages, name);
  return { ...r, outName: `${base}-pages-removed.pdf` };
});
export const reorder = handle('general', 'reorder', async (req) => {
  const { buf, name, base } = one(req);
  const r = await reorderPdf(buf, req.body.order, name);
  return { ...r, outName: `${base}-reordered.pdf` };
});

export const history = asyncHandler(async (_req, res) => res.json({ history: await PdfHistory.find().sort({ createdAt: -1 }).limit(50) }));
