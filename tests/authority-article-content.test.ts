import { stripAuthorityArticleChrome } from '../src/utils/authority-article-content';
import { stripAcogArticleChrome } from '../src/utils/acog-content';
import { normalizeWithAuthorityAdapter } from '../src/services/authority-adapters';
import { getAuthoritySourceConfig } from '../src/config/authority-sources';

const medical = '出现阴道出血、胃痛或骨盆疼痛时，请及时寻求医疗建议。';
const references = '参考文献 Martin RJ. Neonatal-Perinatal Medicine. Elsevier; 2025:chap 50.';

describe('source-aware article footer cleanup', () => {
  it('cleans newly crawled content before persistence and rechecks publication quality', () => {
    const medicalBody = 'Pregnancy care includes regular appointments with your midwife. Talk to your doctor about symptoms and any concerns during pregnancy. '.repeat(20);
    const source = getAuthoritySourceConfig('nhs')!;
    const document = normalizeWithAuthorityAdapter(source, {
      sourceId: source.id, url: 'https://www.nhs.uk/pregnancy/keeping-well/vitamins/', httpStatus: 200,
      contentType: 'text/html', contentHash: 'fixture', fetchedAt: '2026-11-10T00:00:00Z',
      rawBody: `<title>Pregnancy care</title><main><p>${medicalBody}</p><p>Get Best Start in Life pregnancy and baby emails Sign up for emails.</p></main>`,
    });
    expect(document?.contentText).toContain(medicalBody.trim());
    expect(document?.contentText).not.toMatch(/Sign up|baby emails/);
    expect(document?.publishStatus).toBe('published');
  });

  it.each([
    '文章继续如下 广告 如果您有进一步问题，请联系您的产科医生。FAQ531 最后更新：2026年11月',
    '下文将继续。广告：如有更多疑问，请咨询您的妇产科医生。常见问题 500。最后更新：2026年9月',
    '文章其余部分见下方广告。如果您有更多疑问，请联系您的妇产科医生。',
    '文章继续以下 advertisement 如果您有进一步的问题，请联系您的产科医生。',
    '文章下文继续\n广告\n如果您有进一步的问题，请联系您的产科医师。',
    'FAQ534 最后更新：2026年9月 最后审核：2026年5月 主题：孕期疫苗',
  ])('removes observed translated ACOG footer: %s', footer => {
    expect(stripAcogArticleChrome(`${medical}\n${footer}`)).toBe(medical);
  });

  it.each([
    'Review Date 10/7/2025 Updated by: Neil K. Kaneshiro, MD. Learn how to cite this page',
    '审核日期：2025年10月7日 更新者：Neil K. Kaneshiro, MD。相关MedlinePlus健康主题',
    '审查日期 10/7/2025 由 Neil K. Kaneshiro, MD 审核。浏览百科全书',
    '审阅日期 2026 年 5 月 29 日更新者：LaQuita Martinez, MD',
  ])('removes MedlinePlus editorial biographies while keeping medical references', footer => {
    expect(stripAuthorityArticleChrome(`${medical}\n${references}\n${footer}`, { source_id: 'medlineplus' }))
      .toBe(`${medical}\n${references}`);
  });

  it('removes inline NHS media dates without deleting subsequent urgent advice', () => {
    const input = `视频介绍。\n媒体上次审查：2026年3月9日 媒体审查到期：2029年3月9日\n${medical}\n获取“人生最佳开端”怀孕和婴儿电子邮件 注册接收邮件。`;
    const cleaned = stripAuthorityArticleChrome(input, { slug: 'authority-nhs-1bf2gt' });
    expect(cleaned).toContain(medical);
    expect(cleaned).toContain('视频介绍。');
    expect(cleaned).not.toMatch(/媒体.*审查|电子邮件|注册接收/);
  });

  it('removes English NHS navigation and inline media dates', () => {
    const input = `Video. Media last reviewed: 9 March 2026 Media review due: 9 March 2029 ${medical} More in Trying for a baby Doing a pregnancy test Page last reviewed: 31 July 2026 Next review due: 31 July 2029`;
    expect(stripAuthorityArticleChrome(input, { sourceId: 'nhs' })).toBe(`Video.   ${medical}`);
  });

  it('preserves NHS support for unplanned pregnancy after an inline email signup', () => {
    const advice = '意外怀孕或不确定？了解可选方案，并向助产士寻求支持。';
    const text = `验孕后可预约就诊。订阅“人生最佳开端”的怀孕和育儿电子邮件，获取针对您孕期阶段或孩子年龄的建议和支持。${advice}`;
    const cleaned = stripAuthorityArticleChrome(text, { source_id: 'nhs' });
    expect(cleaned).toBe(`验孕后可预约就诊。${advice}`);
  });

  it('removes a terminal NHS link list from a previously cleaned translation', () => {
    const text = `${medical}\n\n更多信息：\n发现怀孕后该做什么\n怀孕期间的NHS产科护理与福利`;
    expect(stripAuthorityArticleChrome(text, { source_id: 'nhs' })).toBe(medical);
    const advice = `${medical}\n\n更多信息：请访问BUMPS网站，了解孕期用药对您和宝宝的影响。`;
    expect(stripAuthorityArticleChrome(advice, { source_id: 'nhs' })).toBe(advice);
  });

  it('removes the observed flattened NHS fetal-movement related-link footer', () => {
    const advice = 'Do not wait until the next day. Contact your midwife immediately, even at night.';
    const footer = "Find out more Tommy’s: baby movements in pregnancy Royal College of Obstetricians and Gynaecologists (RCOG): your baby’s movements in pregnancy Signs that labour has begun";
    expect(stripAuthorityArticleChrome(`${advice} ${footer}`, { source_id: 'nhs' })).toBe(advice);
    const inline = 'Find out more about changes in movements by speaking to your midwife. Do not delay seeking urgent advice.';
    expect(stripAuthorityArticleChrome(inline, { source_id: 'nhs' })).toBe(inline);
  });

  it('removes terminal NHS Find out more headings in source and existing Chinese translations', () => {
    const links = 'Tommy’s: baby movements in pregnancy\nRoyal College of Obstetricians and Gynaecologists (RCOG): your baby’s movements in pregnancy';
    for (const heading of ['Find out more', '了解更多', '了解更多信息']) {
      expect(stripAuthorityArticleChrome(`${medical}\n\n${heading}\n\n${links}`, { source_id: 'nhs' })).toBe(medical);
    }
    const clinical = `${medical}\n\n了解更多信息，请立即联系您的助产士。\n\n胎动减少时不要等到第二天。`;
    expect(stripAuthorityArticleChrome(clinical, { source_id: 'nhs' })).toBe(clinical);
    const englishAdvice = 'Find out more\n\nCall your midwife if movements have changed.\nDo not wait until tomorrow.';
    expect(stripAuthorityArticleChrome(englishAdvice, { source_id: 'nhs' })).toBe(englishAdvice);
  });

  it('removes MSD quiz and copyright widgets while retaining the last treatment paragraph', () => {
    expect(stripAuthorityArticleChrome(`${medical} Test your Knowledge Take a Quiz! 版权所有 © 2026 Merck & Co., Inc. 关于 免责声明`, { source_id: 'msd-manuals-cn' })).toBe(medical);
  });

  it('removes MSD image credits in place without truncating subsequent diagnosis and treatment', () => {
    const text = `便秘的原因。 图片 Copyright © 2025 Merck & Co., Inc., Rahway, NJ, USA and its affiliates. All rights reserved. 不常见原因 约5%的儿童便秘由身体疾病引起。 ${medical}`;
    const cleaned = stripAuthorityArticleChrome(text, { source_id: 'msd-manuals-cn' });
    expect(cleaned).toContain('不常见原因 约5%的儿童便秘由身体疾病引起。');
    expect(cleaned).toContain(medical);
    expect(cleaned).not.toContain('Copyright');
  });

  it('removes AAP related links without removing advice to contact a specialist', () => {
    const body = `${medical} If you have other questions, contact a pediatric anesthesiologist.`;
    expect(stripAuthorityArticleChrome(`${body} Additional Information from HealthyChildren.org: How to Cocoon a Newborn: Only an E-Mail Away!`, { source_id: 'aap' })).toBe(body);
    expect(stripAuthorityArticleChrome(`${medical} 来自HealthyChildren.org的更多信息：如何保护新生儿：只需一封电子邮件！`, { source_id: 'aap' })).toBe(medical);
  });

  it('removes WHO speaker controls after the actual interview', () => {
    expect(stripAuthorityArticleChrome(`${medical} 演讲者简介 SS 苏米娅·斯瓦米纳桑 VGS 维斯米塔·古普塔-史密斯 查看全部剧集`, { source_id: 'who' })).toBe(medical);
  });

  it('removes Mayo promotions in place and keeps symptoms and references after them', () => {
    const input = `${medical} 产品与服务 书籍：《妙佑医疗国际家庭健康手册》 简报：妙佑医疗国际卫生来信 — 数字版 症状 面部出现小肿块。 ${references} 诊断与治疗 疾病与状况 婴儿痤疮 - Symptoms & causes - Mayo Clinic 更多信息 产品与服务 书籍：《妙佑医疗国际家庭健康手册》 CON-20369868`;
    const cleaned = stripAuthorityArticleChrome(input, { source_id: 'mayo-clinic-zh' });
    expect(cleaned).toContain('症状 面部出现小肿块。');
    expect(cleaned).toContain(references);
    expect(cleaned).not.toMatch(/产品与服务|书籍|CON-|疾病与状况/);
  });

  it('does not apply another publisher’s markers or remove ordinary clinical prose', () => {
    const body = `${medical} 了解更多信息，请咨询医生。Review dates help plan follow-up. 广告可能影响儿童的饮食习惯。`;
    for (const source_id of ['nhs', 'aap', 'medlineplus', 'who', 'msd-manuals-cn', 'mayo-clinic-zh', 'cdc']) {
      expect(stripAuthorityArticleChrome(body, { source_id })).toBe(body);
    }
    expect(stripAuthorityArticleChrome('Test your Knowledge Take a Quiz! 临床知识测验研究结果。', { source_id: 'who' }))
      .toBe('Test your Knowledge Take a Quiz! 临床知识测验研究结果。');
  });
});
