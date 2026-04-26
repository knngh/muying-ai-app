import express, { Express, Request, Response } from 'express';
import { createServer } from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

// 环境变量校验（必须在所有业务模块之前）
import { validateEnv, env } from './config/env';
validateEnv();

// BigInt JSON 序列化支持（Prisma 使用 BigInt ID）
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

// 路由导入
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import categoryRoutes from './routes/category.routes';
import articleRoutes from './routes/article.routes';
import tagRoutes from './routes/tag.routes';
import calendarRoutes from './routes/calendar.routes';
import vaccineRoutes from './routes/vaccine.routes';
import aiRoutes from './routes/ai.routes';
import communityRoutes from './routes/community.routes';
import subscriptionRoutes from './routes/subscription.routes';
import paymentRoutes from './routes/payment.routes';
import quotaRoutes from './routes/quota.routes';
import reportRoutes from './routes/report.routes';
import analyticsRoutes from './routes/analytics.routes';
import checkinRoutes from './routes/checkin.routes';
import growthRoutes from './routes/growth.routes';

// 中间件导入
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { cache } from './services/cache.service';
import { setupWebSocket } from './services/websocket.service';
import prisma from './config/database';
import { maskSensitiveUrl } from './utils/logging';

const app: Express = express();
const PORT = env.PORT;
const HOST = env.HOST;
const isTestEnv = env.NODE_ENV === 'test' || typeof process.env.JEST_WORKER_ID !== 'undefined';

function buildCorsOrigin(origin: string): string | string[] {
  const origins = origin
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return origins.length > 1 ? origins : (origins[0] || origin);
}

// ============================================
// 基础中间件
// ============================================
app.set('trust proxy', 1);
app.use(helmet()); // 安全头部
app.use(cors({
  origin: buildCorsOrigin(env.CORS_ORIGIN),
  credentials: true
}));
app.use(compression({
  level: 6, // 压缩级别 (0-9)
  threshold: 1024 // 大于1KB才压缩
})); 
app.use(express.json({ limit: '1mb' })); // JSON 解析（收紧默认限制）
app.use(express.urlencoded({ extended: true, limit: '100kb', parameterLimit: 100 })); // URL 编码解析

// 日志中间件
morgan.token('safe-url', (req) => {
  const expressReq = req as Request;
  return maskSensitiveUrl(expressReq.originalUrl || req.url);
});
if (env.isDev) {
  app.use(morgan(':method :safe-url :status :response-time ms - :res[content-length]'));
} else {
  app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :safe-url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'));
}

// 静态文件 - 头像上传目录
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
  dotfiles: 'deny',
  fallthrough: false,
  index: false,
  immutable: true,
  maxAge: '7d',
}));

// ============================================
// API 路由
// ============================================
const API_PREFIX = '/api/v1';

// 健康检查（增强版 - 覆盖数据库和缓存状态）
app.get('/health', async (req: Request, res: Response) => {
  const cacheStats = cache.getStats();

  let dbStatus = 'unknown';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'ok';
  } catch {
    dbStatus = 'error';
  }

  const healthy = dbStatus === 'ok';
  const cachePayload: { keys: number; hitRate: string; memory?: string } = {
    keys: cacheStats.keys,
    hitRate: `${cache.getHitRate().toFixed(2)}%`,
  };

  if (!env.isProd) {
    cachePayload.memory = cacheStats.memoryUsage;
  }

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus,
    cache: cachePayload
  });
});

// 挂载路由
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/user`, userRoutes);
app.use(`${API_PREFIX}/categories`, categoryRoutes);
app.use(`${API_PREFIX}/articles`, articleRoutes);
app.use(`${API_PREFIX}/tags`, tagRoutes);
app.use(`${API_PREFIX}/calendar`, calendarRoutes);
app.use(`${API_PREFIX}/vaccines`, vaccineRoutes);
app.use(`${API_PREFIX}/ai`, aiRoutes);
app.use(`${API_PREFIX}/community`, communityRoutes);
app.use(`${API_PREFIX}/subscription`, subscriptionRoutes);
app.use(`${API_PREFIX}/payment`, paymentRoutes);
app.use(`${API_PREFIX}/quota`, quotaRoutes);
app.use(`${API_PREFIX}/report`, reportRoutes);
app.use(`${API_PREFIX}/analytics`, analyticsRoutes);
app.use(`${API_PREFIX}/checkin`, checkinRoutes);
app.use(`${API_PREFIX}/growth`, growthRoutes);

// ============================================
// 错误处理
// ============================================
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// 启动服务器
// ============================================
const server = createServer(app);

// 挂载 WebSocket 服务（供小程序和 App 使用）
setupWebSocket(server);

if (!isTestEnv) {
  server.listen(Number(PORT), HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
    console.log(`API prefix: ${API_PREFIX}`);
    console.log(`Health check at http://${HOST}:${PORT}/health`);
  });
}

// ============================================
// 优雅关机
// ============================================
async function gracefulShutdown(signal: string) {
  console.log(`\n收到 ${signal}，开始优雅关机...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('数据库连接已关闭');
    } catch (err) {
      console.error('关闭数据库连接失败:', err);
    }
    console.log('服务已停止');
    process.exit(0);
  });
  // 10 秒后强制退出
  setTimeout(() => {
    console.error('强制退出（超时）');
    process.exit(1);
  }, 10000);
}

if (!isTestEnv) {
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // 全局未捕获异常处理 — 防止进程静默崩溃
  process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的 Promise rejection:', reason);
    console.error('Promise:', promise);
  });

  process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
    // 给日志写入的时间，然后优雅退出
    gracefulShutdown('uncaughtException');
  });
}

export default app;
