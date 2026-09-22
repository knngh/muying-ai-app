const mockDeliveryFindMany = jest.fn();
const mockDeliveryUpdateMany = jest.fn();
const mockDeliveryUpdate = jest.fn();
const mockAxiosGet = jest.fn();
const mockAxiosPost = jest.fn();

jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    wechatReminderDelivery: {
      findMany: mockDeliveryFindMany,
      updateMany: mockDeliveryUpdateMany,
      update: mockDeliveryUpdate,
    },
  },
}));
jest.mock('axios', () => ({
  __esModule: true,
  default: { get: mockAxiosGet, post: mockAxiosPost },
}));

import { processDueWechatReminders, resetWechatReminderDeliveryRuntimeForTests } from '../src/services/wechat-reminder-delivery.service';

const previousEnv = { ...process.env };
const config = {
  WECHAT_SUBSCRIBE_ENABLED: 'true',
  WECHAT_APPID: 'wx-test',
  WECHAT_APP_SECRET: 'secret-test',
  WECHAT_SUBSCRIBE_TEMPLATE_ID: 'template-test',
  WECHAT_SUBSCRIBE_TITLE_FIELD: 'thing1',
  WECHAT_SUBSCRIBE_TIME_FIELD: 'time2',
  WECHAT_SUBSCRIBE_LEAD_FIELD: 'thing3',
  WECHAT_REMINDER_MAX_ATTEMPTS: '3',
};

const record = {
  id: 1n,
  user: { openid: 'openid-test' },
  templateId: 'template-test',
  title: '周三产检安排很重要',
  eventAt: new Date('2030-01-01T10:00:00.000Z'),
  leadMinutes: 60,
  attempts: 0,
};

beforeEach(() => {
  Object.assign(process.env, config);
  mockDeliveryFindMany.mockReset();
  mockDeliveryUpdateMany.mockReset();
  mockDeliveryUpdate.mockReset();
  mockAxiosGet.mockReset();
  mockAxiosPost.mockReset();
  resetWechatReminderDeliveryRuntimeForTests();
});

afterAll(() => {
  process.env = previousEnv;
});

it('领取到期任务后发送并标记 sent，且不在日志或记录中写 openid', async () => {
  mockDeliveryUpdateMany
    .mockResolvedValueOnce({ count: 0 }) // stale recovery
    .mockResolvedValueOnce({ count: 1 }) // lease
    .mockResolvedValueOnce({ count: 1 }); // sent transition
  mockDeliveryFindMany.mockResolvedValue([record]);
  mockAxiosGet.mockResolvedValue({ data: { access_token: 'access-token', expires_in: 7200 } });
  mockAxiosPost.mockResolvedValue({ data: { errcode: 0 } });

  const result = await processDueWechatReminders(new Date('2030-01-01T09:01:00.000Z'));
  expect(result).toMatchObject({ scanned: 1, sent: 1, retried: 0, failed: 0 });
  expect(mockAxiosPost).toHaveBeenCalledWith(
    expect.stringContaining('/cgi-bin/message/subscribe/send?access_token='),
    expect.objectContaining({ touser: 'openid-test', template_id: 'template-test' }),
    expect.any(Object),
  );
  expect(mockDeliveryUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'sent' }) }));
});

it('临时接口失败时重新排队，并在达到最大次数后标记 failed', async () => {
  mockDeliveryUpdateMany
    .mockResolvedValueOnce({ count: 0 })
    .mockResolvedValueOnce({ count: 1 })
    .mockResolvedValueOnce({ count: 1 });
  mockDeliveryFindMany.mockResolvedValue([{ ...record, attempts: 2 }]);
  mockAxiosGet.mockResolvedValue({ data: { access_token: 'access-token', expires_in: 7200 } });
  mockAxiosPost.mockRejectedValue(new Error('network failure'));

  const result = await processDueWechatReminders(new Date('2030-01-01T09:01:00.000Z'));
  expect(result).toMatchObject({ scanned: 1, sent: 0, retried: 0, failed: 1 });
  expect(mockDeliveryUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'failed', lastError: '微信接口请求失败' }) }));
});

it('微信明确拒绝订阅时不重试', async () => {
  mockDeliveryUpdateMany
    .mockResolvedValueOnce({ count: 0 })
    .mockResolvedValueOnce({ count: 1 })
    .mockResolvedValueOnce({ count: 1 });
  mockDeliveryFindMany.mockResolvedValue([record]);
  mockAxiosGet.mockResolvedValue({ data: { access_token: 'access-token', expires_in: 7200 } });
  mockAxiosPost.mockResolvedValue({ data: { errcode: 43101 } });

  const result = await processDueWechatReminders(new Date('2030-01-01T09:01:00.000Z'));
  expect(result).toMatchObject({ retried: 0, failed: 1 });
  expect(mockDeliveryUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'failed', lastError: '微信接口错误 43101' }) }));
});

it('配置未打开时 worker 不触碰数据库', async () => {
  process.env.WECHAT_SUBSCRIBE_ENABLED = 'false';
  const result = await processDueWechatReminders();
  expect(result.skipped).toBe(true);
  expect(mockDeliveryFindMany).not.toHaveBeenCalled();
});
