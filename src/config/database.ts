import { PrismaClient } from '@prisma/client';

/**
 * 数据库配置优化
 * - 连接池管理
 * - 日志级别控制
 * - 连接超时设置
 */
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
  // 数据源配置在 DATABASE_URL 中设置
  // 例如: mysql://user:pass@host:3306/db?connection_limit=20&pool_timeout=30
});

// 连接池状态监控（仅开发环境）
if (process.env.NODE_ENV === 'development') {
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