type GlossaryEntry = {
  terms: string[];
  expansions: string[];
};

const GLOSSARY: GlossaryEntry[] = [
  { terms: ['备孕', '孕前'], expansions: ['preconception', 'trying to conceive', 'conceive'] },
  { terms: ['叶酸'], expansions: ['folic acid', 'folate'] },
  { terms: ['排卵'], expansions: ['ovulation', 'ovulate'] },
  { terms: ['怀孕', '孕期', '孕妇'], expansions: ['pregnancy', 'pregnant', 'prenatal', 'antenatal'] },
  { terms: ['产后'], expansions: ['postpartum', 'postnatal', 'after delivery'] },
  { terms: ['产后出血'], expansions: ['postpartum hemorrhage', 'postpartum bleeding'] },
  { terms: ['孕吐', '恶心', '反胃'], expansions: ['morning sickness', 'nausea', 'vomiting', 'nausea and vomiting of pregnancy', 'nvp'] },
  { terms: ['孕早期'], expansions: ['first trimester', 'early pregnancy'] },
  { terms: ['孕中期'], expansions: ['second trimester', 'mid pregnancy'] },
  { terms: ['孕晚期'], expansions: ['third trimester', 'late pregnancy'] },
  { terms: ['预产期'], expansions: ['due date', 'estimated due date', 'edd'] },
  { terms: ['产检', '建档'], expansions: ['prenatal visit', 'antenatal visit', 'prenatal checkup', 'intake visit', 'first prenatal appointment'] },
  { terms: ['唐筛'], expansions: ['down syndrome screening', 'prenatal screening'] },
  { terms: ['糖耐', '糖筛'], expansions: ['glucose tolerance test', 'oral glucose tolerance test', 'glucose challenge test', 'gestational diabetes', 'gestational diabetes screening'] },
  { terms: ['四维'], expansions: ['anatomy scan', 'ultrasound'] },
  { terms: ['见红', '出血', '流血'], expansions: ['bleeding', 'spotting', 'bloody show'] },
  { terms: ['腹痛'], expansions: ['abdominal pain', 'stomach pain', 'cramping'] },
  { terms: ['宫缩'], expansions: ['contractions', 'uterine contractions'] },
  { terms: ['胎动'], expansions: ['fetal movement', 'baby movement', 'kicks'] },
  { terms: ['胎心'], expansions: ['fetal heart rate', 'fetal heartbeat'] },
  { terms: ['破水'], expansions: ['water broke', 'amniotic fluid', 'rupture of membranes'] },
  { terms: ['发烧', '发热', '高烧'], expansions: ['fever', 'high fever', 'temperature'] },
  { terms: ['宝宝发烧', '婴儿发烧', '新生儿发烧'], expansions: ['baby fever', 'infant fever', 'fever in infants', 'newborn fever'] },
  { terms: ['咳嗽'], expansions: ['cough', 'coughing'] },
  { terms: ['拉肚子', '腹泻'], expansions: ['diarrhea', 'loose stools'] },
  { terms: ['呕吐'], expansions: ['vomiting', 'vomit', 'throwing up'] },
  { terms: ['湿疹'], expansions: ['eczema', 'rash'] },
  { terms: ['黄疸'], expansions: ['jaundice'] },
  { terms: ['母乳'], expansions: ['breastfeeding', 'breast milk'] },
  { terms: ['配方奶'], expansions: ['formula', 'formula milk'] },
  { terms: ['喂奶', '吃奶'], expansions: ['feeding', 'nursing', 'bottle feeding'] },
  { terms: ['奶量'], expansions: ['milk intake', 'feeding amount'] },
  { terms: ['厌奶'], expansions: ['feeding refusal', 'refusing feeds'] },
  { terms: ['辅食'], expansions: ['solid foods', 'complementary feeding'] },
  { terms: ['夜醒'], expansions: ['night waking', 'waking at night'] },
  { terms: ['哄睡', '安抚'], expansions: ['soothe to sleep', 'settling', 'soothing'] },
  { terms: ['睡眠', '睡觉'], expansions: ['sleep', 'sleeping'] },
  { terms: ['新生儿'], expansions: ['newborn', 'neonate'] },
  { terms: ['宝宝', '婴儿'], expansions: ['baby', 'infant'] },
  { terms: ['幼儿'], expansions: ['toddler'] },
  { terms: ['孩子', '儿童'], expansions: ['child', 'children'] },
  { terms: ['疫苗', '接种', '打针'], expansions: ['vaccine', 'vaccination', 'immunization', 'shot'] },
  { terms: ['同伴', '同龄人'], expansions: ['peer', 'peers'] },
  { terms: ['社交'], expansions: ['social', 'social skills'] },
  { terms: ['学校'], expansions: ['school'] },
  { terms: ['校车'], expansions: ['school bus'] },
];

export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitNormalizedTerms(text: string): string[] {
  return normalizeSearchText(text)
    .split(' ')
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function hasTerm(query: string, term: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedQuery || !normalizedTerm) {
    return false;
  }

  if (/[\u4e00-\u9fff]/u.test(term)) {
    return query.includes(term);
  }

  return normalizedQuery.includes(normalizedTerm);
}

export function expandSearchTerms(query: string): string[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  const terms = new Set<string>([normalizedQuery, ...splitNormalizedTerms(query)]);

  for (const entry of GLOSSARY) {
    if (!entry.terms.some((term) => hasTerm(query, term)) && !entry.expansions.some((term) => hasTerm(query, term))) {
      continue;
    }

    for (const term of [...entry.terms, ...entry.expansions]) {
      const normalized = normalizeSearchText(term);
      if (normalized) {
        terms.add(normalized);
      }
      for (const token of splitNormalizedTerms(term)) {
        terms.add(token);
      }
    }
  }

  return Array.from(terms).filter((term) => term.length >= 2);
}

export function matchesExpandedSearch(query: string, searchableText: string): boolean {
  const normalizedSearchable = normalizeSearchText(searchableText);
  if (!normalizedSearchable) {
    return false;
  }

  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery && normalizedSearchable.includes(normalizedQuery)) {
    return true;
  }

  return expandSearchTerms(query).some((term) => normalizedSearchable.includes(term));
}

export function isLikelyChineseQuery(query: string): boolean {
  return /[\u4e00-\u9fff]/u.test(query);
}

export function parseSearchRewriteOutput(output: string): string[] {
  const normalized = output.trim();
  if (!normalized) {
    return [];
  }

  const jsonMatch = normalized.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean);
      }
    } catch {
      // fall through to line parsing
    }
  }

  const tagMatch = normalized.match(/<queries>([\s\S]*?)<\/queries>/i);
  const body = tagMatch?.[1] || normalized;

  return body
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean);
}

export function dedupeSearchQueries(baseQuery: string, queries: string[]): string[] {
  const merged = new Map<string, string>();

  for (const query of [baseQuery, ...queries]) {
    const trimmed = query.trim();
    const normalized = normalizeSearchText(trimmed);
    if (!trimmed || !normalized || merged.has(normalized)) {
      continue;
    }
    merged.set(normalized, trimmed);
  }

  return Array.from(merged.values());
}
