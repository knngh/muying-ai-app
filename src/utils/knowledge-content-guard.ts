export interface KnowledgeGuardRecord {
  question?: string;
  answer?: string;
  category?: string;
  tags?: string[];
  source?: string;
  source_class?: string;
}

const PRODUCT_SCOPE_PATTERN = /怀孕|孕妇|孕期|孕早期|孕中期|孕晚期|孕周|产检|胎儿|胎动|胎心|宫缩|破水|预产期|分娩|顺产|剖宫产|产后|坐月子|月子|哺乳|母乳|备孕|孕前|叶酸|排卵|宝宝|婴儿|新生儿|幼儿|小孩|孩子|月龄|辅食|喂奶|吃奶|奶量|配方奶|疫苗|接种|预防针|黄疸|脐带|湿疹|尿布|纸尿裤/u;

const OFF_SCOPE_ADULT_HEALTH_PATTERN = /阳痿|早泄|前列腺|阴茎|龟头|包皮|手淫|遗精|精液|射精|不洁性交|处女|阴道口|阴毛|性病|尖锐湿疣|梅毒|艾滋|淋病|尿道口|隆胸|丰胸|乳房下垂|飞机场|狐臭|脱发|斑秃|痔疮|肛裂|肛瘘|混合痔|内痔|外痔|脱肛|屁眼|肛门|痘痘|痤疮|美容|整形|抽脂|减肥|肾虚|心梗|癫痫|脑出血/u;

const BEYOND_CHILD_AGE_PATTERN = /青春期|青少年|中小学生|小学|初中|高中|学龄儿童|学龄期|学生近视|早恋/u;

const NON_CONTENT_PATTERN = /中文调研|调查问卷|问卷|调研|调查研究|课题研究|示范城市|民用机场|文旅|消防安全/u;

const SUPPORT_POLICY_QUERY_PATTERN = /育儿补贴|生育保险|个税|个人所得税|专项附加扣除|医保|托育服务|普惠托育|补贴申领/u;

const HIGH_SENSITIVITY_PATTERN = /人流|人工流产|引产|堕胎|清宫|宫外孕|异位妊娠|胎停|稽留流产|胎死|死胎|死产|死亡|猝死|畸形|大出血|脑内出血|缺氧|心脏发育异常|唐氏儿/u;

function getQuestion(record: KnowledgeGuardRecord): string {
  return (record.question || '').replace(/\s+/g, ' ').trim();
}

function getRecordText(record: KnowledgeGuardRecord): string {
  return [
    record.question || '',
    record.answer || '',
    record.category || '',
    ...(record.tags || []),
  ].join(' ');
}

function hasProductScope(text: string): boolean {
  return PRODUCT_SCOPE_PATTERN.test(text);
}

function isPregnancyOrPostpartumContext(text: string): boolean {
  return /怀孕|孕妇|孕期|孕周|产检|胎儿|胎动|胎心|宫缩|预产期|分娩|顺产|剖宫产|产后|坐月子|月子|哺乳|母乳|备孕|孕前/u.test(text);
}

function isInfantChildCareContext(text: string): boolean {
  return /宝宝|婴儿|新生儿|幼儿|小孩|孩子|月龄|辅食|喂奶|吃奶|奶量|配方奶|疫苗|接种|预防针|黄疸|脐带|湿疹|尿布|纸尿裤/u.test(text);
}

function hasCategoryScopeConflict(record: KnowledgeGuardRecord): boolean {
  const category = record.category || '';
  const question = getQuestion(record);

  if (category.startsWith('parenting-') && isPregnancyOrPostpartumContext(question) && !isInfantChildCareContext(question)) {
    return true;
  }

  if (category.startsWith('pregnancy-') && isInfantChildCareContext(question) && !isPregnancyOrPostpartumContext(question)) {
    return true;
  }

  if (/^vaccine-/.test(category) && !/疫苗|接种|打针|预防针|卡介|乙肝疫苗|百白破|麻腮风|脊灰/u.test(question)) {
    return true;
  }

  return false;
}

export function getDatasetKnowledgeDropReason(record: KnowledgeGuardRecord): string | null {
  const question = getQuestion(record);
  if (!question || question.length < 4) {
    return 'empty_or_short_question';
  }

  const text = getRecordText(record);
  if (NON_CONTENT_PATTERN.test(text)) {
    return 'non_content_or_research';
  }

  if (!hasProductScope(question)) {
    return 'missing_product_scope';
  }

  if (BEYOND_CHILD_AGE_PATTERN.test(text)) {
    return 'beyond_app_child_age';
  }

  if (OFF_SCOPE_ADULT_HEALTH_PATTERN.test(text)) {
    return 'off_scope_adult_health';
  }

  if (HIGH_SENSITIVITY_PATTERN.test(text)) {
    return 'high_sensitivity_dataset_topic';
  }

  if (hasCategoryScopeConflict(record)) {
    return 'category_scope_conflict';
  }

  return null;
}

export function isOutOfScopeKnowledgeQuery(query: string): boolean {
  const normalized = query.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return false;
  }

  return NON_CONTENT_PATTERN.test(normalized)
    || SUPPORT_POLICY_QUERY_PATTERN.test(normalized)
    || BEYOND_CHILD_AGE_PATTERN.test(normalized)
    || OFF_SCOPE_ADULT_HEALTH_PATTERN.test(normalized);
}
