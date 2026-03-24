import { z } from 'zod';

export const createEventBody = z.object({
  title: z.string().min(1, '标题不能为空').max(100, '标题最多100个字符'),
  description: z.string().max(500).optional(),
  eventType: z.string().min(1, '事件类型不能为空'),
  eventDate: z.string().min(1, '日期不能为空'),
  eventTime: z.string().optional(),
  endDate: z.string().optional(),
  endTime: z.string().optional(),
  isAllDay: z.boolean().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().optional(),
  reminderMinutes: z.coerce.number().int().min(0).optional(),
  reminderType: z.string().optional(),
  relatedArticleId: z.string().regex(/^\d+$/).optional(),
  relatedVaccineId: z.string().regex(/^\d+$/).optional(),
});

export const getEventsQuery = z.object({
  startDate: z.string().min(1, '请提供开始日期'),
  endDate: z.string().min(1, '请提供结束日期'),
  type: z.string().optional(),
});
