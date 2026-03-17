import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

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

const app: Express = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// ============================================
// 基础中间件
// ============================================
app.use(helmet()); // 安全头部
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(compression({
  level: 6, // 压缩级别 (0-9)
  threshold: 1024 // 大于1KB才压缩
})); 
app.use(express.json({ limit: '10mb' })); // JSON 解析
app.use(express.urlencoded({ extended: true })); // URL 编码解析

// 日志中间件
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ============================================
// API 路由
// ============================================
const API_PREFIX = '/api/v1';

// 健康检查（增强版）
app.get('/health', (req: Request, res: Response) => {
  const cacheStats = cache.getStats();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
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
app.listen(Number(PORT), HOST, () => {
  console.log(`🚀 Server is running on http://${HOST}:${PORT}`);
  console.log(`📚 API docs available at http://${HOST}:${PORT}${API_PREFIX}`);
  console.log(`🏥 Health check at http://${HOST}:${PORT}/health`);
});

export default app;