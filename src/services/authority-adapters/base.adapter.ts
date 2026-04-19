import type { AuthorityRawDocument, NormalizedAuthorityDocument } from '../authority-sync.service';
import { OFFICIAL_AUTHORITY_SOURCE_IDS, type AuthoritySourceConfig } from '../../config/authority-sources';

export interface AuthorityDocumentAdapter {
  id: string;
  supports(source: AuthoritySourceConfig, raw: AuthorityRawDocument): boolean;
  normalize(source: AuthoritySourceConfig, raw: AuthorityRawDocument): NormalizedAuthorityDocument | null;
}

interface DetectionInput {
  sourceUrl?: string;
  title?: string;
  summary?: string;
  contentText?: string;
}

export function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeAuthorityTitle(input: string): string {
  return stripHtml(input)
    .replace(/^value is what coveo indexes and uses as the title in search results\.?\s*-*>\s*/i, '')
    .replace(/\s*(?:\||-)\s*(?:HealthyChildren\.org|ACOG|WHO|CDC|NHS|Mayo Clinic|NIH)$/i, '')
    .replace(/\s*-\s*HealthyChildren(?:\.org)?$/i, '')
    .replace(/^[-:>\s]+/, '')
    .trim()
    .slice(0, 300);
}

export function extractTitle(rawBody: string): string {
  const candidates = [
    extractMetaContent(rawBody, 'og:title'),
    extractMetaContent(rawBody, 'twitter:title'),
    rawBody.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1],
    rawBody.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const title = sanitizeAuthorityTitle(candidate);
    if (title) {
      return title;
    }
  }

  return 'Untitled authority document';
}

export function extractMetaContent(rawBody: string, name: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = rawBody.match(pattern);
    if (match?.[1]) {
      return stripHtml(match[1]).slice(0, 500);
    }
  }

  return undefined;
}

export function detectRiskLevelDefault(text: string): 'green' | 'yellow' | 'red' {
  if (/大量出血|抽搐|呼吸困难|意识异常|胎动明显减少|破水|seizure|shortness of breath|unresponsive|blue/u.test(text)) {
    return 'red';
  }
  if (/发烧|发热|黄疸|腹泻|呕吐|出血|腹痛|用药|疫苗|fever|diarrhea|vomit|bleeding|vaccine|medication/u.test(text)) {
    return 'yellow';
  }
  return 'green';
}

function normalizeDetectionInput(input: string | DetectionInput): { primary: string; extended: string; sourceUrl: string } {
  if (typeof input === 'string') {
    const normalized = input.toLowerCase();
    return {
      primary: normalized,
      extended: normalized,
      sourceUrl: '',
    };
  }

  const sourceUrl = (input.sourceUrl || '').toLowerCase();
  const title = (input.title || '').toLowerCase();
  const summary = (input.summary || '').toLowerCase();
  const contentText = (input.contentText || '').slice(0, 1600).toLowerCase();
  const primary = [sourceUrl, title, summary].filter(Boolean).join(' ');
  const extended = [primary, contentText].filter(Boolean).join(' ');

  return { primary, extended, sourceUrl };
}

export function detectTopic(input: string | DetectionInput, source: AuthoritySourceConfig): string {
  const { primary, extended, sourceUrl } = normalizeDetectionInput(input);

  if (/政策|指南|规范|通知|解读|意见|方案|决定|纲要|条例|制度|办法/u.test(primary)) {
    return 'policy';
  }

  if (/\/(vaccines?|vaccinations?|immunization|immunisation)\//.test(sourceUrl) || /vaccine|vaccin|immuni|接种|疫苗/u.test(primary)) {
    return 'vaccination';
  }

  if (/\/(parents?|parenting|toddler|preschool|school|development|developmental-disability|milestone|child-development|ages-stages)\//.test(sourceUrl)
    || /parenting|toddler|preschool|school-age|developmental disabilit|developmental delay|milestone|discipline|behavior|development|child development|learn the signs|act early|autism|adhd|语言发育|里程碑|如厕|学步|学龄前|成长发育|发展迟缓|发育障碍|育儿|自闭/u.test(primary)) {
    return 'development';
  }

  if (/\/(newborn|baby|infant|neonat|ages-stages\/baby)\//.test(sourceUrl) || /newborn|neonat|infant|新生儿|婴儿|宝宝/u.test(primary)) {
    return 'newborn';
  }

  if (/\/(breastfeed|feeding|formula|nutrition|lactation)\//.test(sourceUrl) || /breastfeed|feeding|喂养|母乳/u.test(primary)) {
    return 'feeding';
  }

  if (/\/(pregnancy|prenatal|postpartum|womens-health|fertility|contraception)\//.test(sourceUrl) || /pregnan|prenatal|postpartum|孕|产后/u.test(primary)) {
    return 'pregnancy';
  }

  if (/policy|guidance/u.test(primary)) {
    return 'policy';
  }

  if (/fever|diarrhea|symptom|发热|腹泻/u.test(primary)) {
    return 'common-symptoms';
  }

  if (/政策|指南|规范|通知|解读|意见|方案|决定|纲要|条例|制度|办法/u.test(extended)) {
    return 'policy';
  }

  if (/fever|diarrhea|symptom|发热|腹泻/u.test(extended)) {
    return 'common-symptoms';
  }

  return source.topics.length === 1 ? source.topics[0] : 'general';
}

export function detectAudience(input: string | DetectionInput, source: AuthoritySourceConfig): string {
  const { primary, extended, sourceUrl } = normalizeDetectionInput(input);

  if (/\/(toddler|preschool|school|parenting)\//.test(sourceUrl)
    || /toddler|preschool|school-age|potty|discipline|behavior|如厕|学步|学龄前|幼儿/u.test(primary)) {
    return '幼儿家长';
  }

  if (/\/(development|developmental-disability|milestone|child-development|autism|adhd)\//.test(sourceUrl)
    || /developmental disabilit|developmental delay|child development|learn the signs|act early|milestone|autism|adhd|speech delay|language development|成长发育|里程碑|发展迟缓|发育障碍|自闭/u.test(primary)) {
    return '母婴家庭';
  }

  if (/\/(newborn|baby|infant|child|children|ages-stages\/baby)\//.test(sourceUrl)
    || /newborn|infant|baby|child|children|新生儿|婴儿|婴幼儿|儿童|育儿|托育/u.test(primary)) {
    return '婴幼儿家长';
  }

  if (/\/(pregnancy|prenatal|postpartum|womens-health|fertility|contraception)\//.test(sourceUrl) || /pregnan|prenatal|postpartum|孕妇|孕期|产后/u.test(primary)) {
    return '孕妇';
  }

  if (/备孕|婚检|孕前/u.test(primary)) {
    return '备孕家庭';
  }

  if (/newborn|infant|baby|child|children|新生儿|婴儿|婴幼儿|儿童|育儿|托育/u.test(extended)) {
    return '婴幼儿家长';
  }

  if (/pregnan|prenatal|postpartum|孕妇|孕期|产后/u.test(extended)) {
    return '孕妇';
  }

  return source.audience.length === 1 ? source.audience[0] : '母婴家庭';
}

export function isMaternalInfantRelevant(sourceUrl: string, title: string, text: string): boolean {
  const urlTitle = `${sourceUrl} ${title}`.toLowerCase();
  const normalized = `${urlTitle} ${text}`.toLowerCase();

  const strongPositivePatterns = [
    /pregnan|prenatal|antenatal|postpartum|fertility|conceiv|miscarriage|ectopic|labou?r|birth|fetal|foetal/,
    /breast[\s-]?feed|breast milk|formula|wean|feeding/,
    /newborn|neonat|infant|baby|toddler|child|children|paediatric|pediatric/,
    /contracept|iud|coil|implant|family planning/,
    /pregnancy-breastfeeding-and-fertility/,
  ];

  const conditionalPositivePatterns = [
    /(fever|jaundice|vomit|vomiting|diarrhea|diarrhoea|cough|rash|cyanosis).*(baby|child|children|infant|newborn)/,
    /(baby|child|children|infant|newborn).*(fever|jaundice|vomit|vomiting|diarrhea|diarrhoea|cough|rash|cyanosis)/,
    /(vaccin|immuni).*(pregnan|baby|child|children|infant|newborn)/,
    /(pregnan|baby|child|children|infant|newborn).*(vaccin|immuni)/,
    /(孕产妇|孕妇|孕期|产后|分娩|母乳|哺乳|新生儿|婴儿|儿童|儿科|辅食|疫苗|接种|妇幼|生育|托育|备孕|避孕)/,
  ];

  const genericMedicinePattern = /\/medicines\//.test(sourceUrl);
  const medicineSafetyPattern = /pregnancy|breastfeeding|fertility|baby|child|children|infant|newborn/.test(urlTitle);

  const genericVaccinationPattern = /\/vaccinations?\//.test(sourceUrl);
  const childVaccinationPattern = /(pregnan|baby|child|children|infant|newborn)/.test(urlTitle);

  if (strongPositivePatterns.some((pattern) => pattern.test(urlTitle))) {
    return true;
  }

  if (conditionalPositivePatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  if (genericMedicinePattern && !medicineSafetyPattern) {
    return false;
  }

  if (genericVaccinationPattern && !childVaccinationPattern) {
    return false;
  }

  return false;
}

export function shouldPublishDocument(document: NormalizedAuthorityDocument): 'draft' | 'review' | 'published' | 'rejected' {
  const officialSignalText = `${document.title} ${document.summary}`.toLowerCase();
  const isOfficialShortFormGuidance = OFFICIAL_AUTHORITY_SOURCE_IDS.has(document.sourceId)
    && (
      /核心信息|健康提示|科普|提醒|通知|解读|指南|建议|知识要点|宣传|要点|接种日/u.test(officialSignalText)
      || /(免疫|疫苗|接种|儿童|婴幼儿|新生儿|孕妇|孕产|母乳|喂养|营养|辅食|托育|妇幼)/u.test(officialSignalText)
      || /\/t\d{8}_\d+\.(?:html?|shtml)(?:$|[?#])/i.test(document.sourceUrl)
      || /\/common\/content\/content_\d+\.html(?:$|[?#])/i.test(document.sourceUrl)
    );
  const minimumContentLength = OFFICIAL_AUTHORITY_SOURCE_IDS.has(document.sourceId)
    ? (isOfficialShortFormGuidance ? 80 : 150)
    : 300;
  if (!document.contentText || document.contentText.length < minimumContentLength) {
    return 'rejected';
  }

  // Keep emergency content in manual review, but let common maternal/infant
  // symptom, feeding, and vaccination guidance flow into the authority cache.
  if (document.riskLevelDefault === 'red') {
    return 'review';
  }

  return 'published';
}
