import {
  shouldPublishAuthorityVectorDocument,
  shouldUseAuthorityVectorSupplement,
} from '../src/utils/authority-vector-filter';

describe('authority vector filter', () => {
  it('publishes official and high-quality medical-platform authority documents', () => {
    expect(shouldPublishAuthorityVectorDocument({
      title: '孕早期见红怎么办',
      topic: 'pregnancy-early',
      sourceOrg: 'CDC',
      sourceClass: 'official',
      authoritative: true,
    })).toBe(true);

    expect(shouldPublishAuthorityVectorDocument({
      title: '孕期全指导：怀孕第40周',
      topic: 'pregnancy-late',
      answer: '本周继续关注分娩准备与产检安排。'.repeat(40),
      sourceOrg: '有来医生',
      sourceClass: 'medical_platform',
      authoritative: true,
    })).toBe(false);

    expect(shouldPublishAuthorityVectorDocument({
      title: '母乳喂养常见问题',
      topic: 'feeding',
      answer: '母乳喂养时应关注宝宝含接姿势、尿量、体重增长和妈妈乳房舒适度。若出现持续疼痛、乳头破损或宝宝体重增长不足，应及时咨询儿科或产科医生。'.repeat(8),
      sourceOrg: '有来医生',
      sourceClass: 'medical_platform',
      authoritative: true,
    })).toBe(true);

    expect(shouldPublishAuthorityVectorDocument({
      title: '中国政府网政策解读：生育支持措施',
      topic: 'policy',
      sourceOrg: '中国政府网',
      sourceClass: 'official',
      authoritative: true,
    })).toBe(false);

    expect(shouldPublishAuthorityVectorDocument({
      title: '降低孕产妇死亡率行动计划解读',
      topic: 'pregnancy',
      sourceOrg: '国家卫健委',
      sourceClass: 'official',
      authoritative: true,
    })).toBe(false);
  });

  it('blocks disabled or noisy vector supplements but tolerates legacy records without sourceClass', () => {
    expect(shouldUseAuthorityVectorSupplement({
      title: 'Permanent Contraception | Contraception | CDC',
      category: 'pregnancy-late',
      sourceOrg: 'CDC',
    })).toBe(false);

    expect(shouldUseAuthorityVectorSupplement({
      title: '孕晚期脚肿怎么办',
      category: 'pregnancy-late',
      sourceOrg: 'Mayo Clinic',
    })).toBe(true);

    expect(shouldUseAuthorityVectorSupplement({
      title: '孕晚期脚肿怎么办',
      category: 'pregnancy-late',
      sourceOrg: '丁香医生',
      sourceClass: 'medical_platform',
    })).toBe(false);

    expect(shouldUseAuthorityVectorSupplement({
      title: '产后盆底肌恢复训练',
      category: 'postpartum',
      answer: '产后盆底肌恢复应在恶露、伤口和整体恢复情况允许时逐步开始，训练前可先做盆底功能评估。若存在漏尿、下坠感或疼痛，应咨询妇产科或盆底康复医生。'.repeat(8),
      sourceOrg: '医联媒体',
      sourceClass: 'medical_platform',
    })).toBe(false);

    expect(shouldUseAuthorityVectorSupplement({
      title: '孕产妇健康计划',
      summary: '包含死亡率统计口径。',
      category: 'pregnancy',
      sourceOrg: 'CDC',
      sourceClass: 'official',
    })).toBe(false);
  });
});
