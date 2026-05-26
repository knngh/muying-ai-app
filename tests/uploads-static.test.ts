import fs from 'fs/promises';
import path from 'path';
import request from 'supertest';
import app from '../src/app';

describe('uploads static files', () => {
  const uploadDir = path.join(process.cwd(), 'uploads');
  const filename = `static-cache-test-${process.pid}.jpg`;
  const filePath = path.join(uploadDir, filename);

  beforeAll(async () => {
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(filePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  });

  afterAll(async () => {
    await fs.rm(filePath, { force: true });
  });

  it('serves uploads without immutable client caching', async () => {
    const res = await request(app).get(`/uploads/${filename}`);

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store, max-age=0');
    expect(res.headers['cache-control']).not.toContain('immutable');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(res.headers.etag).toBeUndefined();
  });

  it('returns 404 when an upload has been removed', async () => {
    const res = await request(app).get(`/uploads/missing-${Date.now()}.jpg`);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      code: 5001,
      message: '资源不存在',
    });
  });
});
