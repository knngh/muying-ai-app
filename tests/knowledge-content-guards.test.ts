import {
  containsDeathRelatedTerms,
  getAuthorityKnowledgeDropReason,
  getDatasetKnowledgeDropReason,
  isOutOfScopeKnowledgeQuery,
} from '../src/utils/knowledge-content-guard';
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

    expect(getDatasetKnowledgeDropReason({
      question: '怀孕后胎停会不会导致死胎',
      answer: '症状处理建议',
      category: 'pregnancy-early',
    })).toBe('high_sensitivity_dataset_topic');

    expect(getDatasetKnowledgeDropReason({
      question: '怀孕两个月想吃药打掉孩子怎么办',
      answer: '症状处理建议',
      category: 'pregnancy-early',
    })).toBe('high_sensitivity_dataset_topic');
  });

  it('rejects obvious off-scope search queries before random authority boosting', () => {
    expect(isOutOfScopeKnowledgeQuery('中文调研')).toBe(true);
    expect(isOutOfScopeKnowledgeQuery('青春期发育')).toBe(true);
    expect(isOutOfScopeKnowledgeQuery('阳痿早泄')).toBe(true);
    expect(isOutOfScopeKnowledgeQuery('育儿补贴怎么领取')).toBe(true);
    expect(isOutOfScopeKnowledgeQuery('孕产妇死亡率')).toBe(true);
    expect(isOutOfScopeKnowledgeQuery('死产和死胎')).toBe(true);
    expect(isOutOfScopeKnowledgeQuery('胎停怎么办')).toBe(true);
    expect(isOutOfScopeKnowledgeQuery('宝宝发烧怎么办')).toBe(false);
  });

  it('does not return unrelated authority records for off-topic or unmatched searches', () => {
    expect(searchQA('中文调研', { limit: 5 })).toEqual([]);
    expect(searchQA('阳痿早泄', { limit: 5 })).toEqual([]);
    expect(searchQA('育儿补贴', { limit: 5 })).toEqual([]);
    expect(searchQA('孕产妇死亡率', { limit: 5 })).toEqual([]);
    expect(searchQA('死产 死胎', { limit: 5 })).toEqual([]);
    expect(searchQA('完全无关的随机词条', { limit: 5 })).toEqual([]);
  });

  it('rejects death-related authority cache records even when terms appear outside the title', () => {
    expect(containsDeathRelatedTerms('降低孕产妇死亡率行动计划')).toBe(true);
    expect(getAuthorityKnowledgeDropReason({
      question: '孕产妇健康行动计划',
      summary: '目标包括降低孕产妇死亡率。',
      answer: '政策解读正文',
      source_org: '中国政府网',
    })).toBe('death_related_term');

    expect(getAuthorityKnowledgeDropReason({
      question: '孕早期出血观察',
      summary: '介绍胎停相关处理。',
      answer: '正文',
      source_org: '权威机构',
    })).toBe('death_related_term');
  });

  it('rejects disabled or social-style third-party Chinese medical cache records', () => {
    expect(getAuthorityKnowledgeDropReason({
      question: '产后盆底肌恢复训练',
      summary: '产后盆底肌恢复需要结合伤口、恶露和盆底功能情况。',
      answer: '产后盆底肌训练应在身体恢复允许时逐步开始，先进行盆底功能评估，再根据漏尿、下坠感、疼痛和腹直肌恢复情况安排训练强度。训练过程中如果出现不适，应暂停并咨询妇产科或盆底康复医生。'.repeat(8),
      source_id: 'yilianmeiti-maternal-child',
      source_org: '医联媒体',
      source_class: 'medical_platform',
      source_url: 'https://www.yilianmeiti.com/article/123.html',
      updated_at: '2026-04-01T00:00:00.000Z',
    })).toBe('medical_platform_disabled_source');

    expect(getAuthorityKnowledgeDropReason({
      question: '吃母乳就是母乳喂养？',
      summary: '母乳喂养指导。',
      answer: '同部门的小李最近升级做了新手妈妈，每天微信朋友圈是各种晒娃，初为人母的幸福可谓溢于言表。一天微信聊天时，她吐槽喂养过程很累。'.repeat(20),
      source_id: 'kepuchina-maternal-child',
      source_org: '科普中国',
      source_class: 'medical_platform',
      source_url: 'https://www.kepuchina.cn/article/articleinfo?ar_id=66617',
      updated_at: '2023-06-01',
    })).toBe('medical_platform_casual_or_promotional');
  });

  it('keeps high-quality enabled third-party Chinese medical cache records', () => {
    expect(getAuthorityKnowledgeDropReason({
      question: '孕期体重管理和营养建议',
      summary: '孕期体重管理应结合孕前体重、孕周和胎儿发育情况。',
      answer: '孕期体重管理应结合孕前体重、孕周和胎儿发育情况，饮食上保持主食、优质蛋白、蔬菜水果和奶类摄入，避免长期高糖高油饮食。若体重增长过快或过慢，应咨询产科医生并结合产检结果调整。'.repeat(8),
      source_id: 'youlai-pregnancy-guide',
      source_org: '有来医生',
      source_class: 'medical_platform',
      source_url: 'https://m.youlai.cn/special/advisor/dOP09kv7LD.html',
      updated_at: '2025-03-01T00:00:00.000Z',
    })).toBeNull();
  });
});
