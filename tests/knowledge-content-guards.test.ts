import { getDatasetKnowledgeDropReason, isOutOfScopeKnowledgeQuery } from '../src/utils/knowledge-content-guard';
import { searchQA } from '../src/services/knowledge.service';

describe('knowledge content guards', () => {
  it('rejects dataset records outside the maternal-infant app scope', () => {
    expect(getDatasetKnowledgeDropReason({
      question: '全部症状：怕冷，阳痿早泄，痰多，皮肤发紫',
      answer: '症状处理建议',
      category: 'common-symptoms',
      tags: ['母婴'],
    })).toBe('missing_product_scope');

    expect(getDatasetKnowledgeDropReason({
      question: '女我今年31岁了从小胸就小，想试试手术隆胸',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('missing_product_scope');

    expect(getDatasetKnowledgeDropReason({
      question: '宝宝发烧怎么办',
      answer: '发热时观察体温、精神状态和进食情况。',
      category: 'common-symptoms',
      tags: ['母婴'],
    })).toBeNull();
  });

  it('rejects adolescent, research, and high-sensitivity dataset records', () => {
    expect(getDatasetKnowledgeDropReason({
      question: '孩子青春期发育太快怎么办',
      answer: '青春期发育建议',
      category: 'common-development',
    })).toBe('beyond_app_child_age');

    expect(getDatasetKnowledgeDropReason({
      question: '中文调研问卷和母婴小程序有什么关系',
      answer: '调查问卷',
      category: 'common-symptoms',
    })).toBe('non_content_or_research');

    expect(getDatasetKnowledgeDropReason({
      question: '怀孕六个月胎儿畸形，医生建议引产怎么办',
      answer: '症状处理建议',
      category: 'pregnancy-mid',
    })).toBe('high_sensitivity_dataset_topic');
  });

  it('rejects obvious off-scope search queries before random authority boosting', () => {
    expect(isOutOfScopeKnowledgeQuery('中文调研')).toBe(true);
    expect(isOutOfScopeKnowledgeQuery('青春期发育')).toBe(true);
    expect(isOutOfScopeKnowledgeQuery('阳痿早泄')).toBe(true);
    expect(isOutOfScopeKnowledgeQuery('育儿补贴怎么领取')).toBe(true);
    expect(isOutOfScopeKnowledgeQuery('宝宝发烧怎么办')).toBe(false);
  });

  it('does not return unrelated authority records for off-topic or unmatched searches', () => {
    expect(searchQA('中文调研', { limit: 5 })).toEqual([]);
    expect(searchQA('阳痿早泄', { limit: 5 })).toEqual([]);
    expect(searchQA('育儿补贴', { limit: 5 })).toEqual([]);
    expect(searchQA('完全无关的随机词条', { limit: 5 })).toEqual([]);
  });
});
