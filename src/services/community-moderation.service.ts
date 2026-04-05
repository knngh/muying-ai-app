import { AppError, ErrorCodes } from '../middlewares/error.middleware';

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /(微信|v信|vx|加v|加微|私聊我|联系方式|二维码|扫码)/iu, message: '请勿发布引流或联系方式信息' },
  { pattern: /\b1\d{10}\b/u, message: '请勿发布手机号等联系方式' },
  { pattern: /(http:\/\/|https:\/\/|www\.)/iu, message: '请勿直接发布外部链接' },
  { pattern: /(代孕|包成功|借卵|供卵|包男孩|包女孩)/iu, message: '内容包含不允许发布的信息' },
  { pattern: /(刷单|兼职日结|加群)/iu, message: '内容包含明显广告或引流信息' },
];

function normalizeContent(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function analyzeCommunityContent(...parts: Array<string | undefined>) {
  const content = normalizeContent(parts.filter(Boolean).join(' '));
  if (!content) {
    return {
      content,
      blocked: false,
      message: null,
    };
  }

  const blocked = BLOCKED_PATTERNS.find(({ pattern }) => pattern.test(content));
  return {
    content,
    blocked: Boolean(blocked),
    message: blocked?.message ?? null,
  };
}

export function assertCommunityContentAllowed(...parts: Array<string | undefined>) {
  const analysis = analyzeCommunityContent(...parts);
  if (!analysis.content) {
    return;
  }

  if (analysis.blocked) {
    throw new AppError(analysis.message || '内容不允许发布', ErrorCodes.PARAM_ERROR, 400);
  }
}
