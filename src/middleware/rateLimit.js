import rateLimit from 'express-rate-limit';

// RATE_LIMIT_DISABLED=true only works in an explicitly identified non-production environment
// (NODE_ENV=test or NODE_ENV=loadtest, e.g. for k6). In any other environment, including production, it is ignored.
const DISABLE_ALLOWED_ENVS = ['test', 'loadtest'];

export const isRateLimitDisabled = () =>
  process.env.RATE_LIMIT_DISABLED === 'true' && DISABLE_ALLOWED_ENVS.includes(process.env.NODE_ENV);

// 10 attempts per IP per 15 minutes on the login route, then HTTP 429.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isRateLimitDisabled,
  message: { success: false, error: 'Too many login attempts, please try again in 15 minutes' }
});
