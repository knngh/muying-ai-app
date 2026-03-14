import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 路由导入
import authRoutes from './routes/auth.routes';
import categoryRoutes from './routes/category.routes';
import articleRoutes from './routes/article.routes';
import tagRoutes from './routes/tag.routes';
import calendarRoutes from './routes/calendar.routes';
import vaccineRoutes from './routes/vaccine.routes';

// 中间件导入
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { rateLimiter } from './middlewares/rateLimiter.middleware';

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
app.use(compression()); // 响应压缩
app.use(express.json({ limit: '10mb' })); // JSON 解析
app.use(express.urlencoded({ extended: true })); // URL 编码解析

// 日志中间件
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// 请求限流
app.use(rateLimiter);

// ============================================
// API 路由
// ============================================
const API_PREFIX = '/api/v1';

// 健康检查
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 挂载路由
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/categories`, categoryRoutes);
app.use(`${API_PREFIX}/articles`, articleRoutes);
app.use(`${API_PREFIX}/tags`, tagRoutes);
app.use(`${API_PREFIX}/calendar`, calendarRoutes);
app.use(`${API_PREFIX}/vaccines`, vaccineRoutes);

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