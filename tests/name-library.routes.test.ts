import express from 'express';
import request from 'supertest';
import nameRoutes from '../src/routes/name-library.routes';
import { errorHandler } from '../src/middlewares/error.middleware';
import { nameCopyText, nameFavoriteKey, readNameFavorites } from '../shared/utils/name-library';
import type { NameLibraryResponse } from '../shared/types/name-library';
import { filterNameLibrary } from '../src/services/name-library.service';

const app = express();
app.use('/api/v1/names', nameRoutes);
app.use(errorHandler);

describe('public static name library', () => {
  it('works without login or a database and preserves metadata across pages', async () => {
    const first = await request(app).get('/api/v1/names').query({ surname: '欧阳', pageSize: 2 }).expect(200);
    const next = await request(app).get('/api/v1/names').query({ surname: '欧阳', pageSize: 2, page: 2 }).expect(200);
    const data: NameLibraryResponse = first.body.data;
    expect(first.body.code).toBe(0);
    expect(data.list).toHaveLength(2);
    expect(data.list.every(item => item.fullName.startsWith('欧阳'))).toBe(true);
    expect(data.disclosure).toContain('AI');
    expect(next.body.data.version).toBe(data.version);
    expect(next.body.data.pagination.total).toBe(data.pagination.total);
    expect(next.body.data.list.every((item: { id: string }) => !data.list.some(previous => previous.id === item.id))).toBe(true);
  });

  it('returns a structured 400 for invalid filters', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const response = await request(app).get('/api/v1/names').query({ nameLength: 3 }).expect(400);
      expect(response.body.code).toBe(1001);
      expect(response.body.message).toContain('nameLength');
    } finally { log.mockRestore(); }
  });

  it('returns an empty list and total 0 when all candidates are excluded', async () => {
    const response = await request(app).get('/api/v1/names').query({ nameLength: 1, avoid: '安宁瑾恒泽悦晴禾' }).expect(200);
    expect(response.body.data.list).toEqual([]);
    expect(response.body.data.pagination).toMatchObject({ total: 0, totalPages: 0 });
  });
});

describe('local name favorites and copying', () => {
  const item = filterNameLibrary({ surname: '林', pageSize: 1 }).list[0];

  it('keeps different surnames distinct and rejects corrupt local records', () => {
    const other = { ...item, fullName: `张${item.givenName}` };
    expect(nameFavoriteKey(item)).not.toBe(nameFavoriteKey(other));
    expect(readNameFavorites([null, {}, item, item, { ...item, contentOrigin: 'unknown' }, other])).toEqual([item, other]);
    expect(readNameFavorites('invalid JSON')).toEqual([]);
  });

  it('retains disclosure and reference in text copied for family discussion', () => {
    const text = nameCopyText(item);
    expect(text).toContain(item.fullName);
    expect(text).toContain(item.source);
    expect(text).toContain('AI 辅助整理');
    expect(text).toContain('待人工复核');
  });
});
