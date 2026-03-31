import { Router } from 'express';
import {
  register,
  login,
  getMe,
  refreshToken,
  updateProfile,
  changePassword,
  logout,
  checkUsername,
  checkPhone
} from '../controllers/auth.controller';
import { wechatLogin } from '../controllers/wechat.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { authRateLimiter, writeRateLimiter, queryRateLimiter, checkRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validate } from '../middlewares/validate.middleware';
import { registerBody, loginBody, updateProfileBody, changePasswordBody, wechatLoginBody, checkUsernameQuery, checkPhoneQuery } from '../schemas/auth.schema';

const router = Router();

// 公开路由 - 认证（严格限流，防止暴力破解）
router.post('/register', authRateLimiter, validate({ body: registerBody }), register);
router.post('/login', authRateLimiter, validate({ body: loginBody }), login);
router.post('/wechat-login', authRateLimiter, validate({ body: wechatLoginBody }), wechatLogin);
router.post('/refresh', authRateLimiter, refreshToken);

// 公开路由 - 检查可用性（更严格限流，防止用户枚举）
router.get('/check/username', checkRateLimiter, validate({ query: checkUsernameQuery }), checkUsername);
router.get('/check/phone', checkRateLimiter, validate({ query: checkPhoneQuery }), checkPhone);

// 需要认证的路由
router.get('/me', authMiddleware, queryRateLimiter, getMe);
router.put('/profile', authMiddleware, writeRateLimiter, validate({ body: updateProfileBody }), updateProfile);
router.put('/password', authMiddleware, writeRateLimiter, validate({ body: changePasswordBody }), changePassword);
router.post('/logout', authMiddleware, writeRateLimiter, logout);

export default router;