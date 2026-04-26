import { z } from 'zod';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidDateOnly(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

const dateString = z.string()
  .regex(DATE_PATTERN, '日期格式无效，请使用 YYYY-MM-DD')
  .refine(isValidDateOnly, '日期格式无效');

const optionalDateString = z.union([dateString, z.literal('')]);
const nullableDateString = z.union([dateString, z.literal(''), z.null()]);
const timeString = z.string().regex(TIME_PATTERN, '时间格式无效，请使用 HH:mm');
const optionalTimeString = z.union([timeString, z.literal('')]);
const nullableTimeString = z.union([timeString, z.literal(''), z.null()]);
const weekQueryValue = z.coerce.number().int().min(1, '孕周最小为1').max(40, '孕周最大为40');

export const calendarEventIdParam = z.object({
  id: z.string().regex(/^\d+$/, '事件ID无效'),
});

export const customTodoIdParam = z.object({
  id: z.string().regex(/^\d+$/, '待办ID无效'),
});

export const diaryWeekParam = z.object({
  week: z.coerce.number().int().min(1, '孕周最小为1').max(40, '孕周最大为40'),
});

export const dayParam = z.object({
  date: dateString,
});

export const weekDateQuery = z.object({
  date: dateString.optional(),
});

export const weekQuery = z.object({
  week: weekQueryValue.optional(),
});

export const createEventBody = z.object({
  title: z.string().min(1, '标题不能为空').max(100, '标题最多100个字符'),
  description: z.string().max(500).optional(),
  eventType: z.string().min(1, '事件类型不能为空'),
  eventDate: dateString,
  eventTime: optionalTimeString.optional(),
  endDate: optionalDateString.optional(),
  endTime: optionalTimeString.optional(),
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
  eventDate: dateString.optional(),
  eventTime: nullableTimeString.optional(),
  endDate: nullableDateString.optional(),
  endTime: nullableTimeString.optional(),
  isAllDay: z.boolean().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().nullable().optional(),
  reminderMinutes: z.coerce.number().int().min(0).optional(),
  reminderType: z.string().nullable().optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
});

export const dragEventBody = z.object({
  newDate: dateString,
  newTime: optionalTimeString.optional(),
});

export const batchUpdateEventsBody = z.object({
  events: z.array(z.object({
    id: z.string().regex(/^\d+$/, '事件ID无效'),
    title: z.string().max(100).optional(),
    description: z.string().max(500).optional(),
    eventDate: dateString.optional(),
    eventTime: optionalTimeString.optional(),
    status: z.coerce.number().int().min(0).max(1).optional(),
  })).min(1, '请提供要更新的事件列表').max(50, '单次最多更新50个事件'),
});

export const batchDeleteEventsBody = z.object({
  ids: z.array(z.string().regex(/^\d+$/)).min(1, '请提供要删除的事件ID列表').max(50, '单次最多删除50个事件'),
});

export const getEventsQuery = z.object({
  startDate: dateString,
  endDate: dateString,
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
