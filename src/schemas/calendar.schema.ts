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

export const updateEventBody = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  eventType: z.string().optional(),
  eventDate: z.string().optional(),
  eventTime: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  isAllDay: z.boolean().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().nullable().optional(),
  reminderMinutes: z.coerce.number().int().min(0).optional(),
  reminderType: z.string().nullable().optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
});

export const dragEventBody = z.object({
  newDate: z.string().min(1, '请提供新日期'),
  newTime: z.string().optional(),
});

export const batchUpdateEventsBody = z.object({
  events: z.array(z.object({
    id: z.string().regex(/^\d+$/, '事件ID无效'),
    title: z.string().max(100).optional(),
    description: z.string().max(500).optional(),
    eventDate: z.string().optional(),
    eventTime: z.string().optional(),
    status: z.coerce.number().int().min(0).max(1).optional(),
  })).min(1, '请提供要更新的事件列表').max(50, '单次最多更新50个事件'),
});

export const batchDeleteEventsBody = z.object({
  ids: z.array(z.string().regex(/^\d+$/)).min(1, '请提供要删除的事件ID列表').max(50, '单次最多删除50个事件'),
});

export const getEventsQuery = z.object({
  startDate: z.string().min(1, '请提供开始日期'),
  endDate: z.string().min(1, '请提供结束日期'),
  type: z.string().optional(),
});

// 孕周待办进度
export const updateTodoProgressBody = z.object({
  week: z.coerce.number().int().min(1, '孕周最小为1').max(40, '孕周最大为40'),
  todoKey: z.string().min(1, '待办标识不能为空').max(100),
  completed: z.boolean(),
});

// 孕周记录
export const saveDiaryBody = z.object({
  week: z.coerce.number().int().min(1).max(40),
  content: z.string().min(1, '记录内容不能为空').max(500, '记录内容不能超过500字'),
});

// 自定义待办
export const createCustomTodoBody = z.object({
  week: z.coerce.number().int().min(1).max(40),
  content: z.string().min(1, '待办内容不能为空').max(200, '待办内容不能超过200字'),
});

export const updateCustomTodoBody = z.object({
  content: z.string().min(1, '待办内容不能为空').max(200, '待办内容不能超过200字'),
});
