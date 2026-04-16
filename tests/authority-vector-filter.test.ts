import {
  shouldPublishAuthorityVectorDocument,
  shouldUseAuthorityVectorSupplement,
} from '../src/utils/authority-vector-filter';

describe('authority vector filter', () => {
  it('publishes only official authority documents', () => {
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
      sourceOrg: '有来医生',
      sourceClass: 'medical_platform',
      authoritative: true,
    })).toBe(false);

    expect(shouldPublishAuthorityVectorDocument({
      title: '中国政府网政策解读：生育支持措施',
      topic: 'policy',
      sourceOrg: '中国政府网',
      sourceClass: 'official',
      authoritative: true,
    })).toBe(false);
  });

  it('blocks noisy vector supplements but tolerates legacy records without sourceClass', () => {
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
  });
});
