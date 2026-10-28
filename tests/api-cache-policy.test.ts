import request from 'supertest';
import app from '../src/app';

describe('private API cache policy', () => {
  it('does not cache an unauthenticated account response', async () => {
    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(response.headers['cache-control']).toMatch(/no-store/);
  });

  it('does not cache an unauthenticated private record response', async () => {
    const response = await request(app).get('/api/v1/tool-records');

    expect(response.status).toBe(401);
    expect(response.headers['cache-control']).toMatch(/no-store/);
  });
});
