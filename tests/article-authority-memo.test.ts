import fs from 'fs';
import { Request, Response } from 'express';
import { buildStableAuthoritySlug } from '../src/utils/authority-identity';
import * as adapter from '../src/services/authority-adapters/base.adapter';
import { getArticleBySlug } from '../src/controllers/article.controller';

jest.mock('fs');
jest.mock('../src/config/database', () => ({ __esModule: true, default: { $queryRawUnsafe: jest.fn().mockResolvedValue([]) } }));
const mockedFs = jest.mocked(fs);
const source = {
  id: 'authority-chinacdc-nutrition-sample', source_id: 'chinacdc-nutrition', source_org: '中国疾病预防控制中心营养与健康所',
  source_url: 'https://www.chinacdc.cn/jkkp/yyjk/rqyy/202408/t20240825_295584.html', source_language: 'zh',
  question: '6-23月龄婴幼儿辅食喂养指南', summary: '婴幼儿满6月龄后添加辅食，并继续母乳喂养。',
  answer: '婴幼儿满6月龄后开始添加辅食，并继续母乳喂养。每天逐步添加多样化食物，观察宝宝的进食情况，特殊情况遵医嘱。'.repeat(6),
  created_at: '2026-11-01', source_updated_at: '2023-11-23', published_at: '2023-11-23',
  region: 'CN', audience: '婴幼儿家长', topic: 'feeding', category: 'feeding', is_verified: true,
};

afterEach(() => jest.restoreAllMocks());
it('reuses the prepared corpus during reads and refreshes after a source file change', async () => {
  let mtimeMs = 1;
  let currentSource = { ...source };
  mockedFs.existsSync.mockImplementation(p => String(p).includes('authority-knowledge-cache'));
  mockedFs.statSync.mockImplementation(() => ({ mtimeMs, size: 1000 }) as fs.Stats);
  mockedFs.readFileSync.mockImplementation(() => JSON.stringify([currentSource]));
  const prepare = jest.spyOn(adapter, 'detectTopic');
  const req = { params: { slug: buildStableAuthoritySlug(source, 0) }, headers: { 'x-knowledge-layout': 'warmup' }, socket: { remoteAddress: '127.0.0.1' } } as unknown as Request;
  const json = jest.fn();
  const next = jest.fn();
  const read = () => getArticleBySlug(req, { json } as unknown as Response, next);
  await read();
  expect(next).not.toHaveBeenCalled();
  expect(json).toHaveBeenCalled();
  expect(prepare).toHaveBeenCalled();
  prepare.mockClear();
  await read();
  expect(prepare).not.toHaveBeenCalled();
  currentSource = { ...source, answer: source.answer + '新增来源段落。' };
  mtimeMs += 1;
  await read();
  expect(prepare).toHaveBeenCalled();
  expect(json.mock.calls.at(-1)![0].data.content).toContain('新增来源段落');
});
