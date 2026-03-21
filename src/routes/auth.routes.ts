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
import { authRateLimiter, writeRateLimiter, queryRateLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

// 公开路由 - 认证（严格限流，防止暴力破解）
router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/wechat-login', authRateLimiter, wechatLogin);
router.post('/refresh', authRateLimiter, refreshToken);

// 公开路由 - 检查可用性
router.get('/check/username', queryRateLimiter, checkUsername);
router.get('/check/phone', queryRateLimiter, checkPhone);

// 需要认证的路由
router.get('/me', authMiddleware, getMe);
router.put('/profile', authMiddleware, writeRateLimiter, updateProfile);
router.put('/password', authMiddleware, writeRateLimiter, changePassword);
router.post('/logout', authMiddleware, logout);

export default router;