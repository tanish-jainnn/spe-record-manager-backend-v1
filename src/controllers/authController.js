import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { AppError, asyncHandler } from '../utils/AppError.js';

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);
const sign = (user) => jwt.sign({ sub: String(user._id) }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
const publicUser = (u) => ({ id: String(u._id), name: u.name, email: u.email });

/** Single-user app: creates the one account from .env only if no user exists yet. */
export async function ensureAdmin() {
  if (await User.exists({})) return;
  if (!env.adminEmail || env.adminPassword.length < 8) {
    console.warn('No user exists. Set ADMIN_EMAIL and ADMIN_PASSWORD (min 8 chars) in .env, then restart.');
    return;
  }
  await User.create({ name: env.adminName, email: env.adminEmail, passwordHash: await bcrypt.hash(env.adminPassword, 12) });
  console.log(`Admin account created for ${env.adminEmail}`);
}

export const login = asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = email ? await User.findOne({ email }).select('+passwordHash') : null;
  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !ok) throw new AppError('Incorrect email or password.', 401);
  res.json({ token: sign(user), user: publicUser(user) });
});

export const me = asyncHandler(async (req, res) => res.json({ user: req.user }));

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword = '', newPassword = '' } = req.body || {};
  if (newPassword.length < 8) throw new AppError('New password must be at least 8 characters.');
  const user = await User.findById(req.user.id).select('+passwordHash');
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new AppError('Current password is incorrect.', 400);
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  res.json({ message: 'Password updated.' });
});
