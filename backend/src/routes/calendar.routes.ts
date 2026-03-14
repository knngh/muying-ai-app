import { Router } from 'express';
import {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  completeEvent
} from '../controllers/calendar.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// 所有日历路由都需要认证
router.use(authMiddleware);

router.get('/events', getEvents);
router.post('/events', createEvent);
router.put('/events/:id', updateEvent);
router.delete('/events/:id', deleteEvent);
router.post('/events/:id/complete', completeEvent);

export default router;