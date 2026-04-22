import { z } from 'zod';

const clientRequestIdSchema = z.string()
  .trim()
  .min(8, '请求 ID 过短')
  .max(120, '请求 ID 过长')
  .regex(/^[A-Za-z0-9_-]+$/, '请求 ID 格式无效');

const contextSchema = z.union([
  z.string().max(5000),
  z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
]);

export const askQuestionBody = z.object({
  question: z.string().min(1, '请输入问题').max(2000, '问题过长'),
  context: contextSchema.optional(),
  conversationId: z.string().optional(),
  model: z.string().optional(),
  clientRequestId: clientRequestIdSchema.optional(),
});

export const chatBody = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(5000),
  })).min(1, '消息不能为空').max(50, '消息轮次过多'),
  context: contextSchema.optional(),
  conversationId: z.string().optional(),
  model: z.string().optional(),
  clientRequestId: clientRequestIdSchema.optional(),
});

export const feedbackBody = z.object({
  qaId: z.string().min(1, '请提供问答 ID'),
  feedback: z.enum(['helpful', 'not_helpful', 'wrong']),
  comment: z.string().max(500).optional(),
  messageId: z.string().max(120).optional(),
  conversationId: z.string().max(120).optional(),
  reason: z.enum(['missing_sources', 'too_generic', 'incorrect', 'unsafe', 'not_actionable', 'other']).optional(),
  actionTaken: z.enum(['none', 'added_to_calendar', 'opened_knowledge', 'opened_archive', 'went_to_hospital']).optional(),
  triageCategory: z.enum(['normal', 'caution', 'emergency', 'out_of_scope']).optional(),
  riskLevel: z.enum(['green', 'yellow', 'red']).optional(),
  sourceReliability: z.enum(['authoritative', 'mixed', 'medical_platform_only', 'dataset_only', 'none']).optional(),
  route: z.string().max(120).optional(),
  provider: z.string().max(120).optional(),
  model: z.string().max(120).optional(),
  entrySource: z.string().max(80).optional(),
  articleSlug: z.string().max(160).optional(),
  reportId: z.string().max(120).optional(),
});
