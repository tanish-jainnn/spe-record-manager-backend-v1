import 'dotenv/config';

const num = (v, d) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spe-record-manager',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((u) => u.trim().replace(/\/$/, '')).filter(Boolean),
  adminName: process.env.ADMIN_NAME || 'Tanish',
  adminEmail: (process.env.ADMIN_EMAIL || 'tanish@spe.com').trim().toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || '12345678',
  maxUploadMb: num(process.env.MAX_UPLOAD_MB, 50),
  timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  serveClient: process.env.SERVE_CLIENT === 'true',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: num(process.env.SMTP_PORT, 587),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  mailFrom: process.env.MAIL_FROM || '',
  mailTo: process.env.MAIL_TO || '',
  cronSecret: process.env.CRON_SECRET || '',
};

export function assertEnv() {
  if (!env.jwtSecret || env.jwtSecret.length < 16) {
    throw new Error('JWT_SECRET must be set in .env and be at least 16 characters long.');
  }
}
