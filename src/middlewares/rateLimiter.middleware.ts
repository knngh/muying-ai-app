import rateLimit from 'express-rate-limit';

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

// AI 接口限流：1分钟10次（AI查询消耗大）
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    code: 4001,
    message: 'AI查询次数已达上限，请1分钟后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});