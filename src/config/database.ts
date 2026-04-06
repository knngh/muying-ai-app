import { PrismaClient } from '@prisma/client';
import { env } from './env';

const isTestEnv = env.NODE_ENV === 'test' || typeof process.env.JEST_WORKER_ID !== 'undefined';

/**
 * 数据库配置优化（全局单例）
 * - 连接池管理
 * - 日志级别控制
 * - 连接超时设置
 */
const prisma = new PrismaClient({
  log: env.isDev
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
  // 数据源配置在 DATABASE_URL 中设置
  // 例如: mysql://user:pass@host:3306/db?connection_limit=20&pool_timeout=30
});

// 连接池状态监控（仅开发环境）
if (env.isDev && !isTestEnv) {
  setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      console.error('[Database] Connection check failed:', error);
    }
  }, 60000); // 每分钟检查一次
}

// 优雅关闭连接
process.on('beforeExit', async () => {
  console.log('[Database] Closing connection...');
  await prisma.$disconnect();
});

export default prisma;
