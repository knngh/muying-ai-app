import type { AuthoritySourceConfig } from '../../config/authority-sources';
import type { AuthorityRawDocument, NormalizedAuthorityDocument } from '../authority-sync.service';
import {
  detectAudience,
  detectRiskLevelDefault,
  detectTopic,
  extractMetaContent,
  extractTitle,
  isMaternalInfantRelevant,
  shouldPublishDocument,
  stripHtml,
  type AuthorityDocumentAdapter,
} from './base.adapter';

function extractCnHealthContent(rawBody: string): string {
  const candidates = [
    rawBody.match(/<div[^>]+id=["']detailContent["'][\s\S]*?>([\s\S]*?)<\/div>/i)?.[1],
    rawBody.match(/<div[^>]+id=["']UCAP-CONTENT["'][\s\S]*?>([\s\S]*?)<\/div>/i)?.[1],
    rawBody.match(/<div[^>]+class=["'][^"']*(pages_content|TRS_Editor|trs_editor_view|article-content|wp_articlecontent)[^"']*["'][\s\S]*?>([\s\S]*?)<\/div>/i)?.[2],
    rawBody.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i)?.[1],
    rawBody.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i)?.[1],
    rawBody.match(/<div[^>]+id=["'][^"']*(zoom|article|content)[^"']*["'][\s\S]*?>([\s\S]*?)<\/div>/i)?.[2],
    rawBody.match(/<div[^>]+class=["'][^"']*(content|content-box|detail)[^"']*["'][\s\S]*?>([\s\S]*?)<\/div>/i)?.[2],
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const text = stripHtml(candidate);
    if (text.length >= 120) {
      return text;
    }
  }

  return stripHtml(rawBody);
}

function extractSourceSpecificCnContentCandidates(source: AuthoritySourceConfig, rawBody: string): Array<string | undefined> {
  if (source.id === 'ncwch-maternal-child-health') {
    return [
      rawBody.match(/<div[^>]+id=["']content["'][^>]*>([\s\S]*?)<\/div>\s*<p>/i)?.[1],
      rawBody.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i)?.[1],
    ];
  }

  if (source.id === 'mchscn-monitoring') {
    return [
      rawBody.match(/<div[^>]+class=["'][^"']*news-show[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*(?:<div[^>]+style=|<\/div>\s*<div class=["']clr)/i)?.[1],
    ];
  }

  if (source.id === 'cnsoc-dietary-guidelines') {
    return [
      rawBody.match(/<div[^>]+class=["'][^"']*\bcon\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i)?.[1],
      rawBody.match(/<div[^>]+class=["'][^"']*news-show[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1],
    ];
  }

  if (source.id === 'chinanutri-maternal-child') {
    return [
      rawBody.match(/<div[^>]+id=["']UCAP-CONTENT["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
      rawBody.match(/<div[^>]+class=["'][^"']*(TRS_Editor|trs_editor_view|article-content|wp_articlecontent)[^"']*["'][\s\S]*?>([\s\S]*?)<\/div>/i)?.[2],
    ];
  }

  return [];
}

function extractSourceSpecificCnContent(source: AuthoritySourceConfig, rawBody: string): string {
  const candidates = extractSourceSpecificCnContentCandidates(source, rawBody);

  for (const candidate of candidates.filter(Boolean) as string[]) {
    const text = stripHtml(candidate);
    if (text.length >= 80) {
      return text;
    }
  }

  return extractCnHealthContent(rawBody);
}

function countSourceSpecificContentImages(source: AuthoritySourceConfig, rawBody: string): number {
  return extractSourceSpecificCnContentCandidates(source, rawBody)
    .filter(Boolean)
    .reduce((total, html) => total + (html?.match(/<img\b/gi)?.length || 0), 0);
}

function normalizeCnHealthTitle(title: string): string {
  return title
    .replace(/_[^_]+_中国政府网$/u, '')
    .replace(/_中国政府网$/u, '')
    .replace(/[-_]\s*国家卫生健康委员会(?:妇幼健康司|人口监测与家庭发展司)?$/u, '')
    .replace(/[-_]\s*国家疾病预防控制局$/u, '')
    .replace(/[-_]\s*国家卫生健康委妇幼健康中心$/u, '')
    .replace(/[-_]\s*全国妇幼卫生监测办公室(?:\/中国出生缺陷监测中心)?$/u, '')
    .replace(/[-_]\s*中国营养学会(?:\/中国居民膳食指南)?$/u, '')
    .replace(/[-_]\s*中国疾病预防控制中心营养与健康所$/u, '')
    .replace(/[-_]\s*中国疾病预防控制中心$/u, '')
    .trim();
}

function extractSourceSpecificCnTitle(source: AuthoritySourceConfig, rawBody: string): string {
  const candidates: Array<string | undefined> = [];

  if (source.id === 'ncwch-maternal-child-health') {
    candidates.push(
      rawBody.match(/<article[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1],
    );
  } else if (source.id === 'mchscn-monitoring') {
    candidates.push(
      rawBody.match(/<div[^>]+class=["'][^"']*\bbi\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
    );
  } else if (source.id === 'cnsoc-dietary-guidelines') {
    candidates.push(
      rawBody.match(/<div[^>]+class=["'][^"']*news-show[^"']*["'][\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1],
    );
  }

  for (const candidate of candidates.filter(Boolean) as string[]) {
    const title = normalizeCnHealthTitle(stripHtml(candidate));
    if (title) {
      return title;
    }
  }

  return normalizeCnHealthTitle(extractTitle(rawBody));
}

function normalizeCnHealthUpdatedAt(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}-\d{2}:\d{2}:\d{2}$/u.test(normalized)) {
    return normalized.replace(/^(\d{4}-\d{2}-\d{2})-(\d{2}:\d{2}:\d{2})$/u, '$1 $2');
  }

  return normalized;
}

function isLikelyCnNavigationDocument(source: AuthoritySourceConfig, title: string, contentText: string): boolean {
  const normalizedTitle = title.trim();
  const compactContent = contentText.replace(/\s+/g, '');

  if (/^(首页|网站首页|新闻中心|图片新闻|文字新闻|技术规范|工作指南|监测结果|通讯专栏|继续教育|基层交流|共享资源|调查问卷|关于我们|国际合作|期刊杂志|工作动态|科普知识|政策文件|科研成果|科研动态|项目申报|学习园地|中心党建|地方经验|通知公告|行业动态|科普宣传|中国居民膳食指南|中国妇幼健康监测)$/u.test(normalizedTitle)) {
    return true;
  }

  if (source.id === 'chinanutri-maternal-child'
    && /(?:营养所|学术年会|民主生活会|工会|联欢会|招生|招聘|课题招标|公开征求意见)/u.test(normalizedTitle)
    && !/(儿童|婴幼儿|孕妇|孕产|乳母|母乳|喂养|辅食|膳食指南|营养健康提示)/u.test(normalizedTitle)) {
    return true;
  }

  const navSignals = (compactContent.match(/(首页|新闻中心|联系我们|关于我们|搜索|版权所有|备案|网站地图|技术支持|栏目|更多)/gu) || []).length;
  const topicSignals = (compactContent.match(/(孕产|孕妇|产后|儿童|婴幼儿|新生儿|母乳|喂养|辅食|营养|膳食|疫苗|出生缺陷|托育|体重管理|发育)/gu) || []).length;

  return navSignals >= 6 && topicSignals <= 2;
}

export const cnHealthAdapter: AuthorityDocumentAdapter = {
  id: 'cn-health',
  supports(source: AuthoritySourceConfig, raw: AuthorityRawDocument): boolean {
    return source.parserId === 'cn-health'
      || /nhc\.gov\.cn|chinacdc\.cn|gov\.cn|ncwchnhc\.org\.cn|mchscn\.cn|cnsoc\.org|chinanutri\.cn/i.test(raw.url);
  },
  normalize(source: AuthoritySourceConfig, raw: AuthorityRawDocument): NormalizedAuthorityDocument | null {
    const title = extractSourceSpecificCnTitle(source, raw.rawBody);
    const description = extractMetaContent(raw.rawBody, 'description');
    const contentText = extractSourceSpecificCnContent(source, raw.rawBody);
    const imageCount = countSourceSpecificContentImages(source, raw.rawBody);
    const mergedText = `${title} ${description || ''} ${contentText}`;
    const ocrCandidate = imageCount > 0
      && contentText.length < 300
      && isMaternalInfantRelevant(raw.url, title, mergedText);
    if ((!contentText || contentText.length < 120) && !ocrCandidate) {
      return null;
    }

    if (isLikelyCnNavigationDocument(source, title, contentText)) {
      return null;
    }

    if (!isMaternalInfantRelevant(raw.url, title, mergedText)) {
      return null;
    }

    const document: NormalizedAuthorityDocument = {
      sourceId: source.id,
      sourceOrg: source.org,
      sourceUrl: raw.url,
      title,
      updatedAt: normalizeCnHealthUpdatedAt(
        extractMetaContent(raw.rawBody, 'article:published_time')
        || extractMetaContent(raw.rawBody, 'article:modified_time')
        || extractMetaContent(raw.rawBody, 'firstpublishedtime')
        || extractMetaContent(raw.rawBody, 'lastmodifiedtime')
        || extractMetaContent(raw.rawBody, 'publishdate')
        || extractMetaContent(raw.rawBody, 'PubDate')
        || raw.lastModified
      ),
      audience: detectAudience({ sourceUrl: raw.url, title, summary: description, contentText }, source),
      topic: detectTopic({ sourceUrl: raw.url, title, summary: description, contentText }, source),
      region: source.region,
      riskLevelDefault: detectRiskLevelDefault(mergedText),
      summary: (description || contentText).slice(0, 300),
      contentText,
      metadataJson: {
        parserId: 'cn-health',
        contentType: raw.contentType,
        fetchedAt: raw.fetchedAt,
        imageCount,
        ocrCandidate,
      },
      publishStatus: 'draft',
    };

    document.publishStatus = shouldPublishDocument(document);
    return document;
  },
};
