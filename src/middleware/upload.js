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
