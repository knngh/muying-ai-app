import { z } from 'zod';

export const askQuestionBody = z.object({
  question: z.string().min(1, '请输入问题').max(2000, '问题过长'),
  context: z.string().max(5000).optional(),
  model: z.string().optional(),
});

export const chatBody = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(5000),
  })).min(1, '消息不能为空').max(50, '消息轮次过多'),
  model: z.string().optional(),
});

export const feedbackBody = z.object({
  qaId: z.string().min(1, '请提供问答 ID'),
  feedback: z.enum(['helpful', 'not_helpful', 'wrong']),
  comment: z.string().max(500).optional(),
});
