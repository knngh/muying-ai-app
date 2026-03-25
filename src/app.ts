import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
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

// 中间件导入
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { cache } from './services/cache.service';
import { setupWebSocket } from './services/websocket.service';
import prisma from './config/database';

const app: Express = express();
const PORT = env.PORT;
const HOST = env.HOST;
const isTestEnv = env.NODE_ENV === 'test' || typeof process.env.JEST_WORKER_ID !== 'undefined';

// ============================================
// 基础中间件
// ============================================
app.use(helmet()); // 安全头部
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true
}));
app.use(compression({
  level: 6, // 压缩级别 (0-9)
  threshold: 1024 // 大于1KB才压缩
})); 
app.use(express.json({ limit: '1mb' })); // JSON 解析（收紧默认限制）
app.use(express.urlencoded({ extended: true })); // URL 编码解析

// 日志中间件
if (env.isDev) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

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

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus,
    cache: {
      keys: cacheStats.keys,
      hitRate: `${cache.getHitRate().toFixed(2)}%`,
      memory: cacheStats.memoryUsage
    }
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
}

export default app;
