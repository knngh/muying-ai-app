import { Router } from 'express';
import { register, login, getMe, refreshToken, updateProfile } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// 公开路由
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);

// 需要认证的路由
router.get('/me', authMiddleware, getMe);
router.put('/profile', authMiddleware, updateProfile);

export default router;