import { inferAuthorityStages } from '../src/utils/authority-stage';
import { shouldFilterAuthoritySourceUrl } from '../src/utils/authority-source-url';

describe('authority content guards', () => {
  it('keeps explicit pregnancy week guides on the pregnancy timeline only', () => {
    expect(
      inferAuthorityStages({
        title: '孕期全指导：怀孕第40周',
        summary: '本周继续关注分娩准备与产检安排。',
        contentText: '本周内容会提到分娩和新生儿适应，但仍属于孕晚期周度指导。',
        audience: '孕妇',
        topic: 'policy',
      }),
    ).toEqual(['third-trimester']);
  });

  it('does not classify baby articles as postpartum only because summary mentions after birth', () => {
    const stages = inferAuthorityStages({
      title: "Your Baby's Head",
      summary: 'In the first weeks after birth, your baby may still have molding of the skull.',
      contentText: 'This article explains normal newborn head shape changes.',
      audience: '婴幼儿家长',
      topic: 'development',
    });

    expect(stages).not.toContain('postpartum');
    expect(stages).not.toContain('1-3-years');
  });

  it('filters site index and generic CDC landing pages', () => {
    expect(
      shouldFilterAuthoritySourceUrl({
        source_org: 'CDC',
        question: 'Índice del sitio | Child Development | CDC',
        source_url: 'https://www.cdc.gov/child-development/es/site.html',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_org: 'CDC',
        question: 'Child Development | CDC',
        source_url: 'https://www.cdc.gov/child-development/index.html',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_org: 'CDC',
        question: 'Information About Infants & Toddlers (Ages 0-3) | Parent Information | CDC',
        source_url: 'https://www.cdc.gov/parents/infants/index.html',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_org: 'CDC',
        question: 'Información para los padres de niños | CDC',
        source_url: 'https://www.cdc.gov/parents/spanish/children/index.html',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_org: 'CDC',
        question: 'Hearing Loss in Children | Hearing Loss in Children | CDC',
        source_url: 'https://www.cdc.gov/ncbddd/hearingloss/index.html',
      }),
    ).toBe(true);
  });
});
