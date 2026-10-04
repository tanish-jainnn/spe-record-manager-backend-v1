import { PDFDocument } from 'pdf-lib';
import { AppError } from '../../../utils/AppError.js';

export async function loadPdf(buffer, name = 'PDF') {
  try {
    return await PDFDocument.load(buffer, { updateMetadata: false });
  } catch (e) {
    const enc = /encrypt/i.test(e.message);
    throw new AppError(enc ? `"${name}" is password-protected and cannot be processed.` : `"${name}" is corrupt or not supported.`, 422);
  }
}

export async function newDocWithPages(srcDoc, indexes) {
  const out = await PDFDocument.create();
  const pages = await out.copyPages(srcDoc, indexes);
  pages.forEach((p) => out.addPage(p));
  return out;
}

export const save = async (doc) => Buffer.from(await doc.save());
