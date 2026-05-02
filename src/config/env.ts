import dotenv from 'dotenv';

// 确保在最早期加载
dotenv.config();

const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL'] as const;

const AI_PROVIDER_KEYS = [
  'AI_GENERAL_KEY',
  'SILICONFLOW_API_KEY',
  'AI_KIMI_KEY',
  'AI_MINIMAX_KEY',
  'AI_GLM_KEY',
  'AI_MEDICAL_PRIMARY_KEY',
  'AI_GATEWAY_KEY',
] as const;

const JWT_SECRET_PLACEHOLDERS = new Set([
  'your-super-secret-jwt-key-change-in-production',
  'change-me',
  'secret',
]);
const JWT_SECRET_MIN_LENGTH = 32;

export function validateEnv(): void {
  const missing = REQUIRED_ENV.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[启动失败] 缺少必需环境变量: ${missing.join(', ')}`);
    console.error('请参考 .env.example 配置环境变量');
    process.exit(1);
  }

  // 生产环境对 JWT_SECRET 做强度校验，防止误用 .env.example 占位值
  if (process.env.NODE_ENV === 'production') {
    const secret = process.env.JWT_SECRET || '';
    if (JWT_SECRET_PLACEHOLDERS.has(secret) || secret.length < JWT_SECRET_MIN_LENGTH) {
      console.error(`[启动失败] 生产环境 JWT_SECRET 必须至少 ${JWT_SECRET_MIN_LENGTH} 字符且非示例占位值`);
      console.error('请使用强随机字符串，例如：openssl rand -base64 48');
      process.exit(1);
    }

    // PAYMENT_CALLBACK_ALLOW_AUTH_FALLBACK 在生产代码里已被 isDev 强制 false，
    // 但若 .env 误留了 true，给出显式启动警告便于运维察觉。
    if (process.env.PAYMENT_CALLBACK_ALLOW_AUTH_FALLBACK === 'true') {
      console.warn('[启动警告] 生产环境检测到 PAYMENT_CALLBACK_ALLOW_AUTH_FALLBACK=true，已被代码强制禁用');
      console.warn('  请从 .env / 部署配置中移除该项，避免接入真实支付网关后被误启用');
    }
  }

  // AI 配置校验：至少需要一个可用的 provider key，否则 AI 功能将降级到知识库兜底
  const hasAnyAiKey = AI_PROVIDER_KEYS.some(key => !!process.env[key]);
  if (!hasAnyAiKey) {
    console.warn('[启动警告] 未检测到任何 AI provider API key，AI 问答将使用知识库降级模式');
    console.warn('  可配置的 key：' + AI_PROVIDER_KEYS.join(' / '));
  }

  if (process.env.AI_ROUTING_ENABLED === 'true') {
    const missingRouteKeys: string[] = [];
    if (!process.env.AI_GLM_KEY && !process.env.AI_GATEWAY_KEY) missingRouteKeys.push('AI_GLM_KEY (分诊)');
    if (!process.env.AI_KIMI_KEY && !process.env.AI_GATEWAY_KEY) missingRouteKeys.push('AI_KIMI_KEY (推理)');
    if (!process.env.AI_MINIMAX_KEY && !process.env.AI_GATEWAY_KEY) missingRouteKeys.push('AI_MINIMAX_KEY (润色)');
    if (missingRouteKeys.length > 0) {
      console.warn('[启动警告] AI_ROUTING_ENABLED=true，但以下模型 key 未配置：');
      console.warn('  ' + missingRouteKeys.join(', '));
      console.warn('  未配置的链路将回退到 LEGACY_GATEWAY (AI_GATEWAY_KEY)');
    }
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
  get WECHAT_PAYMENT_CALLBACK_SECRET(): string {
    return process.env.WECHAT_PAYMENT_CALLBACK_SECRET || '';
  },
  get ALIPAY_PAYMENT_CALLBACK_SECRET(): string {
    return process.env.ALIPAY_PAYMENT_CALLBACK_SECRET || '';
  },
  get PAYMENT_CALLBACK_ALLOW_AUTH_FALLBACK(): boolean {
    return this.isDev && process.env.PAYMENT_CALLBACK_ALLOW_AUTH_FALLBACK === 'true';
  },
  get PAYMENT_CALLBACK_MAX_SKEW_SECONDS(): number {
    return Number(process.env.PAYMENT_CALLBACK_MAX_SKEW_SECONDS || 300);
  },
  get isDev(): boolean {
    return this.NODE_ENV === 'development';
  },
  get isProd(): boolean {
    return this.NODE_ENV === 'production';
  },
} as const;
