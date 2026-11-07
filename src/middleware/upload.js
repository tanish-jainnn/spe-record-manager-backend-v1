import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const upload = multer({
  storage: multer.memoryStorage(), // processed in memory: nothing is written to the server disk, originals are never modified
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 30 },
  fileFilter: (_req, file, cb) => {
    const okName = /\.pdf$/i.test(file.originalname || '');
    const okType = file.mimetype === 'application/pdf' || file.mimetype === 'application/octet-stream';
    cb(okName && okType ? null : new AppError('Only PDF files are accepted.'), okName && okType);
  },
});

export const uploadOne = upload.single('file');
export const uploadMany = upload.array('files', 30);

/** Checks the real file signature, not just the name/mime sent by the browser. */
export function requirePdfs(req, _res, next) {
  const files = req.files || (req.file ? [req.file] : []);
  if (!files.length) return next(new AppError('Please choose a PDF file.'));
  for (const f of files) {
    if (!f.buffer?.length || f.buffer.subarray(0, 1024).indexOf('%PDF-') === -1) {
      return next(new AppError(`"${f.originalname}" is not a valid PDF file.`, 422));
    }
  }
  next();
}

// ---- Bill attachments (photo or PDF, up to 5 MB) ----
const bill = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype) ? null : new AppError('Attach a JPG, PNG, WebP or PDF file.'), true),
});
export const uploadBill = bill.single('file');
export function requireBillFile(req, _res, next) {
  const b = req.file?.buffer;
  if (!b) return next(new AppError('Please choose a file.'));
  const ok = b.subarray(0, 5).toString() === '%PDF-' || (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) || (b[0] === 0x89 && b.subarray(1, 4).toString() === 'PNG') || (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP');
  return ok ? next() : next(new AppError('That file does not look like a real JPG, PNG, WebP or PDF.', 422));
}

// ---- Spreadsheet import (.xlsx / .csv, up to 5 MB) ----
const sheet = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(/\.(xlsx|csv)$/i.test(file.originalname || '') ? null : new AppError('Upload an .xlsx or .csv file.'), true),
});
export const uploadSheet = sheet.single('file');
