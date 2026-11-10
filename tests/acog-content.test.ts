import { stripAcogArticleChrome } from '../src/utils/acog-content';
import { sanitizeTranslationText } from '../src/utils/article-translation';
import { acogAdapter } from '../src/services/authority-adapters/acog.adapter';
import { getAuthoritySourceConfig } from '../src/config/authority-sources';

const body = 'Newborn babies have low levels of vitamin K. A vitamin K injection helps prevent serious bleeding. Ask your ob-gyn before taking medicines. Children need two doses of MMR vaccine, at 12 to 15 months and 4 to 6 years.';
const chineseBody = '新生儿体内维生素K水平较低。注射维生素K有助于预防严重出血。儿童应接种两剂MMR疫苗，分别在12至15个月和4至6岁接种。';

describe('ACOG source chrome removal', () => {
  it('removes the complete source promotion and related-question footer while retaining medical text', () => {
    const input = `Ask ACOG Why does my newborn need vitamin K? Share Facebook Email Link URL has been copied to the clipboard Close Print ${body} About Ask ACOG Do you have a question about women’s health? ACOG is here with answers to help you stay healthy. Browse all questions. Go Published: April 2026 What to Read Next Ask ACOG Is acetaminophen safe during pregnancy?`;
    expect(stripAcogArticleChrome(input)).toBe(body);
  });
  it.each(['关于问ACOG', '关于询问 ACOG', '关于Ask ACOG', '关于ACOG 你对女性健康有疑问吗？', '关于ACOG问答 你对女性健康有疑问吗？', 'ACOG在这里为您提供答案，帮助您保持健康。浏览所有问题。', '接下来阅读', '接下来阅读什么'])('cleans legacy translated footer: %s', marker => {
    expect(sanitizeTranslationText(`${chineseBody}\n\n${marker}\n问ACOG 孕期服用对乙酰氨基酚安全吗？\n问ACOG 我应该在孕期接种RSV疫苗吗？`, 'content')).toBe(chineseBody);
  });
  it.each(['分享到Facebook 电子邮件 链接URL已复制到剪贴板 关闭 打印', '分享 Facebook 电子邮件 链接 URL 已复制到剪贴板 关闭 打印'])('removes translated toolbar variants: %s', toolbar => {
    expect(stripAcogArticleChrome(`问ACOG 孕期接种疫苗安全吗？ ${toolbar} ${chineseBody}`)).toBe(chineseBody);
  });
  it.each(['Leer en español', '广告 ACOG不认可任何公司或产品。', 'Advertisement ACOG does not endorse any companies or products.'])('removes source controls without changing medical body: %s', control => {
    expect(stripAcogArticleChrome(`${control} ${chineseBody}`)).toBe(chineseBody);
  });
  it('removes translated copyright and promotional library sections from infographic text', () => {
    const article = '孕期接种疫苗有助于保护宝宝。';
    const footer = '版权所有 2024年，美国妇产科医师学会。主题：妊娠与疫苗。临床医生：订购数字手册。探索ACOG的患者教育手册库。';
    expect(stripAcogArticleChrome(`${article}\n\n${footer}`)).toBe(article);
  });
  it('keeps an ACOG article title, medical questions, warnings, dates and citations in the actual body', () => {
    const input = `问ACOG 孕期服用对乙酰氨基酚安全吗？\n${chineseBody}\n何时应咨询医生？\n2025年1月的研究引用了ACOG指南。不要自行停用医生开的药物。`;
    expect(stripAcogArticleChrome(input)).toBe(input);
    expect(stripAcogArticleChrome('Ask ACOG whether this treatment is suitable for your pregnancy.')).toContain('Ask ACOG whether');
    expect(sanitizeTranslationText('接下来阅读检查报告的注意事项，请向医生咨询。', 'content')).toBe('接下来阅读检查报告的注意事项，请向医生咨询。');
  });
  it('keeps all nested body sections and excludes promotion before normalization', () => {
    const rawBody = `<title>Why does my newborn need vitamin K?</title><main><div class="article-body"><div><p>${body}</p></div><p>Do not stop a prescribed medicine without discussing it with your doctor.</p></div><a class="promo-cta"><h3>About Ask ACOG</h3><p>Browse all questions.</p></a><div class="promo-grid-related">What to Read Next Ask ACOG Pregnancy medicines</div></main>`;
    const normalized = acogAdapter.normalize(getAuthoritySourceConfig('acog')!, { sourceId: 'acog', url: 'https://www.acog.org/womens-health/experts-and-stories/ask-acog/why-does-my-newborn-need-vitamin-k', httpStatus: 200, rawBody, contentType: 'text/html', contentHash: 'fixture', fetchedAt: '2026-11-09T00:00:00Z' });
    expect(normalized?.contentText).toContain(body);
    expect(normalized?.contentText).toContain('Do not stop a prescribed medicine');
    expect(normalized?.contentText).not.toMatch(/Browse all|What to Read Next|Pregnancy medicines/);
  });
});
