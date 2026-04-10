export type AuthorityStage =
  | 'preparation'
  | 'first-trimester'
  | 'second-trimester'
  | 'third-trimester'
  | '0-6-months'
  | '6-12-months'
  | '1-3-years';

interface InferAuthorityStagesInput {
  title?: string;
  summary?: string;
  contentText?: string;
  audience?: string;
  topic?: string;
}

function uniqOrdered(stages: AuthorityStage[]): AuthorityStage[] {
  const seen = new Set<AuthorityStage>();
  return stages.filter((stage) => {
    if (seen.has(stage)) {
      return false;
    }
    seen.add(stage);
    return true;
  });
}

function inferPregnancyStageByWeek(text: string): AuthorityStage | null {
  const weekMatch = text.match(/(?:怀孕|孕)(?:第)?\s*(\d{1,2})\s*周/u);
  if (!weekMatch?.[1]) {
    return null;
  }

  const week = Number(weekMatch[1]);
  if (!Number.isFinite(week) || week <= 0) {
    return null;
  }

  if (week <= 13) {
    return 'first-trimester';
  }

  if (week <= 27) {
    return 'second-trimester';
  }

  return 'third-trimester';
}

export function inferAuthorityStages(input: InferAuthorityStagesInput): AuthorityStage[] {
  const title = input.title || '';
  const summary = input.summary || '';
  const content = (input.contentText || '').slice(0, 1600);
  const audience = (input.audience || '').trim();
  const topic = (input.topic || '').toLowerCase();
  const primaryText = `${title}\n${summary}\n${audience}\n${topic}`;
  const haystack = `${primaryText}\n${content}`;
  const stages: AuthorityStage[] = [];
  const isPreparationAudience = audience === '备孕家庭';
  const isPregnantAudience = audience === '孕妇';
  const isNewbornAudience = audience === '新生儿家长';
  const isInfantAudience = audience === '婴幼儿家长' || audience === '婴儿家长';
  const isToddlerAudience = audience === '幼儿家长' || audience === '学龄前儿童家长';

  const hasPreparationContext = /备孕|孕前|叶酸|排卵|受孕|婚检/u.test(primaryText) || isPreparationAudience;
  const hasMaternalContext = hasPreparationContext
    || /怀孕|孕期|孕妇|产后|分娩|胎儿|孕早期|孕中期|孕晚期|prenatal|pregnan|postpartum|antenatal/i.test(primaryText)
    || topic === 'pregnancy';
  const hasInfantContext = /新生儿|婴儿|婴幼儿|宝宝|幼儿|儿童|辅食|喂养|奶量|月龄/u.test(primaryText)
    || isNewbornAudience
    || isInfantAudience
    || isToddlerAudience
    || topic === 'newborn'
    || topic === 'feeding'
    || topic === 'development'
    || topic === 'vaccination'
    || topic === 'common-symptoms';
  const hasToddlerContext = /1岁|2岁|3岁|学步|如厕|语言发育|断奶|走路|说话|学龄前|preschool|toddler/i.test(primaryText)
    || isToddlerAudience;
  const hasDevelopmentContext = hasToddlerContext
    || /父母|家长|育儿|行为|管教|里程碑|成长发育|发展迟缓|development|milestone|discipline|behavior|parenting|parents/i.test(primaryText)
    || topic === 'development';

  const weekStage = inferPregnancyStageByWeek(haystack);
  if (weekStage) {
    stages.push(weekStage);
  }

  if (hasPreparationContext) {
    stages.push('preparation');
  }

  if (hasMaternalContext && /孕早期|早孕|孕早|nt|hcg|孕酮|见红|先兆流产|前三个月/u.test(haystack)) {
    stages.push('first-trimester');
  }

  if (hasMaternalContext && /孕中期|孕中|四维|唐筛|糖耐|胎动|大排畸|妊娠糖尿病筛查/u.test(haystack)) {
    stages.push('second-trimester');
  }

  if (hasMaternalContext && /孕晚期|孕晚|足月|宫缩|见红|破水|待产|入盆|分娩征兆/u.test(haystack)) {
    stages.push('third-trimester');
  }

  if (hasInfantContext && /新生儿|出生后|月子|黄疸|脐带|奶量|拍嗝/u.test(haystack)) {
    stages.push('0-6-months');
  }

  if (hasInfantContext && /婴儿|宝宝|辅食|出牙|翻身|爬行|夜醒|睡眠倒退|添加辅食|断夜奶/u.test(haystack)) {
    stages.push('0-6-months', '6-12-months');
  }

  if (hasToddlerContext) {
    stages.push('1-3-years');
  }

  if (isPreparationAudience) {
    stages.push('preparation');
  }

  if (isPregnantAudience) {
    stages.push('first-trimester', 'second-trimester', 'third-trimester');
  }

  if (isNewbornAudience) {
    stages.push('0-6-months');
  }

  if (isInfantAudience) {
    stages.push('0-6-months', '6-12-months');
  }

  if (isToddlerAudience) {
    stages.push('1-3-years');
  }

  if (topic === 'pregnancy' && !hasInfantContext && !hasToddlerContext && !hasDevelopmentContext) {
    stages.push('first-trimester', 'second-trimester', 'third-trimester');
  }

  if (topic === 'newborn') {
    stages.push('0-6-months');
  }

  if (topic === 'feeding' || topic === 'vaccination' || topic === 'common-symptoms') {
    if (isPregnantAudience) {
      stages.push('first-trimester', 'second-trimester', 'third-trimester');
    }

    if (isNewbornAudience) {
      stages.push('0-6-months');
    }

    if (isInfantAudience || audience === '母婴家庭') {
      stages.push('0-6-months', '6-12-months');
      if (hasToddlerContext || audience === '母婴家庭') {
        stages.push('1-3-years');
      }
    }
  }

  if (topic === 'development' || hasDevelopmentContext) {
    stages.push('6-12-months', '1-3-years');
  }

  return uniqOrdered(stages);
}
