const mockUserFindUnique = jest.fn();
const mockDeliveryFindUnique = jest.fn();
const mockDeliveryCreate = jest.fn();
const mockDeliveryUpdate = jest.fn();

jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    user: { findUnique: mockUserFindUnique },
    wechatReminderDelivery: {
      findUnique: mockDeliveryFindUnique,
      create: mockDeliveryCreate,
      update: mockDeliveryUpdate,
    },
  },
}));

import { AppError } from '../src/middlewares/error.middleware';
import { cancelWechatReminder, enqueueWechatReminder } from '../src/services/wechat-reminder.service';

const previousEnv = { ...process.env };
const config = {
  WECHAT_SUBSCRIBE_ENABLED: 'true',
  WECHAT_APPID: 'wx-test',
  WECHAT_APP_SECRET: 'secret-test',
  WECHAT_SUBSCRIBE_TEMPLATE_ID: 'template-test',
  WECHAT_SUBSCRIBE_TITLE_FIELD: 'thing1',
  WECHAT_SUBSCRIBE_TIME_FIELD: 'time2',
  WECHAT_SUBSCRIBE_LEAD_FIELD: 'thing3',
};

const input = {
  clientReminderId: 'reminder-abc',
  sourceKey: 'vaccine:hepb-2',
  templateId: 'template-test',
  title: '乙肝第二剂',
  eventAt: '2030-01-01T10:00:00.000Z',
  scheduledAt: '2030-01-01T09:00:00.000Z',
  leadMinutes: 60,
  subscriptionResult: 'accept' as const,
};

function row(status: string = 'pending') {
  return {
    id: 1n,
    clientReminderId: input.clientReminderId,
    sourceKey: input.sourceKey,
    templateId: input.templateId,
    title: input.title,
    eventAt: new Date(input.eventAt),
    scheduledAt: new Date(input.scheduledAt),
    leadMinutes: input.leadMinutes,
    status,
    attempts: 0,
    sentAt: status === 'sent' ? new Date('2029-12-31T00:00:00.000Z') : null,
  };
}

beforeEach(() => {
  Object.assign(process.env, config);
  mockUserFindUnique.mockReset();
  mockDeliveryFindUnique.mockReset();
  mockDeliveryCreate.mockReset();
  mockDeliveryUpdate.mockReset();
});

afterAll(() => {
  process.env = previousEnv;
});

it('默认关闭时不读取用户或排队', async () => {
  process.env.WECHAT_SUBSCRIBE_ENABLED = 'false';
  await expect(enqueueWechatReminder('123', input)).rejects.toMatchObject<AppError>({ statusCode: 503 });
  expect(mockUserFindUnique).not.toHaveBeenCalled();
});

it('只允许当前微信账号且拒绝模板伪造', async () => {
  mockUserFindUnique.mockResolvedValue({ id: 123n, openid: 'openid-test' });
  await expect(enqueueWechatReminder('123', { ...input, templateId: 'other-template' })).rejects.toMatchObject<AppError>({ statusCode: 400 });
  expect(mockDeliveryFindUnique).not.toHaveBeenCalled();
});

it('相同已发送提醒重复提交时保持幂等，不重新排队', async () => {
  mockUserFindUnique.mockResolvedValue({ id: 123n, openid: 'openid-test' });
  mockDeliveryFindUnique.mockResolvedValue(row('sent'));
  const result = await enqueueWechatReminder('123', input);
  expect(result.status).toBe('sent');
  expect(mockDeliveryCreate).not.toHaveBeenCalled();
  expect(mockDeliveryUpdate).not.toHaveBeenCalled();
});

it('首次同意订阅会创建待发送记录', async () => {
  mockUserFindUnique.mockResolvedValue({ id: 123n, openid: 'openid-test' });
  mockDeliveryFindUnique.mockResolvedValue(null);
  mockDeliveryCreate.mockResolvedValue(row());
  const result = await enqueueWechatReminder('123', input);
  expect(result).toMatchObject({ clientReminderId: input.clientReminderId, status: 'pending' });
  expect(mockDeliveryCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 123n, title: input.title }) }));
});

it('停止提醒会取消待发送记录，已发送记录保持历史状态', async () => {
  mockDeliveryFindUnique.mockResolvedValueOnce({ status: 'pending' }).mockResolvedValueOnce({ status: 'sent' });
  const cancelled = await cancelWechatReminder('123', input.clientReminderId);
  expect(cancelled.status).toBe('cancelled');
  expect(mockDeliveryUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'cancelled', lastError: null } }));
  const sent = await cancelWechatReminder('123', input.clientReminderId);
  expect(sent.status).toBe('sent');
});
