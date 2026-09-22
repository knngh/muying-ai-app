import type { Request, Response, NextFunction } from 'express';

jest.mock('../src/middlewares/auth.middleware', () => ({ authMiddleware: (req: Request, res: Response, next: NextFunction) => {
  if (!req.headers.authorization) return res.status(401).json({ message: '请先登录' });
  req.userId = '1'; next();
} }));
jest.mock('../src/middlewares/quota.middleware', () => ({ quotaCheckMiddleware: jest.fn((_req, _res, next) => next()) }));
jest.mock('../src/services/name-evaluation.service', () => ({ evaluateNames: jest.fn() }));

import express from 'express';
import request from 'supertest';
import nameRoutes from '../src/routes/name-library.routes';
import { errorHandler } from '../src/middlewares/error.middleware';
import { quotaCheckMiddleware } from '../src/middlewares/quota.middleware';
import { evaluateNames } from '../src/services/name-evaluation.service';

const app = express();
app.use(express.json());
app.use('/names', nameRoutes);
app.use(errorHandler);
const input = { surname: '林', candidateIds: ['an'], preferences: ['简洁'], consent: true };
const previousFlag = process.env.NAME_EVALUATION_AI_ENABLED;
beforeEach(() => { jest.clearAllMocks(); process.env.NAME_EVALUATION_AI_ENABLED = 'true'; });
afterAll(() => {
  if (previousFlag === undefined) delete process.env.NAME_EVALUATION_AI_ENABLED;
  else process.env.NAME_EVALUATION_AI_ENABLED = previousFlag;
});

it('requires authentication before evaluation or quota usage', async () => {
  await request(app).post('/names/evaluate').send(input).expect(401);
  expect(quotaCheckMiddleware).not.toHaveBeenCalled();
  expect(evaluateNames).not.toHaveBeenCalled();
});
it('rejects forged names before quota usage', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try { await request(app).post('/names/evaluate').set('Authorization', 'test').send({ ...input, candidateIds: ['new-name'] }).expect(400); }
  finally { log.mockRestore(); }
  expect(quotaCheckMiddleware).not.toHaveBeenCalled();
});
it('keeps the default-off switch effective without consuming quota', async () => {
  delete process.env.NAME_EVALUATION_AI_ENABLED;
  await request(app).post('/names/evaluate').set('Authorization', 'test').send(input).expect(503);
  expect(quotaCheckMiddleware).not.toHaveBeenCalled();
  expect(evaluateNames).not.toHaveBeenCalled();
});
it('applies quota and avoids caching private comparisons', async () => {
  (evaluateNames as jest.Mock).mockResolvedValueOnce({ source: 'rules', candidates: [] });
  const response = await request(app).post('/names/evaluate').set('Authorization', 'test').send(input).expect(200);
  expect(quotaCheckMiddleware).toHaveBeenCalledTimes(1);
  expect(evaluateNames).toHaveBeenCalledWith(input);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body.data.source).toBe('rules');
});
