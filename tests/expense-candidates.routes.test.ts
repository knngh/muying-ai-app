jest.mock('../src/middlewares/quota.middleware', () => ({ quotaCheckMiddleware: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()) }));
jest.mock('../src/services/expense-candidates.service', () => ({ generateExpenseCandidates: jest.fn() }));

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import routes from '../src/routes/tool-ai-review.routes';
import { errorHandler } from '../src/middlewares/error.middleware';
import { quotaCheckMiddleware } from '../src/middlewares/quota.middleware';
import { generateExpenseCandidates } from '../src/services/expense-candidates.service';

const app = express(); app.use(express.json()); app.use('/tool-records', routes); app.use(errorHandler);
const input = { text: '奶粉268，尿布89', consent: true };
const secret = 'unit-test-expense-candidates-secret-123456';
const auth = () => `Bearer ${jwt.sign({ userId: '91001' }, secret, { expiresIn: '1m' })}`;
const originalFlag = process.env.EXPENSE_CANDIDATES_AI_ENABLED;
const originalSecret = process.env.JWT_SECRET;
beforeEach(() => { jest.clearAllMocks(); process.env.JWT_SECRET = secret; process.env.EXPENSE_CANDIDATES_AI_ENABLED = 'true'; });
afterAll(() => {
  if (originalFlag === undefined) delete process.env.EXPENSE_CANDIDATES_AI_ENABLED; else process.env.EXPENSE_CANDIDATES_AI_ENABLED = originalFlag;
  if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
});

it('requires authentication and the dedicated feature gate', async () => {
  await request(app).post('/tool-records/expense-candidates').send(input).expect(401);
  process.env.EXPENSE_CANDIDATES_AI_ENABLED = 'false';
  await request(app).post('/tool-records/expense-candidates').set('Authorization', auth()).send(input).expect(503);
  expect(quotaCheckMiddleware).not.toHaveBeenCalled(); expect(generateExpenseCandidates).not.toHaveBeenCalled();
});
it('validates before quota and returns a no-store candidate response', async () => {
  await request(app).post('/tool-records/expense-candidates').set('Authorization', auth()).send({ ...input, consent: false }).expect(400);
  expect(quotaCheckMiddleware).not.toHaveBeenCalled();
  (generateExpenseCandidates as jest.Mock).mockResolvedValueOnce({ source: 'manual', candidates: [] });
  const response = await request(app).post('/tool-records/expense-candidates').set('Authorization', auth()).send(input).expect(200);
  expect(response.headers['cache-control']).toBe('no-store'); expect(response.body.data.source).toBe('manual');
  expect(generateExpenseCandidates).toHaveBeenCalledWith(input);
});
