import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';

/**
 * 用户维度优先的 key 生成器：已登录用户按 userId 限流，未登录回退到 IP。
 * 避免同一 IP 下多个合法用户互相触发限流（办公室/校园网共享出口场景）。
 */
function userOrIpKeyGenerator(req: Request, res: any): string {
  const userId = (req as any).userId;
  if (userId) {
    return `user:${userId}`;
  }
  return `ip:${ipKeyGenerator(req.ip || '', 64)}`;
}

/**
 * 分类化限流策略
 * 不同类型的接口使用不同的限流配置
 */

// 通用限流：15分钟100次
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    code: 4001,
    message: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 认证接口限流：15分钟20次（更严格，防止暴力破解）
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    code: 4001,
    message: '登录请求过于频繁，请15分钟后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 搜索接口限流：1分钟30次（防止滥用搜索）
export const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    code: 4001,
    message: '搜索请求过于频繁，请1分钟后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 查询接口限流：1分钟100次（较宽松，用于文章/分类查询）
export const queryRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    code: 4001,
    message: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 写入接口限流：15分钟50次（用于点赞、收藏、创建事件）
export const writeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    code: 4001,
    message: '操作过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 信息检查限流：15分钟10次（防止用户枚举攻击）
export const checkRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    code: 4001,
    message: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 问答接口限流：1分钟10次（按用户维度，未登录回退 IP）
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    code: 4001,
    message: '请求次数已达上限，请1分钟后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
});
