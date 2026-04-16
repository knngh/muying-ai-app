import '../config/env';
import fs from 'fs';
import path from 'path';
import { listEnabledOfficialAuthoritySources } from '../config/authority-sources';
import { buildKnowledgeGrowthSeeds } from '../config/knowledge-growth';
import type { AuthorityReference, QAPair } from '../services/knowledge.service';

const INPUT_FILE = process.env.INPUT_FILE || resolveInputFile();
const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(process.cwd(), 'tmp', 'authority-coverage-audit.json');
const SAMPLE_LIMIT = Math.max(20, Number(process.env.SAMPLE_LIMIT || 200));

function resolveInputFile(): string {
  const candidates = [
    path.join(process.cwd(), 'data', 'expanded-qa-data-5000.enriched.json'),
    '/tmp/expanded-qa-data-5000.enriched.json',
    path.join(process.cwd(), 'data', 'expanded-qa-data-5000.json'),
    '/tmp/expanded-qa-data-5000.json',
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function isAuthorityReference(reference?: AuthorityReference | null): boolean {
  if (!reference) {
    return false;
  }

  if (reference.authoritative === true || reference.sourceClass === 'official') {
    return true;
  }

  const sourceText = `${reference.org || ''} ${reference.sourceOrg || ''} ${reference.title || ''} ${reference.url || ''}`;
  return /who\.int|cdc\.gov|healthychildren\.org|acog\.org|mayoclinic\.org|nhs\.uk|nih\.gov|fda\.gov|nhc\.gov\.cn|chinacdc\.cn|ndcpa\.gov\.cn|gov\.cn/i.test(sourceText);
}

function hasAuthorityCoverage(item: QAPair): boolean {
  if (Array.isArray(item.references) && item.references.some((reference) => isAuthorityReference(reference))) {
    return true;
  }

  const sourceText = `${item.source_org || ''} ${item.source || ''} ${item.source_url || ''} ${item.url || ''}`;
  return /who|cdc|aap|acog|mayo|nhs|nih|fda|卫健委|疾控|中国政府网|国家疾病预防控制局/u.test(sourceText);
}

function findSuggestedSourceIds(item: QAPair): string[] {
  const categoryText = `${item.category} ${(item.tags || []).join(' ')} ${item.question}`;
  const seeds = buildKnowledgeGrowthSeeds();
  const matchedTrackIds = new Set(
    seeds
      .filter((seed) => seed.zhQuery.split(/\s+/).some((term) => term && categoryText.includes(term)))
      .map((seed) => seed.trackId),
  );

  const preferredSources = listEnabledOfficialAuthoritySources()
    .filter((source) => {
      if (/pregnancy|备孕|孕/u.test(categoryText)) {
        return source.topics.includes('pregnancy');
      }
      if (/newborn|新生儿|月子/u.test(categoryText)) {
        return source.topics.includes('newborn');
      }
      if (/vaccine|疫苗|接种/u.test(categoryText)) {
        return source.topics.includes('vaccination');
      }
      if (/feeding|母乳|喂养|辅食/u.test(categoryText)) {
        return source.topics.includes('feeding');
      }
      if (/语言|睡眠|发育|行为|幼儿|孩子/u.test(categoryText)) {
        return source.topics.includes('development') || source.topics.includes('common-symptoms');
      }
      return source.topics.includes('common-symptoms') || source.topics.includes('pregnancy');
    })
    .map((source) => source.id);

  const growthSources = seeds
    .filter((seed) => matchedTrackIds.has(seed.trackId))
    .map((seed) => seed.sourceId);

  return Array.from(new Set([...growthSources, ...preferredSources])).slice(0, 5);
}

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(`Input file not found: ${INPUT_FILE}`);
  }

  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8')) as QAPair[];
  const missing = data.filter((item) => !hasAuthorityCoverage(item));
  const categorySummary = Object.entries(
    missing.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {}),
  )
    .sort((left, right) => right[1] - left[1])
    .map(([category, count]) => ({ category, count }));

  const payload = {
    generatedAt: new Date().toISOString(),
    inputFile: INPUT_FILE,
    total: data.length,
    authorityCovered: data.length - missing.length,
    missingAuthorityCoverage: missing.length,
    coverageRate: Number((((data.length - missing.length) / Math.max(data.length, 1)) * 100).toFixed(2)),
    missingByCategory: categorySummary,
    remediationQueue: missing.slice(0, SAMPLE_LIMIT).map((item) => ({
      id: item.id,
      category: item.category,
      question: item.question,
      suggestedSourceIds: findSuggestedSourceIds(item),
    })),
  };

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log(JSON.stringify(payload, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Authority Coverage Audit] failed:', error);
    process.exit(1);
  });
