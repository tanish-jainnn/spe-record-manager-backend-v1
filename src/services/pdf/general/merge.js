import { PDFDocument } from 'pdf-lib';
import { loadPdf, save } from '../common/loadPdf.js';
import { AppError } from '../../../utils/AppError.js';

export async function mergePdfs(files) {
  if (files.length < 2) throw new AppError('Select at least two PDF files to merge.');
  const out = await PDFDocument.create();
  let pagesIn = 0;
  for (const f of files) {
    const doc = await loadPdf(f.buffer, f.originalname);
    pagesIn += doc.getPageCount();
    (await out.copyPages(doc, doc.getPageIndices())).forEach((p) => out.addPage(p));
  }
  return { buffer: await save(out), pagesIn, pagesOut: out.getPageCount() };
}
