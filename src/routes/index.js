import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { uploadOne, uploadMany, requirePdfs } from '../middleware/upload.js';
import * as auth from '../controllers/authController.js';
import * as daily from '../controllers/dailyController.js';
import * as dash from '../controllers/dashboardController.js';
import * as reports from '../controllers/reportController.js';
import * as purchases from '../controllers/purchaseController.js';
import * as presets from '../controllers/presetController.js';
import * as settings from '../controllers/settingsController.js';
import * as pdf from '../controllers/pdfController.js';
import * as exp from '../controllers/exportController.js';

const r = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many sign-in attempts. Please try again in 15 minutes.' } });
r.post('/auth/login', loginLimiter, auth.login);

// Everything below requires the single logged-in user.
r.use(requireAuth);
r.get('/auth/me', auth.me);
r.post('/auth/change-password', auth.changePassword);

r.get('/dashboard', dash.dashboard);

r.get('/daily/range', daily.rangeDays);
r.get('/daily', daily.getDay);
r.post('/daily', daily.saveDay);

r.get('/reports/month', reports.monthReport);
r.get('/reports/range', reports.rangeReport);

r.get('/purchases/summary', purchases.purchaseSummary);
r.get('/purchases', purchases.listPurchases);
r.post('/purchases', purchases.createPurchase);
r.patch('/purchases/:id', purchases.updatePurchase);
r.delete('/purchases/:id', purchases.deletePurchase);

r.get('/label-presets', presets.listPresets);
r.put('/label-presets/:marketplace', presets.savePreset);

r.get('/settings', settings.getSettings);
r.put('/settings', settings.saveSettings);

r.post('/pdf/flipkart/crop', uploadOne, requirePdfs, pdf.flipkartCrop);
r.post('/pdf/snapdeal/crop', uploadOne, requirePdfs, pdf.snapdealCrop);
r.post('/pdf/amazon/remove-pages', uploadOne, requirePdfs, pdf.amazonRemove);
r.post('/pdf/merge', uploadMany, requirePdfs, pdf.merge);
r.post('/pdf/split', uploadOne, requirePdfs, pdf.split);
r.post('/pdf/remove-pages', uploadOne, requirePdfs, pdf.removeGeneral);
r.post('/pdf/reorder', uploadOne, requirePdfs, pdf.reorder);
r.get('/pdf/history', pdf.history);

r.get('/export/daily', exp.exportDaily);
r.get('/export/report', exp.exportReport);
r.get('/export/purchases', exp.exportPurchases);
r.get('/export/backup', exp.backup);

export default r;
