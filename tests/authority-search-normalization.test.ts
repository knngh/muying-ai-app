import { normalizeAuthorityKnowledgeRecord } from '../src/services/knowledge.service';

describe('authority search normalization', () => {
  it('normalizes pregnancy week guides to pregnancy topic and trimester stage', () => {
    const normalized = normalizeAuthorityKnowledgeRecord({
      id: 'authority-youlai-pregnancy-guide-1',
      question: '孕期全指导：怀孕第40周',
      answer: '本周重点关注宫缩、破水、见红与入院准备。',
      category: 'policy',
      tags: [],
      target_stage: [],
      difficulty: 'authoritative',
      read_time: 5,
      author: { name: '有来医生', title: 'Authority Source' },
      is_verified: true,
      status: 'published',
      view_count: 0,
      like_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
      source: '有来医生',
      source_id: 'youlai-pregnancy-guide',
      source_org: '有来医生',
      source_url: 'https://m.youlai.cn/special/advisor/is6ZVBe9iL.html',
      audience: '孕妇',
      topic: 'policy',
      original_id: 'test-1',
    });

    expect(normalized.category).toBe('pregnancy');
    expect(normalized.target_stage).toContain('third-trimester');
    expect(normalized.target_stage).not.toContain('newborn');
    expect(normalized.target_stage).not.toContain('0-6-months');
  });

  it('normalizes baby developmental content away from vaccination category drift', () => {
    const normalized = normalizeAuthorityKnowledgeRecord({
      id: 'authority-aap-201',
      question: "Your Baby's Head - HealthyChildren.org",
      answer: 'This article explains normal newborn head shape, fontanelles, and when to call the pediatrician.',
      category: 'vaccination',
      tags: ['疫苗'],
      target_stage: [],
      difficulty: 'authoritative',
      read_time: 5,
      author: { name: 'AAP', title: 'Authority Source' },
      is_verified: true,
      status: 'published',
      view_count: 0,
      like_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
      source: 'AAP',
      source_id: 'aap',
      source_org: 'AAP',
      source_url: 'https://www.healthychildren.org/English/ages-stages/baby/Pages/Your-Babys-Head.aspx',
      audience: '婴幼儿家长',
      topic: 'vaccination',
      original_id: 'test-2',
    });

    expect(normalized.category).toBe('development');
    expect(normalized.tags).toContain('成长发育');
    expect(normalized.target_stage).toEqual(['0-6-months', '6-12-months']);
  });
});
