import type { Request, Response, NextFunction } from 'express';

const mockEnqueue = jest.fn();
const mockCancel = jest.fn();

jest.mock('../src/middlewares/auth.middleware', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    req.userId = '123';
    next();
  },
}));
jest.mock('../src/services/wechat-reminder.service', () => ({
  enqueueWechatReminder: mockEnqueue,
  cancelWechatReminder: mockCancel,
}));

import express from 'express';
import request from 'supertest';
import routes from '../src/routes/wechat-notification.routes';
import { errorHandler } from '../src/middlewares/error.middleware';

const app = express();
app.use(express.json());
app.use('/notifications', routes);
app.use(errorHandler);

const input = {
  clientReminderId: 'reminder-abc',
  sourceKey: 'vaccine:hepb-2',
  templateId: 'template-test',
  title: '乙肝第二剂',
  eventAt: '2030-01-01T10:00:00.000Z',
  scheduledAt: '2030-01-01T09:00:00.000Z',
  leadMinutes: 60,
  subscriptionResult: 'accept',
};

beforeEach(() => {
  mockEnqueue.mockReset();
  mockCancel.mockReset();
  mockEnqueue.mockResolvedValue({ clientReminderId: input.clientReminderId, status: 'pending' });
  mockCancel.mockResolvedValue({ clientReminderId: input.clientReminderId, status: 'cancelled' });
});

it('校验后将用户身份传给排队服务', async () => {
  await request(app).post('/notifications/reminders').send(input).expect(200);
  expect(mockEnqueue).toHaveBeenCalledWith('123', expect.objectContaining(input));
});

it('拒绝包含路径注入字符的取消请求', async () => {
  await request(app).delete('/notifications/reminders/bad%20id').expect(400);
  expect(mockCancel).not.toHaveBeenCalled();
});

it('取消请求只操作当前认证用户', async () => {
  await request(app).delete(`/notifications/reminders/${input.clientReminderId}`).expect(200);
  expect(mockCancel).toHaveBeenCalledWith('123', input.clientReminderId);
});
