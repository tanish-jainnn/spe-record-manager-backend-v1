import { loadPdf, newDocWithPages, save } from '../common/loadPdf.js';
import { parsePages } from '../../../utils/pageRanges.js';
import { AppError } from '../../../utils/AppError.js';

/** Amazon: remove manually selected pages and return a new PDF. */
export async function removeAmazonPages(buffer, pagesInput, name) {
  const src = await loadPdf(buffer, name);
  const total = src.getPageCount();
  const remove = new Set(parsePages(pagesInput, total));
  const keep = src.getPageIndices().filter((i) => !remove.has(i));
  if (!keep.length) throw new AppError('You cannot remove every page of the PDF.');
  const out = await newDocWithPages(src, keep);
  return { buffer: await save(out), pagesIn: total, pagesOut: keep.length };
}
