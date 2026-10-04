import { loadPdf, newDocWithPages, save } from '../common/loadPdf.js';
import { parseOrder } from '../../../utils/pageRanges.js';

export async function reorderPdf(buffer, orderInput, name) {
  const src = await loadPdf(buffer, name);
  const total = src.getPageCount();
  const order = parseOrder(orderInput, total);
  return { buffer: await save(await newDocWithPages(src, order)), pagesIn: total, pagesOut: total };
}
