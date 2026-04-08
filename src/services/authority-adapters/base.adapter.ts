import type { AuthorityRawDocument, NormalizedAuthorityDocument } from '../authority-sync.service';
import type { AuthoritySourceConfig } from '../../config/authority-sources';

export interface AuthorityDocumentAdapter {
  id: string;
  supports(source: AuthoritySourceConfig, raw: AuthorityRawDocument): boolean;
  normalize(source: AuthoritySourceConfig, raw: AuthorityRawDocument): NormalizedAuthorityDocument | null;
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

export function extractTitle(rawBody: string): string {
  const titleMatch = rawBody.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    return stripHtml(titleMatch[1]).slice(0, 300);
  }

  const h1Match = rawBody.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return h1Match?.[1] ? stripHtml(h1Match[1]).slice(0, 300) : 'Untitled authority document';
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

export function detectTopic(text: string, source: AuthoritySourceConfig): string {
  const normalized = text.toLowerCase();
  if (/政策|指南|规范|通知|解读|意见|方案|决定|纲要|条例|制度|办法/u.test(normalized)) {
    return 'policy';
  }
  if (/vaccine|vaccin|immuni|接种|疫苗/u.test(normalized)) {
    return 'vaccination';
  }
  if (/newborn|neonat|infant|新生儿/u.test(normalized)) {
    return 'newborn';
  }
  if (/pregnan|prenatal|postpartum|孕|产后/u.test(normalized)) {
    return 'pregnancy';
  }
  if (/breastfeed|feeding|喂养|母乳/u.test(normalized)) {
    return 'feeding';
  }
  if (/发育|成长|里程碑|development/u.test(normalized)) {
    return 'development';
  }
  if (/policy|guidance/u.test(normalized)) {
    return 'policy';
  }
  if (/fever|diarrhea|symptom|发热|腹泻/u.test(normalized)) {
    return 'common-symptoms';
  }
  return source.topics[0] || 'general';
}

export function detectAudience(text: string, source: AuthoritySourceConfig): string {
  if (/newborn|infant|baby|child|children|新生儿|婴儿|婴幼儿|儿童|育儿|托育/u.test(text)) {
    return '婴幼儿家长';
  }
  if (/pregnan|prenatal|postpartum|孕妇|孕期|产后/u.test(text)) {
    return '孕妇';
  }
  if (/备孕|婚检|孕前/u.test(text)) {
    return '备孕家庭';
  }
  return source.audience[0] || '母婴家庭';
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
  if (!document.contentText || document.contentText.length < 300) {
    return 'rejected';
  }

  if (document.riskLevelDefault === 'red' || document.riskLevelDefault === 'yellow') {
    return 'review';
  }

  return 'published';
}
