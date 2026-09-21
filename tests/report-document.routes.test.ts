import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import prisma from '../src/config/database';
import toolRoutes from '../src/routes/tool-record.routes';
import { env } from '../src/config/env';
import { errorHandler } from '../src/middlewares/error.middleware';
import { PRIVATE_REPORT_ROOT, resolveReportPath } from '../src/middlewares/report-upload.middleware';

jest.mock('../src/config/database', () => ({ __esModule: true, default: {
  reportDocument: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  reportField: { findUnique: jest.fn(), findFirst: jest.fn(), count: jest.fn(), create: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn() },
  $transaction: jest.fn(),
} }));
const app = express();
app.use(express.json());
app.use('/tools', toolRoutes);
app.use(errorHandler);
const ownerId = String(900000 + process.pid);
const auth = `Bearer ${jwt.sign({ userId: ownerId }, env.JWT_SECRET)}`;
const base = { reportDate: '2026-09-21', name: '复查报告', clientOperationId: 'report-test-001' };
const folder = path.join(PRIVATE_REPORT_ROOT, ownerId);
const db = prisma as unknown as {
  reportDocument: Record<string, jest.Mock>; reportField: Record<string, jest.Mock>; $transaction: jest.Mock;
};
const record = (overrides: Record<string, unknown> = {}) => ({
  id: 5n, userId: BigInt(ownerId), reportDate: new Date('2026-09-21'), name: base.name, note: null,
  storageKey: null, ocrStatus: 'not_started', deletedAt: null, pageCount: 1, clientOperationId: base.clientOperationId,
  fields: [], createdAt: new Date(), updatedAt: new Date(), ...overrides,
});
const createUpload = (image: Buffer, data = base) => {
  const call = request(app).post('/tools/reports').set('Authorization', auth);
  Object.entries(data).forEach(([key, value]) => call.field(key, value));
  return call.attach('file', image, { filename: 'report.png', contentType: 'image/png' });
};
async function files() { return fs.readdir(path.join(folder, 'reports')).catch(() => []); }

beforeEach(async () => {
  jest.clearAllMocks();
  await fs.rm(folder, { recursive: true, force: true });
  db.reportDocument.findUnique.mockResolvedValue(null);
  db.reportDocument.create.mockImplementation(async ({ data }) => record(data));
  db.reportDocument.findFirst.mockResolvedValue(null);
  db.reportField.findFirst.mockResolvedValue(null);
  db.$transaction.mockImplementation(async (operations) => typeof operations === 'function' ? operations(db) : Promise.all(operations));
});
afterEach(async () => { await fs.rm(folder, { recursive: true, force: true }); });
let log: jest.SpyInstance;
beforeAll(() => { log = jest.spyOn(console, 'error').mockImplementation(() => undefined); });
afterAll(() => log.mockRestore());

it('requires login before accepting report files', async () => {
  await request(app).post('/tools/reports').send(base).expect(401);
  expect(db.reportDocument.create).not.toHaveBeenCalled();
  expect(await files()).toEqual([]);
});
it('preserves original image bytes and serves them only after checking ownership', async () => {
  const image = await sharp({ create: { width: 2200, height: 40, channels: 3, background: '#ffffff' } }).png().toBuffer();
  const result = await createUpload(image).expect(201);
  expect(result.body.data).toMatchObject({ hasImage: true, ocrStatus: 'not_started', fields: [] });
  expect(result.body.data.storageKey).toBeUndefined();
  const data = db.reportDocument.create.mock.calls[0][0].data;
  const privatePath = resolveReportPath(data.storageKey, ownerId);
  expect(await fs.readFile(privatePath)).toEqual(image);
  db.reportDocument.findFirst.mockImplementation(async ({ where }) => where.userId === BigInt(ownerId) ? record(data) : null);
  const response = await request(app).get('/tools/reports/5/file').set('Authorization', auth).expect(200);
  expect(response.headers['cache-control']).toContain('no-store');
  expect(response.body).toEqual(image);
  const other = `Bearer ${jwt.sign({ userId: '7' }, env.JWT_SECRET)}`;
  await request(app).get('/tools/reports/5/file').set('Authorization', other).expect(404);
  await request(app).get(`/private-uploads/${data.storageKey}`).expect(404);
});
it('rejects malformed identifiers and invalid report dates before persistence', async () => {
  for (const value of ['abc', '0', '9223372036854775808']) {
    await request(app).get(`/tools/reports/${value}/file`).set('Authorization', auth).expect(400);
  }
  await request(app).post('/tools/reports').set('Authorization', auth).send({ ...base, reportDate: '2026-02-30' }).expect(400);
  expect(db.reportDocument.create).not.toHaveBeenCalled();
});
it('cleans uploaded files when metadata validation or database persistence fails', async () => {
  const image = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#ffffff' } }).png().toBuffer();
  await createUpload(image, { ...base, name: '' }).expect(400);
  expect(await files()).toEqual([]);
  db.reportDocument.create.mockRejectedValue(new Error('database unavailable'));
  await createUpload(image).expect(500);
  // Controller cleanup runs in finally after response completion.
  await new Promise(resolve => setImmediate(resolve));
  expect(await files()).toEqual([]);
});
it('rejects spoofed image content even when the extension and MIME look valid', async () => {
  await createUpload(Buffer.from('<html>not a report image</html>')).expect(400);
  expect(await files()).toEqual([]);
});
it('retries creation with the same operation id without a second archive or orphan image', async () => {
  db.reportDocument.findUnique.mockResolvedValue(record());
  const image = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#ffffff' } }).png().toBuffer();
  const result = await createUpload(image).expect(200);
  expect(result.body.data.id).toBe('5');
  expect(db.reportDocument.create).not.toHaveBeenCalled();
  await new Promise(resolve => setImmediate(resolve));
  expect(await files()).toEqual([]);
});
it('prevents stale retries from recreating a deleted report', async () => {
  db.reportDocument.findUnique.mockResolvedValue(record({ deletedAt: new Date() }));
  await request(app).post('/tools/reports').set('Authorization', auth).send(base).expect(410);
  expect(db.reportDocument.create).not.toHaveBeenCalled();
});
it('binds field confirmation to both report id and owner and rejects stale versions', async () => {
  const field = { id: 9n, reportDocumentId: 5n, candidateValue: '原始数值', version: 2 };
  db.reportField.findFirst.mockImplementation(async ({ where }) => where.reportDocumentId === 5n && where.reportDocument.userId === BigInt(ownerId) ? field : null);
  await request(app).post('/tools/reports/6/fields/9/confirm').set('Authorization', auth).send({ normalizedValue: '12 g/L', version: 2 }).expect(404);
  db.reportField.updateMany.mockResolvedValue({ count: 0 });
  await request(app).post('/tools/reports/5/fields/9/confirm').set('Authorization', auth).send({ normalizedValue: '12 g/L', version: 1 }).expect(409);
});
it('does not let clients forge OCR provenance or confirm during candidate creation', async () => {
  await request(app).post('/tools/reports/5/fields').set('Authorization', auth).send({ fieldKey: 'hemoglobin', label: '血红蛋白', candidateValue: '120 g/L', source: 'ocr', confirmedAt: new Date().toISOString() }).expect(400);
  expect(db.reportField.create).not.toHaveBeenCalled();
});
it('paginates archives with a stable id cursor', async () => {
  db.reportDocument.findMany.mockResolvedValue([record({ id: 9n }), record({ id: 5n })]);
  const first = await request(app).get('/tools/reports?limit=1').set('Authorization', auth).expect(200);
  expect(first.body.data.nextCursor).toBe('9');
  await request(app).get('/tools/reports?limit=1&beforeId=9').set('Authorization', auth).expect(200);
  expect(db.reportDocument.findMany.mock.calls[1][0].where).toMatchObject({ id: { lt: 9n }, userId: BigInt(ownerId), deletedAt: null });
});
it('deletes the private image and candidate fields while leaving a retry tombstone', async () => {
  const storageKey = `${ownerId}/reports/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png`;
  await fs.mkdir(path.join(folder, 'reports'), { recursive: true });
  await fs.writeFile(resolveReportPath(storageKey, ownerId), 'private image');
  db.reportDocument.findFirst.mockResolvedValue(record({ storageKey }));
  await request(app).delete('/tools/reports/5').set('Authorization', auth).expect(200);
  expect(await files()).toEqual([]);
  expect(db.reportField.deleteMany).toHaveBeenCalledWith({ where: { reportDocumentId: 5n } });
  expect(db.reportDocument.update.mock.calls[0][0].data).toMatchObject({ name: '', note: null, deletedAt: expect.any(Date) });
});
it('rejects paths outside the authenticated owner directory', () => {
  expect(() => resolveReportPath('../uploads/test.png', ownerId)).toThrow();
  expect(() => resolveReportPath('7/reports/a.png', ownerId)).toThrow();
});

it('keeps manual candidates unconfirmed, handles retries, then confirms a reviewed value', async () => {
  const field = { id: 9n, reportDocumentId: 5n, fieldKey: 'field-test', label: '血红蛋白', candidateValue: '120 g/L', normalizedValue: null, source: 'manual', confidence: null, version: 1, pageNumber: 1, confirmedAt: null };
  db.reportDocument.updateMany.mockResolvedValue({ count: 1 });
  db.reportField.count.mockResolvedValue(0);
  db.reportField.findUnique.mockResolvedValue(null);
  db.reportField.create.mockResolvedValue(field);
  const url = '/tools/reports/5/fields';
  const body = { fieldKey: field.fieldKey, label: field.label, candidateValue: field.candidateValue };
  const created = await request(app).post(url).set('Authorization', auth).send(body).expect(201);
  expect(created.body.data).toMatchObject({ candidateValue: '120 g/L', normalizedValue: null, confirmedAt: null, source: 'manual' });
  db.reportField.findUnique.mockResolvedValue(field);
  await request(app).post(url).set('Authorization', auth).send(body).expect(201);
  expect(db.reportField.create).toHaveBeenCalledTimes(1);
  db.reportField.findFirst.mockResolvedValueOnce(field).mockResolvedValueOnce({ ...field, normalizedValue: '121 g/L', confirmedAt: new Date(), version: 2 });
  db.reportField.updateMany.mockResolvedValue({ count: 1 });
  const confirmed = await request(app).post(`${url}/9/confirm`).set('Authorization', auth).send({ normalizedValue: '121 g/L', version: 1 }).expect(200);
  expect(confirmed.body.data.candidateValue).toBe('120 g/L');
  expect(confirmed.body.data.normalizedValue).toBe('121 g/L');
  expect(confirmed.body.data.confirmedAt).toBeTruthy();
});
