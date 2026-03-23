import { Router } from 'express';
import {
  getEvents,
  getWeekEvents,
  getDayEvents,
  getTodoProgress,
  updateTodoProgress,
  getPregnancyDiaries,
  savePregnancyDiary,
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

const router = Router();

// 所有日历路由都需要认证
router.use(authMiddleware);

// 事件类型
router.get('/event-types', getEventTypes);

// 周历数据
router.get('/week', getWeekEvents);

// 单日数据
router.get('/day/:date', getDayEvents);

// 孕周待办进度
router.get('/todo-progress', getTodoProgress);
router.put('/todo-progress', updateTodoProgress);

// 孕周记录
router.get('/diaries', getPregnancyDiaries);
router.put('/diaries', savePregnancyDiary);

// 事件列表（按日期范围）
router.get('/events', getEvents);

// 创建事件
router.post('/events', createEvent);

// 更新事件
router.put('/events/:id', updateEvent);

// 拖拽更新事件日期
router.patch('/events/:id/drag', dragEvent);

// 批量更新事件
router.patch('/events/batch', batchUpdateEvents);

// 删除事件
router.delete('/events/:id', deleteEvent);

// 批量删除事件
router.delete('/events/batch', batchDeleteEvents);

// 标记完成
router.post('/events/:id/complete', completeEvent);

export default router;
