import { loadPdf, newDocWithPages, save } from '../common/loadPdf.js';
import { parsePages } from '../../../utils/pageRanges.js';
import { AppError } from '../../../utils/AppError.js';

export async function removePages(buffer, pagesInput, name) {
  const src = await loadPdf(buffer, name);
  const total = src.getPageCount();
  const remove = new Set(parsePages(pagesInput, total));
  const keep = src.getPageIndices().filter((i) => !remove.has(i));
  if (!keep.length) throw new AppError('You cannot remove every page of the PDF.');
  return { buffer: await save(await newDocWithPages(src, keep)), pagesIn: total, pagesOut: keep.length };
}
