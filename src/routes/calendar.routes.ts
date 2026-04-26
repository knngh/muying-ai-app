import { Router } from 'express';
import {
  getEvents,
  getWeekEvents,
  getDayEvents,
  getTodoProgress,
  updateTodoProgress,
  getPregnancyDiaries,
  savePregnancyDiary,
  deletePregnancyDiary,
  getCustomTodos,
  getStandardSchedule,
  generateStandardSchedule,
  createCustomTodo,
  updateCustomTodo,
  deleteCustomTodo,
  createEvent,
  updateEvent,
  dragEvent,
  batchUpdateEvents,
  deleteEvent,
  batchDeleteEvents,
  completeEvent,
  getEventTypes
} from '../controllers/calendar.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { queryRateLimiter, writeRateLimiter } from '../middlewares/rateLimiter.middleware';
import {
  createEventBody, getEventsQuery,
  updateEventBody, dragEventBody, batchUpdateEventsBody, batchDeleteEventsBody,
  updateTodoProgressBody, saveDiaryBody, createCustomTodoBody, updateCustomTodoBody,
  calendarEventIdParam, customTodoIdParam, diaryWeekParam, dayParam, weekDateQuery, weekQuery,
} from '../schemas/calendar.schema';

const router = Router();

// 所有日历路由都需要认证
router.use(authMiddleware);

// 事件类型
router.get('/event-types', queryRateLimiter, getEventTypes);

// 周历数据
router.get('/week', queryRateLimiter, validate({ query: weekDateQuery }), getWeekEvents);

// 单日数据
router.get('/day/:date', queryRateLimiter, validate({ params: dayParam }), getDayEvents);

// 孕周待办进度
router.get('/todo-progress', queryRateLimiter, validate({ query: weekQuery }), getTodoProgress);
router.put('/todo-progress', writeRateLimiter, validate({ body: updateTodoProgressBody }), updateTodoProgress);

// 孕周记录
router.get('/diaries', queryRateLimiter, validate({ query: weekQuery }), getPregnancyDiaries);
router.put('/diaries', writeRateLimiter, validate({ body: saveDiaryBody }), savePregnancyDiary);
router.delete('/diaries/:week', writeRateLimiter, validate({ params: diaryWeekParam }), deletePregnancyDiary);

// 自定义待办
router.get('/custom-todos', queryRateLimiter, validate({ query: weekQuery }), getCustomTodos);
router.post('/custom-todos', writeRateLimiter, validate({ body: createCustomTodoBody }), createCustomTodo);
router.put('/custom-todos/:id', writeRateLimiter, validate({ params: customTodoIdParam, body: updateCustomTodoBody }), updateCustomTodo);
router.delete('/custom-todos/:id', writeRateLimiter, validate({ params: customTodoIdParam }), deleteCustomTodo);

// 标准节点计划
router.get('/standard-schedule', queryRateLimiter, getStandardSchedule);
router.post('/standard-schedule/generate', writeRateLimiter, generateStandardSchedule);

// 事件列表（按日期范围）
router.get('/events', queryRateLimiter, validate({ query: getEventsQuery }), getEvents);

// 创建事件
router.post('/events', writeRateLimiter, validate({ body: createEventBody }), createEvent);

// 更新事件
router.put('/events/:id', writeRateLimiter, validate({ params: calendarEventIdParam, body: updateEventBody }), updateEvent);

// 拖拽更新事件日期
router.patch('/events/:id/drag', writeRateLimiter, validate({ params: calendarEventIdParam, body: dragEventBody }), dragEvent);

// 批量更新事件
router.patch('/events/batch', writeRateLimiter, validate({ body: batchUpdateEventsBody }), batchUpdateEvents);

// 批量删除事件
router.delete('/events/batch', writeRateLimiter, validate({ body: batchDeleteEventsBody }), batchDeleteEvents);

// 删除事件
router.delete('/events/:id', writeRateLimiter, validate({ params: calendarEventIdParam }), deleteEvent);

// 标记完成
router.post('/events/:id/complete', writeRateLimiter, validate({ params: calendarEventIdParam }), completeEvent);

export default router;
