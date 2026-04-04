export type AIDomainStatus = 'in_scope' | 'needs_clarification' | 'out_of_scope';

export interface AIDomainDecision {
  status: AIDomainStatus;
  answer?: string;
  disclaimer?: string;
}

const MATERNAL_CHILD_PATTERNS = [
  /怀孕|孕妇|孕妈|孕期|备孕|产后|坐月子|月子|胎动|宫缩|见红|破水|预产期|分娩|顺产|剖宫产|产检|唐筛|糖筛|羊穿|胎心|恶露|母乳|哺乳|奶阵|乳腺/u,
  /宝宝|婴儿|新生儿|幼儿|儿童|孩子|月龄|辅食|奶粉|喂奶|吃奶|奶量|吐奶|夜醒|哄睡|哭闹|黄疸|湿疹|红屁屁|疫苗|便便|拉肚子|腹泻|便秘|发育|身高|体重/u,
];

const GENERAL_HEALTH_PATTERNS = [
  /发烧|发热|高烧|低烧|咳嗽|流鼻涕|鼻塞|腹痛|肚子疼|腹泻|拉肚子|便秘|呕吐|吐奶|湿疹|皮疹|黄疸|抽搐|呼吸困难|过敏|红肿|瘙痒|喉咙痛|感冒|退烧/u,
];

const ADULT_EXCLUSION_PATTERNS = [
  /成人|大人|老公|老丈人|老婆|同事|领导|老板|朋友/u,
];

const OFF_TOPIC_PATTERNS = [
  /股票|基金|A股|港股|美股|期货|外汇|比特币|以太坊|币圈|K线|投资|理财|收益率/u,
  /代码|编程|前端|后端|JavaScript|TypeScript|Python|Java|Go|Rust|SQL|接口|API|服务器|Linux|Nginx|数据库|报错|bug|部署/u,
  /翻译|润色|写诗|作文|小说|周报|简历|面试|文案|标题党|脚本杀|剧本/u,
  /足球|篮球|NBA|英超|欧冠|世界杯|LOL|王者荣耀|CSGO|游戏攻略/u,
  /旅游|机票|酒店|签证|攻略|景点|航班/u,
  /房贷|买房|租房|装修|汽车|油耗|二手车/u,
  /历史|政治|总统|选举|战争|国际局势/u,
  /高考|考研|公务员|申论|数学题|物理题|化学题/u,
];

const PARENTING_ACTION_PATTERNS = [
  /怎么办|怎么处理|怎么护理|怎么照顾|怎么喂|怎么吃|能不能吃|能不能用|要不要去医院|严不严重|正常吗/u,
];

const OUT_OF_SCOPE_MESSAGE = [
  '我目前只回答母婴相关问题。',
  '可支持的方向包括：备孕、孕期、产后恢复、母乳喂养、宝宝喂养、常见症状护理、睡眠、辅食、发育和疫苗等。',
  '你可以换一种问法，例如：',
  '1. 孕 12 周出血要注意什么？',
  '2. 3 个月宝宝发烧先怎么处理？',
  '3. 母乳喂养堵奶怎么办？',
].join('\n');

const CLARIFICATION_MESSAGE = [
  '这个问题可能和健康护理有关，但我还不能判断你问的是孕妇、产后妈妈，还是宝宝。',
  '请补充对象和关键信息后再问，我再继续回答。',
  '建议补充：',
  '1. 对象：孕妇 / 产后妈妈 / 新生儿 / 几个月宝宝',
  '2. 症状：体温、持续时间、是否咳嗽/腹泻/呕吐/皮疹等',
  '3. 当前阶段：孕周、产后天数或宝宝月龄',
].join('\n');

const OUT_OF_SCOPE_DISCLAIMER = '⚠️ 当前仅支持母婴、孕产、喂养、护理、成长发育相关问题。';
const CLARIFICATION_DISCLAIMER = '⚠️ 请先补充对象是孕妇、产后妈妈还是宝宝，再继续提问。';

function normalizeContextText(context: unknown): string {
  if (!context) {
    return '';
  }

  if (typeof context === 'string') {
    return context.trim();
  }

  if (typeof context !== 'object' || Array.isArray(context)) {
    return '';
  }

  return Object.entries(context as Record<string, unknown>)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key} ${String(value).trim()}`)
    .join('\n');
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function normalizeHistoryText(history?: Array<string | { role?: string; content?: string }>): string {
  if (!history || history.length === 0) {
    return '';
  }

  return history
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim();
      }

      return item.role === 'user' || item.role === 'assistant'
        ? String(item.content || '').trim()
        : '';
    })
    .filter(Boolean)
    .slice(-6)
    .join('\n');
}

function buildSignalText(
  question: string,
  options?: {
    context?: unknown;
    history?: Array<string | { role?: string; content?: string }>;
  },
): string {
  return [
    question,
    normalizeContextText(options?.context),
    normalizeHistoryText(options?.history),
  ].filter(Boolean).join('\n');
}

export function hasMaternalChildSignal(
  question: string,
  options?: {
    context?: unknown;
    history?: Array<string | { role?: string; content?: string }>;
  },
): boolean {
  return matchesAny(buildSignalText(question, options), MATERNAL_CHILD_PATTERNS);
}

export function hasExcludedDomainSignal(
  question: string,
  options?: {
    context?: unknown;
    history?: Array<string | { role?: string; content?: string }>;
  },
): boolean {
  const signalText = buildSignalText(question, options);
  return matchesAny(signalText, OFF_TOPIC_PATTERNS) || matchesAny(signalText, ADULT_EXCLUSION_PATTERNS);
}

export function hasHealthOrCareSignal(
  question: string,
  options?: {
    context?: unknown;
    history?: Array<string | { role?: string; content?: string }>;
  },
): boolean {
  const signalText = buildSignalText(question, options);
  return matchesAny(signalText, GENERAL_HEALTH_PATTERNS) || matchesAny(signalText, PARENTING_ACTION_PATTERNS);
}

export function classifyMaternalChildQuestion(
  question: string,
  options?: {
    context?: unknown;
    history?: Array<string | { role?: string; content?: string }>;
  },
): AIDomainDecision {
  const signalText = buildSignalText(question, options);

  if (!signalText.trim()) {
    return {
      status: 'out_of_scope',
      answer: OUT_OF_SCOPE_MESSAGE,
      disclaimer: OUT_OF_SCOPE_DISCLAIMER,
    };
  }

  const hasMaternalChildSignal = matchesAny(signalText, MATERNAL_CHILD_PATTERNS);
  if (hasMaternalChildSignal) {
    return { status: 'in_scope' };
  }

  const hasOffTopicSignal = matchesAny(signalText, OFF_TOPIC_PATTERNS);
  if (hasOffTopicSignal) {
    return {
      status: 'out_of_scope',
      answer: OUT_OF_SCOPE_MESSAGE,
      disclaimer: OUT_OF_SCOPE_DISCLAIMER,
    };
  }

  const hasAdultOnlySignal = matchesAny(signalText, ADULT_EXCLUSION_PATTERNS);
  if (hasAdultOnlySignal) {
    return {
      status: 'out_of_scope',
      answer: OUT_OF_SCOPE_MESSAGE,
      disclaimer: OUT_OF_SCOPE_DISCLAIMER,
    };
  }

  const hasGeneralHealthSignal = matchesAny(signalText, GENERAL_HEALTH_PATTERNS);
  const hasCareIntent = matchesAny(signalText, PARENTING_ACTION_PATTERNS);
  if (hasGeneralHealthSignal || hasCareIntent) {
    return {
      status: 'needs_clarification',
      answer: CLARIFICATION_MESSAGE,
      disclaimer: CLARIFICATION_DISCLAIMER,
    };
  }

  return {
    status: 'out_of_scope',
    answer: OUT_OF_SCOPE_MESSAGE,
    disclaimer: OUT_OF_SCOPE_DISCLAIMER,
  };
}

export function getOutOfScopeMessage(): string {
  return OUT_OF_SCOPE_MESSAGE;
}
