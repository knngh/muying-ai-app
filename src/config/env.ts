import dotenv from 'dotenv';

// 确保在最早期加载
dotenv.config();

const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL'] as const;

export function validateEnv(): void {
  const missing = REQUIRED_ENV.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[启动失败] 缺少必需环境变量: ${missing.join(', ')}`);
    console.error('请参考 .env.example 配置环境变量');
    process.exit(1);
  }
}

export const env = {
  get JWT_SECRET(): string {
    return process.env.JWT_SECRET!;
  },
  get JWT_EXPIRES_IN(): string {
    return process.env.JWT_EXPIRES_IN || '7d';
  },
  get DATABASE_URL(): string {
    return process.env.DATABASE_URL!;
  },
  get PORT(): number {
    return Number(process.env.PORT) || 3000;
  },
  get HOST(): string {
    return process.env.HOST || 'localhost';
  },
  get NODE_ENV(): string {
    return process.env.NODE_ENV || 'development';
  },
  get CORS_ORIGIN(): string {
    return process.env.CORS_ORIGIN || 'http://localhost:5173';
  },
  get isDev(): boolean {
    return this.NODE_ENV === 'development';
  },
  get isProd(): boolean {
    return this.NODE_ENV === 'production';
  },
} as const;
