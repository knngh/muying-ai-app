import { CacheKeys } from '../services/cache.service';
import { normalizeAuthorityTopicLabel } from './authority-metadata';

type BrowseArticle = { topic?: string; title: string; summary?: string; targetStages?: string[]; tags?: Array<{ name: string }> };

export function matchesAuthorityBrowseCategory(article: BrowseArticle, category: string): boolean {
  const stages = article.targetStages || [];
  const hasStage = (...values: string[]) => values.some(value => stages.includes(value));
  const pregnant = hasStage('preparation', 'first-trimester', 'second-trimester', 'third-trimester');
  const infant = hasStage('newborn', '0-6-months', '6-12-months');
  const child = hasStage('1-3-years', '3-years-plus');
  const topic = article.topic || '';
  const text = [article.title, article.summary, topic, ...(article.tags || []).map(tag => tag.name)].join(' ');
  const nutrition = /喂养|营养|饮食|feeding|nutrition|diet/i.test(text);
  const stageCategories: Record<string, string[]> = {
    'pregnancy-prep': ['preparation'],
    'pregnancy-early': ['first-trimester'],
    'pregnancy-mid': ['second-trimester'],
    'pregnancy-late': ['third-trimester'],
    'parenting-0-1': ['newborn', '0-6-months', '6-12-months'],
    'parenting-1-3': ['1-3-years'],
    'parenting-3-6': ['3-years-plus'],
  };
  if (stageCategories[category]) return hasStage(...stageCategories[category]);
  switch (category) {
    case 'pregnancy': return pregnant || topic === '孕期';
    case 'pregnancy-birth': return /分娩|临产|labor|labour|childbirth|giving birth/i.test(text);
    case 'parenting': return infant || child;
    case 'parenting-safety': return /安全|意外|伤害|safety|injury|injuries|choking/i.test(text);
    case 'nutrition': return nutrition;
    case 'nutrition-pregnancy': return nutrition && pregnant;
    case 'nutrition-baby': return nutrition && infant;
    case 'nutrition-child': return nutrition && child;
    case 'nutrition-special': return nutrition && /过敏|不耐受|特殊|allerg|intoleran|special diet/i.test(text);
    case 'faq-vaccine': return topic === '疫苗';
    case 'faq-growth': return topic === '成长发育';
    case 'faq-disease': return topic === '常见症状';
    case 'faq-psychology': return /心理|情绪|行为|mental|emotion|behavior|behaviour/i.test(text);
    case 'faq': return ['疫苗', '成长发育', '常见症状'].includes(topic);
    default: return topic === normalizeAuthorityTopicLabel(category);
  }
}

export function authorityBrowsePriority(sourceUrl?: string, topic?: string): number {
  const topicPriority = !topic || ['孕期', '产后恢复', '新生儿', '喂养', '疫苗', '成长发育', '常见症状'].includes(topic) ? 0 : 1;
  if (!sourceUrl) return topicPriority;
  let pathname: string;
  try { pathname = new URL(sourceUrl).pathname; } catch { return topicPriority; }
  // News remains accessible. This only orders the recommended reading list.
  if (/\/fact-sheets\/|\/questions-and-answers\/|\/q-a-detail\//i.test(pathname)) return topicPriority;
  return /\/news-room\/(?:detail|feature-stories|commentaries|events|spotlight)\/|\/news\/item\/|\/press-releases\//i.test(pathname) ? 2 : topicPriority;
}

export function authorityListCacheKey(params: Record<string, unknown>): string {
  const fields = ['category', 'tag', 'stage', 'difficulty', 'keyword', 'source', 'sort', 'page', 'pageSize'];
  return CacheKeys.ARTICLES_AUTHORITY_FILTERED(JSON.stringify(fields.map(key => params[key] ?? null)));
}
