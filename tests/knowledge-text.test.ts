import {
  formatKnowledgeStageLabel,
  formatSourceLabel,
  getLocalizedFallbackTitle,
  normalizePlainText,
} from '../shared/utils/knowledge-text';
import {
  buildKnowledgeSourceDigest,
  buildKnowledgeVariantReadingSuggestion,
  buildKnowledgeVariantSortFeedback,
  buildKnowledgeReadingMeta,
  buildKnowledgeReadingPath,
  buildKnowledgeVariantPreview,
  formatKnowledgeDisplayDate,
  getKnowledgeDisplayTitle,
  getKnowledgeSourceSignal,
  isChineseKnowledgeArticle,
  sanitizeAuthoritySourceUrl,
  toReadableUrl,
} from '../shared/utils/knowledge-presentation';

describe('shared knowledge text helpers', () => {
  test('maps authority source labels to consistent Chinese names', () => {
    expect(formatSourceLabel('HealthyChildren.org')).toBe('美国儿科学会');
    expect(formatSourceLabel('CDC')).toBe('美国疾控中心');
    expect(formatSourceLabel('https://www.haodf.com/neirong/wenzhang/9394363019.html')).toBe('好大夫在线');
    expect(formatSourceLabel('https://www.dayi.org.cn/qa/153633.html')).toBe('中国医药信息查询平台');
  });

  test('builds localized fallback titles from topic and stage context', () => {
    expect(getLocalizedFallbackTitle({ topic: 'feeding' })).toBe('喂养与辅食参考');
    expect(getLocalizedFallbackTitle({ stage: '0-6-months' })).toBe('0-6月参考');
  });

  test('normalizes html fragments into readable plain text', () => {
    expect(normalizePlainText('<p>第一句</p><p>第二句</p>')).toBe('第一句 第二句');
    expect(formatKnowledgeStageLabel('third-trimester')).toBe('孕晚期');
  });

  test('builds aligned article display title and date', () => {
    expect(getKnowledgeDisplayTitle({
      title: 'Resource Center',
      topic: 'feeding',
      stage: '0-6-months',
    })).toBe('喂养与辅食参考');

    expect(formatKnowledgeDisplayDate({
      sourceUpdatedAt: '2026-04-20T00:00:00.000Z',
    }, 'iso')).toBe('2026-04-20');
  });

  test('filters generic landing source urls and formats readable urls', () => {
    expect(sanitizeAuthoritySourceUrl('https://www.who.int/news-room', 'WHO')).toBe('');
    expect(toReadableUrl('https://www.cdc.gov/parents/infants/index.html')).toBe('www.cdc.gov/parents/infants/index.html');
  });

  test('builds a staged reading path from article summary, source and content', () => {
    const readingPath = buildKnowledgeReadingPath({
      title: '婴儿发热护理',
      summary: '先看精神状态和体温变化，再决定是否就医。',
      content: '<h2>何时就医</h2><p>如果持续高热或精神差，应尽快就医。</p>',
      sourceOrg: 'WHO',
      topic: 'common-symptoms',
      stage: '0-6-months',
    });

    expect(readingPath.kicker).toBe('阅读路径');
    expect(readingPath.title).toContain('常见症状');
    expect(readingPath.items).toHaveLength(4);
    expect(readingPath.items[1]?.description).toContain('世界卫生组织');
    expect(readingPath.items[2]?.description).toContain('何时就医');
  });

  test('builds reading meta from article body and summary fallback', () => {
    const bodyMeta = buildKnowledgeReadingMeta({
      summary: '这里是摘要。',
      content: '<h2>何时就医</h2><p>如果持续高热或精神差，应尽快就医。</p><h2>居家观察</h2><p>观察精神状态和吃奶情况。</p>',
    });

    expect(bodyMeta.contentMode).toBe('body');
    expect(bodyMeta.estimatedMinutes).toBeGreaterThanOrEqual(1);
    expect(bodyMeta.sectionCount).toBe(2);
    expect(bodyMeta.sectionLabel).toBe('2 个章节');

    const summaryMeta = buildKnowledgeReadingMeta({
      summary: '当前正文暂未同步，建议先阅读摘要并查看来源。',
      content: '',
    });

    expect(summaryMeta.contentMode).toBe('summary');
    expect(summaryMeta.sectionCount).toBe(0);
    expect(summaryMeta.sectionLabel).toBe('摘要阅读');
    expect(summaryMeta.textLengthLabel).toMatch(/^摘要约 /u);

    const emptyMeta = buildKnowledgeReadingMeta({
      summary: '',
      content: '',
    });

    expect(emptyMeta.estimatedMinutes).toBe(0);
    expect(emptyMeta.estimatedMinutesLabel).toBe('待同步');
    expect(emptyMeta.textLength).toBe(0);
    expect(emptyMeta.textLengthLabel).toBe('正文待同步');
    expect(emptyMeta.sectionLabel).toBe('等待正文');
  });

  test('uses list metadata for authority articles whose body is omitted', () => {
    const meta = buildKnowledgeReadingMeta({
      summary: '这是列表摘要，不能用来代表全文阅读时间。',
      content: '',
      readingTime: 4,
      readableTextLength: 1808,
      readableTextUnit: '字',
    });

    expect(meta.contentMode).toBe('body');
    expect(meta.estimatedMinutes).toBe(4);
    expect(meta.estimatedMinutesLabel).toBe('约 4 分钟');
    expect(meta.textLengthLabel).toBe('约 1800 字');
    expect(meta.sectionLabel).toBe('连续阅读');
  });

  test('counts readable English words instead of raw html character length', () => {
    const meta = buildKnowledgeReadingMeta({
      content: '<p>Safe sleep guidance for babies and families.</p><p>https://example.org/a/b</p>',
    });

    expect(meta.textLengthLabel).toBe('约 7 词');
  });

  test('estimates English reading time from word count metadata', () => {
    const meta = buildKnowledgeReadingMeta({
      content: '',
      readableTextLength: 440,
      readableTextUnit: '词',
    });

    expect(meta.textLengthLabel).toBe('约 440 词');
    expect(meta.estimatedMinutesLabel).toBe('约 2 分钟');
  });

  test('builds compact variant preview for merged article versions', () => {
    const preview = buildKnowledgeVariantPreview({
      sourceOrg: 'WHO',
      sourceLanguage: 'en',
      sourceUpdatedAt: '2026-04-20T00:00:00.000Z',
      summary: '这是一个用于比较的摘要。',
      audience: 'pregnancy',
    });

    expect(preview.sourceLabel).toBe('世界卫生组织');
    expect(preview.chips).toContain('国际源');
    expect(preview.chips).toContain('更新 2026/4/20');
    expect(preview.chips.some((item) => item.includes('约'))).toBe(true);
    expect(preview.chips).toContain('适用 孕期');
  });

  test('detects chinese authority sources from metadata and urls', () => {
    expect(isChineseKnowledgeArticle({
      sourceOrg: '国家卫生健康委员会妇幼健康司',
      sourceUrl: 'https://www.nhc.gov.cn/fys/new_index.shtml',
    })).toBe(true);

    expect(isChineseKnowledgeArticle({
      sourceOrg: 'China CDC',
      sourceUrl: 'https://www.chinacdc.cn/jkkp/mygh/',
    })).toBe(true);

    expect(getKnowledgeSourceSignal({
      sourceOrg: 'MSD Manuals',
      sourceUrl: 'https://www.msdmanuals.cn/home/children',
    })).toBe('中文源');

    expect(getKnowledgeSourceSignal({
      sourceOrg: '好大夫在线',
      sourceUrl: 'https://www.haodf.com/neirong/wenzhang/9394363019.html',
    })).toBe('中文源');

    expect(getKnowledgeSourceSignal({
      sourceOrg: '中国医药信息查询平台',
      sourceUrl: 'https://www.dayi.org.cn/qa/153633.html',
    })).toBe('中文源');
  });

  test('builds source digest for visible grouped variants', () => {
    const digest = buildKnowledgeSourceDigest([
      {
        sourceOrg: 'WHO',
        sourceLanguage: 'en',
        sourceLocale: 'en-US',
      },
      {
        sourceOrg: '国家卫生健康委员会',
        sourceLanguage: 'zh',
        sourceLocale: 'zh-CN',
      },
      {
        sourceOrg: 'CDC',
        sourceLanguage: 'en',
        sourceLocale: 'en-US',
      },
    ]);

    expect(digest.summaryLabel).toBe('机构 3 个 · 中文源 1/3');
    expect(digest.description).toContain('世界卫生组织');
    expect(digest.description).toContain('国家卫健委');
    expect(digest.description).toContain('美国疾控中心');
  });

  test('builds reading suggestion when chinese and foreign variants coexist', () => {
    const suggestion = buildKnowledgeVariantReadingSuggestion([
      {
        sourceOrg: 'WHO',
        sourceLanguage: 'en',
        sourceLocale: 'en-US',
      },
      {
        sourceOrg: '国家卫生健康委员会',
        sourceLanguage: 'zh',
        sourceLocale: 'zh-CN',
      },
    ]);

    expect(suggestion.label).toBe('建议先看中文源，再核对国际原文');
    expect(suggestion.description).toContain('中文版本');
  });

  test('builds reading suggestion for multiple foreign institutions', () => {
    const suggestion = buildKnowledgeVariantReadingSuggestion([
      {
        sourceOrg: 'WHO',
        sourceLanguage: 'en',
        sourceLocale: 'en-US',
      },
      {
        sourceOrg: 'CDC',
        sourceLanguage: 'en',
        sourceLocale: 'en-US',
      },
    ]);

    expect(suggestion.label).toBe('建议先看最近版本，再交叉核对机构表述');
    expect(suggestion.description).toContain('多个机构来源');
  });

  test('builds sort feedback for recent and chinese-first modes', () => {
    const recentFeedback = buildKnowledgeVariantSortFeedback([
      {
        sourceOrg: 'WHO',
        sourceLanguage: 'en',
        sourceLocale: 'en-US',
        sourceUpdatedAt: '2026-04-20T00:00:00.000Z',
      },
    ], 'recent');

    expect(recentFeedback?.label).toBe('已按最近更新排序');
    expect(recentFeedback?.description).toContain('世界卫生组织');
    expect(recentFeedback?.description).toContain('2026');

    const zhFirstFeedback = buildKnowledgeVariantSortFeedback([
      {
        sourceOrg: '国家卫生健康委员会',
        sourceLanguage: 'zh',
        sourceLocale: 'zh-CN',
      },
    ], 'zhFirst');

    expect(zhFirstFeedback?.label).toBe('已按中文优先排序');
    expect(zhFirstFeedback?.description).toContain('国家卫健委');
  });
});
