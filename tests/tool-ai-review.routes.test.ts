jest.mock('../src/middlewares/quota.middleware', () => ({ quotaCheckMiddleware: jest.fn((_req, _res, next) => next()) }));
jest.mock('../src/services/tool-ai-review.service', () => ({ generateToolAIReview: jest.fn() }));

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import routes from '../src/routes/tool-ai-review.routes';
import { errorHandler } from '../src/middlewares/error.middleware';
import { quotaCheckMiddleware } from '../src/middlewares/quota.middleware';
import { generateToolAIReview } from '../src/services/tool-ai-review.service';

const app = express(); app.use(express.json()); app.use('/tool-records', routes); app.use(errorHandler);
const input = { toolId: 'weight', records: [{ date: '2026-09-21', content: '体重 62.4 kg' }], consent: true };
const originalFlag = process.env.TOOL_AI_REVIEW_ENABLED;
const originalSecret = process.env.JWT_SECRET;
const testSecret = 'unit-test-tool-ai-review-secret-123456';
const auth = () => `Bearer ${jwt.sign({ userId: String(++userId) }, testSecret, { expiresIn: '1m' })}`;
let userId = 91000;
let log: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks(); process.env.TOOL_AI_REVIEW_ENABLED = 'true'; process.env.JWT_SECRET = testSecret;
  log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => log.mockRestore());
afterAll(() => {
  if (originalFlag === undefined) delete process.env.TOOL_AI_REVIEW_ENABLED; else process.env.TOOL_AI_REVIEW_ENABLED = originalFlag;
  if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
});

it('verifies the JWT before quota or model calls', async () => {
  await request(app).post('/tool-records/ai-review').send(input).expect(401);
  await request(app).post('/tool-records/ai-review').set('Authorization', 'Bearer forged').send(input).expect(401);
  expect(quotaCheckMiddleware).not.toHaveBeenCalled(); expect(generateToolAIReview).not.toHaveBeenCalled();
});
it.each([undefined, 'false', 'TRUE'])('keeps the server gate closed for %s', async value => {
  if (value === undefined) delete process.env.TOOL_AI_REVIEW_ENABLED; else process.env.TOOL_AI_REVIEW_ENABLED = value;
  const response = await request(app).post('/tool-records/ai-review').set('Authorization', auth()).send(input).expect(503);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(quotaCheckMiddleware).not.toHaveBeenCalled(); expect(generateToolAIReview).not.toHaveBeenCalled();
});
it.each([
  { consent: false }, { toolId: 'reports' }, { records: [] },
  { records: [{ date: 'today', content: '记录', imageUrl: 'https://example.com/image' }] },
  { model: 'unapproved' }, { clientRequestId: 'reuse-a-free-quota-key' },
])('rejects invalid or extra fields before quota', async patch => {
  await request(app).post('/tool-records/ai-review').set('Authorization', auth()).send({ ...input, ...patch }).expect(400);
  expect(quotaCheckMiddleware).not.toHaveBeenCalled();
});
it('returns uncached results after the existing quota middleware', async () => {
  (generateToolAIReview as jest.Mock).mockResolvedValueOnce({ source: 'rules', title: '记录回顾' });
  const response = await request(app).post('/tool-records/ai-review').set('Authorization', auth()).send(input).expect(200);
  expect(response.body.data.source).toBe('rules'); expect(response.headers['cache-control']).toBe('no-store');
  expect(quotaCheckMiddleware).toHaveBeenCalledTimes(1); expect(generateToolAIReview).toHaveBeenCalledWith(input);
});
it('does not call providers after quota rejection', async () => {
  (quotaCheckMiddleware as jest.Mock).mockImplementationOnce((_req, res) => res.status(429).json({ code: 4003 }));
  await request(app).post('/tool-records/ai-review').set('Authorization', auth()).send(input).expect(429);
  expect(generateToolAIReview).not.toHaveBeenCalled();
});
it('does not expose record CRUD routes as part of the AI batch', async () => {
  await request(app).get('/tool-records/weights').expect(404);
});
