import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';
import { AppError, asyncHandler } from '../utils/AppError.js';

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw new AppError('Please sign in to continue.', 401);
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new AppError('Your session has expired. Please sign in again.', 401);
  }
  const user = await User.findById(payload.sub).lean();
  if (!user) throw new AppError('Account not found. Please sign in again.', 401);
  req.user = { id: String(user._id), email: user.email, name: user.name };
  next();
});
