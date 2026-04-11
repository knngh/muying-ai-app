/**
 * 轻量结构化日志工具 — 面向 AI 调用链路追踪。
 *
 * 设计目标：
 * - 不引入额外依赖，输出单行 JSON，方便 ELK/Loki 等工具采集
 * - 在开发环境回退为可读文本，减少噪音
 * - 不替换现有 console.log 调用，只在关键链路（AI 入口、模型调用、耗时汇总）新增使用
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogFields {
  [key: string]: unknown;
  component?: string;
  event?: string;
  userId?: string;
  requestId?: string;
  durationMs?: number;
  err?: unknown;
}

const isProd = process.env.NODE_ENV === 'production';

function serializeError(error: unknown): Record<string, unknown> | undefined {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: isProd ? undefined : error.stack,
    };
  }
  return { message: String(error) };
}

function emit(level: LogLevel, message: string, fields: LogFields = {}): void {
  const { err, ...rest } = fields;
  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...rest,
  };
  if (err !== undefined) {
    payload.err = serializeError(err);
  }

  const serialized = isProd
    ? JSON.stringify(payload)
    : `[${level}] ${message} ${Object.keys(rest).length ? JSON.stringify(rest) : ''}${err ? ' err=' + JSON.stringify(serializeError(err)) : ''}`;

  if (level === 'error') {
    console.error(serialized);
  } else if (level === 'warn') {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
}

export const logger = {
  debug(message: string, fields?: LogFields) {
    if (!isProd) emit('debug', message, fields);
  },
  info(message: string, fields?: LogFields) {
    emit('info', message, fields);
  },
  warn(message: string, fields?: LogFields) {
    emit('warn', message, fields);
  },
  error(message: string, fields?: LogFields) {
    emit('error', message, fields);
  },
};

/**
 * 生成简短 requestId（16 字符 hex），用于串联一次 AI 调用的日志。
 * 不需要加密安全，只需足够唯一。
 */
export function genRequestId(): string {
  return Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-8);
}
