import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { uploadOne, uploadMany, requirePdfs, uploadBill, requireBillFile, uploadSheet } from '../middleware/upload.js';
import * as auth from '../controllers/authController.js';
import * as daily from '../controllers/dailyController.js';
import * as dash from '../controllers/dashboardController.js';
import * as reports from '../controllers/reportController.js';
import * as purchases from '../controllers/purchaseController.js';
import * as presets from '../controllers/presetController.js';
import * as settings from '../controllers/settingsController.js';
import * as pdf from '../controllers/pdfController.js';
import * as exp from '../controllers/exportController.js';
import * as att from '../controllers/attachmentController.js';
import * as backups from '../controllers/backupController.js';
import * as imp from '../controllers/importController.js';
import * as pay from '../controllers/paymentController.js';
import * as courier from '../controllers/courierController.js';
import * as searchC from '../controllers/searchController.js';
import * as activity from '../controllers/activityController.js';
import * as summary from '../controllers/summaryController.js';

const r = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many sign-in attempts. Please try again in 15 minutes.' } });
r.post('/auth/login', loginLimiter, auth.login);

const cronLimiter = rateLimit({ windowMs: 60 * 1000, limit: 6, standardHeaders: true, legacyHeaders: false });
r.all('/cron/daily-summary', cronLimiter, summary.cron); // protected by CRON_SECRET, used by an outside scheduler

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
r.get('/reports/summary', reports.monthSummary);

r.get('/purchases/summary', purchases.purchaseSummary);
r.get('/purchases', purchases.listPurchases);
r.post('/purchases', purchases.createPurchase);
r.patch('/purchases/:id', purchases.updatePurchase);
r.delete('/purchases/:id', purchases.deletePurchase);
r.get('/purchases/:id/payments', pay.listPayments);
r.post('/purchases/:id/payments', pay.addPayment);
r.delete('/purchases/:id/payments/:pid', pay.deletePayment);
r.put('/purchases/:id/attachment', uploadBill, requireBillFile, att.putAttachment);
r.get('/purchases/:id/attachment', att.getAttachment);
r.delete('/purchases/:id/attachment', att.removeAttachment);

r.get('/couriers/entries', courier.listEntries);
r.post('/couriers/entries', courier.addEntry);
r.delete('/couriers/entries/:id', courier.deleteEntry);
r.get('/couriers/report', courier.report);
r.get('/couriers/names', courier.names);

r.get('/search', searchC.search);
r.get('/activity', activity.listActivity);
r.post('/summary/send', summary.sendNow);

r.get('/label-presets', presets.listPresets);
r.put('/label-presets/:marketplace', presets.savePreset);

r.get('/settings', settings.getSettings);
r.put('/settings', settings.saveSettings);

r.post('/pdf/flipkart/crop', uploadOne, requirePdfs, pdf.flipkartCrop);
r.post('/pdf/snapdeal/crop', uploadOne, requirePdfs, pdf.snapdealCrop);
r.post('/pdf/meesho/crop', uploadOne, requirePdfs, pdf.meeshoCrop);
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
r.get('/export/couriers', exp.exportCouriers);

r.get('/backups', backups.listBackups);
r.post('/backups', backups.createBackup);
r.get('/backups/:id/download', backups.downloadBackup);

r.get('/import/template', imp.template);
r.post('/import/daily', uploadSheet, imp.importDaily);
r.post('/import/purchases', uploadSheet, imp.importPurchases);

export default r;
