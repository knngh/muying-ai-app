import {
  callTaskModelDetailed,
  getEmergencyResponse,
  isEmergencyQuestion,
  type AIGatewayRouteInfo,
  type AITaskModelRole,
} from './ai-gateway.service';
import { planTrustedAIRoute, type RoutePlan } from './ai-route-planner.service';
import { buildUserProfileContext } from './ai-user-context.service';
import {
  buildKnowledgePack,
  type KnowledgeSearchResult,
  type KnowledgeRiskLevel,
  type SourceReference,
} from './knowledge.service';
import {
  classifyMaternalChildQuestion,
  hasExcludedDomainSignal,
  hasHealthOrCareSignal,
  hasMaternalChildSignal,
  type AIDomainDecision,
} from './ai-domain.service';

export type TrustedRiskLevel = 'green' | 'yellow' | 'red';
export type TrustedTriageCategory = 'normal' | 'caution' | 'emergency' | 'out_of_scope';
export type TrustedSourceReliability = 'authoritative' | 'mixed' | 'dataset_only' | 'none';

export interface TrustedStructuredAnswer {
  conclusion: string;
  reasons: string[];
  actions: string[];
  whenToSeekCare: string[];
  uncertaintyNote?: string;
}

export interface TrustedUncertaintyInfo {
  level: 'none' | 'medium' | 'high';
  message?: string;
}

export interface TrustedAIResult {
  answer: string;
  sources: SourceReference[];
  isEmergency: boolean;
  triageCategory: TrustedTriageCategory;
  riskLevel: TrustedRiskLevel;
  structuredAnswer: TrustedStructuredAnswer;
  uncertainty: TrustedUncertaintyInfo;
  sourceReliability: TrustedSourceReliability;
  disclaimer: string;
  followUpQuestions: string[];
  confidence: number;
  degraded: boolean;
  model?: string;
  provider?: string;
  route?: string;
}

export interface TrustedAIRequest {
  question: string;
  context?: unknown;
  userId?: string;
  model?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const AI_DISCLAIMER = '温馨提示：本回答用于母婴健康信息参考，不能替代医生面诊、检查和专业判断。';
const EMERGENCY_DISCLAIMER = '重要提示：当前命中高风险规则，请优先立即线下就医。';
const CLARIFICATION_DISCLAIMER = '当前信息不足，系统不会继续猜测，请先补充关键信息或直接线下就医。';
const OUT_OF_SCOPE_DISCLAIMER = '当前仅支持母婴、孕产、喂养、护理、成长发育相关问题。';
const DATASET_ONLY_NOTICE = '当前检索结果主要来自内部知识库或公开问答数据，不属于权威临床指南，不能替代线下面诊。';

const EXPLICIT_STAGE_PATTERNS = [
  /孕早期|怀孕早期|怀孕初期|刚怀孕/u,
  /孕中期|怀孕中期/u,
  /孕晚期|怀孕晚期|怀孕后期/u,
  /备孕/u,
  /产后|月子/u,
  /新生儿/u,
  /\d{1,2}\s*周/u,
  /怀孕\d{1,2}\s*个?月/u,
  /\d{1,2}\s*个?月龄/u,
  /\d{1,2}\s*个?月宝宝/u,
];

const CHILDCARE_SCENE_PATTERNS = [
  /(宝宝|婴儿|新生儿|幼儿|孩子|儿童).{0,8}(发烧|发热|咳嗽|腹泻|拉肚子|便秘|吐奶|湿疹|黄疸|皮疹|疫苗|奶量|喂奶|吃奶|夜醒|睡眠|哄睡|哭闹|辅食|发育|体重|身高)/u,
  /(发烧|发热|咳嗽|腹泻|拉肚子|便秘|吐奶|湿疹|黄疸|皮疹|疫苗|奶量|喂奶|吃奶|夜醒|睡眠|哄睡|哭闹|辅食|发育|体重|身高).{0,8}(宝宝|婴儿|新生儿|幼儿|孩子|儿童)/u,
  /宝宝月龄|婴儿护理|儿童护理|儿科|宝宝作息|宝宝睡眠/u,
  /\d{1,2}\s*个?月(宝宝|婴儿|孩子|儿童)/u,
];

const RED_RISK_PATTERNS = [
  /大出血|出血不止|流血不止/u,
  /呼吸困难|喘不上气|口唇发紫/u,
  /抽搐|惊厥|意识异常|昏迷|反应差/u,
  /胎动消失|没有胎动|胎动明显减少/u,
  /破水|羊水破了/u,
  /剧烈腹痛|持续剧痛/u,
  /新生儿.{0,8}(拒奶|呼吸困难|发青|抽搐|反应差)/u,
];

const YELLOW_RISK_PATTERNS = [
  /发烧|发热|高热|咳嗽|腹泻|拉肚子|呕吐|便血|便秘|黄疸|湿疹|皮疹|过敏/u,
  /见红|出血|腹痛|宫缩|胎动减少/u,
  /奶量下降|拒奶|精神差|尿少|脱水/u,
  /用药|药量|退烧药|抗生素|处方药|检查单|化验单|B超|彩超|CT|指标/u,
];

function normalizeContext(context: unknown): string | undefined {
  if (!context) {
    return undefined;
  }

  if (typeof context === 'string') {
    const trimmed = context.trim();
    return trimmed || undefined;
  }

  if (typeof context !== 'object' || Array.isArray(context)) {
    return undefined;
  }

  const labelMap: Record<string, string> = {
    stage: '当前阶段',
    weeks: '孕周',
    week: '孕周',
    babyAge: '宝宝年龄',
    ageMonths: '宝宝月龄',
    symptoms: '补充症状',
    notes: '补充说明',
  };

  const lines = Object.entries(context as Record<string, unknown>)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .slice(0, 8)
    .map(([key, value]) => `- ${labelMap[key] || key}：${String(value)}`);

  return lines.length > 0 ? `用户补充背景：\n${lines.join('\n')}` : undefined;
}

function getContextSignalText(context: unknown): string | undefined {
  if (!context) {
    return undefined;
  }

  if (typeof context === 'string') {
    const trimmed = context.trim();
    return trimmed || undefined;
  }

  if (typeof context !== 'object' || Array.isArray(context)) {
    return undefined;
  }

  const parts = Object.entries(context as Record<string, unknown>)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .slice(0, 8)
    .map(([key, value]) => `${key} ${String(value).trim()}`)
    .filter(Boolean);

  return parts.length > 0 ? parts.join('\n') : undefined;
}

function hasExplicitStageSignal(text?: string): boolean {
  return !!text && EXPLICIT_STAGE_PATTERNS.some((pattern) => pattern.test(text));
}

function hasChildcareSceneSignal(text?: string): boolean {
  return !!text && CHILDCARE_SCENE_PATTERNS.some((pattern) => pattern.test(text));
}

function hasExplicitStructuredContext(context: unknown): boolean {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    return false;
  }

  const record = context as Record<string, unknown>;
  return ['stage', 'weeks', 'week', 'babyAge', 'ageMonths'].some((key) => {
    const value = record[key];
    return value !== undefined && value !== null && value !== '';
  });
}

function shouldUseProfileHints(question: string, userContext: unknown): boolean {
  const contextSignals = getContextSignalText(userContext);
  return !hasExplicitStageSignal(question)
    && !hasExplicitStructuredContext(userContext)
    && !hasChildcareSceneSignal(question)
    && !hasChildcareSceneSignal(contextSignals);
}

function buildAnswerPolicy(question: string, userContext: unknown): string {
  const explicitStage = hasExplicitStageSignal(question) || hasExplicitStructuredContext(userContext);
  const childcareScene = hasChildcareSceneSignal(question) || hasChildcareSceneSignal(getContextSignalText(userContext));
  const lines = [
    '回答策略：',
    '- 以用户当前问题和本轮补充信息为优先。',
    '- 用户历史档案仅作辅助参考，可能不是最新状态。',
    '- 不能把模型记忆当成最终依据，优先使用检索到的参考资料。',
  ];

  if (explicitStage) {
    lines.push('- 本轮已明确给出阶段、孕周或月龄时，请以本轮描述为准。');
  } else if (childcareScene) {
    lines.push('- 本轮问题明显指向宝宝/儿童护理场景时，不要套用孕期档案。');
  } else {
    lines.push('- 若用户未明确说明阶段、孕周或月龄，可谨慎参考历史档案补充建议。');
  }

  return lines.join('\n');
}

function buildMergedContext(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join('\n\n');
}

async function resolveDomainDecision(
  question: string,
  options: {
    userId?: string;
    context?: unknown;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  },
): Promise<AIDomainDecision> {
  const initialDecision = classifyMaternalChildQuestion(question, {
    context: options.context,
    history: options.history,
  });

  if (initialDecision.status === 'in_scope' || !options.userId) {
    return initialDecision;
  }

  if (hasExcludedDomainSignal(question, { context: options.context, history: options.history })) {
    return initialDecision;
  }

  if (!hasHealthOrCareSignal(question, { context: options.context, history: options.history })) {
    return initialDecision;
  }

  const profileContext = await buildUserProfileContext(options.userId);
  const profileSignal = profileContext.retrievalHints.join('\n').trim();

  if (!profileSignal) {
    return initialDecision;
  }

  return hasMaternalChildSignal(profileSignal)
    ? { status: 'in_scope' }
    : initialDecision;
}

async function resolveKnowledge(question: string, userId?: string, userContext?: unknown) {
  const profileContext = await buildUserProfileContext(userId);
  const retrievalQuery = shouldUseProfileHints(question, userContext)
    ? [question, ...profileContext.retrievalHints].filter(Boolean).join(' ')
    : question;
  const knowledgePack = buildKnowledgePack(retrievalQuery, { limit: 3 });

  return {
    profileContext,
    knowledgePack,
    finalContext: buildMergedContext(
      buildAnswerPolicy(question, userContext),
      shouldUseProfileHints(question, userContext) ? profileContext.prompt : undefined,
      normalizeContext(userContext),
      knowledgePack.context,
    ),
  };
}

function inferSourceReliability(sources: SourceReference[]): TrustedSourceReliability {
  if (sources.length === 0) {
    return 'none';
  }

  const authoritativeCount = sources.filter((source) => source.authoritative).length;
  if (authoritativeCount === sources.length) {
    return 'authoritative';
  }

  if (authoritativeCount > 0) {
    return 'mixed';
  }

  return 'dataset_only';
}

function determineRiskLevel(question: string, context: unknown, results: KnowledgeSearchResult[]): TrustedRiskLevel {
  const signalText = [question, getContextSignalText(context)].filter(Boolean).join('\n');

  if (RED_RISK_PATTERNS.some((pattern) => pattern.test(signalText)) || isEmergencyQuestion(signalText)) {
    return 'red';
  }

  if (YELLOW_RISK_PATTERNS.some((pattern) => pattern.test(signalText))) {
    return 'yellow';
  }

  const resultRiskLevels = results
    .map((item) => item.sourceReference.riskLevelDefault)
    .filter((level): level is KnowledgeRiskLevel => Boolean(level));

  if (resultRiskLevels.includes('red')) {
    return 'red';
  }

  if (resultRiskLevels.includes('yellow')) {
    return 'yellow';
  }

  return 'green';
}

function buildUncertainty(
  sourceReliability: TrustedSourceReliability,
  sources: SourceReference[],
  question: string,
): TrustedUncertaintyInfo {
  if (sources.length === 0) {
    return {
      level: 'high',
      message: '当前没有检索到可支撑判断的参考来源，无法安全给出更具体的建议。',
    };
  }

  if (sourceReliability === 'dataset_only') {
    return {
      level: 'high',
      message: DATASET_ONLY_NOTICE,
    };
  }

  if (sourceReliability === 'mixed') {
    return {
      level: 'medium',
      message: '当前回答同时参考了权威来源和一般知识条目，如症状明显或持续加重，应以线下医生判断为准。',
    };
  }

  if (/检查单|化验单|报告|B超|彩超|CT|核磁/u.test(question)) {
    return {
      level: 'medium',
      message: '涉及检查结果解读时，线上信息只能辅助理解，不能替代医生结合体征和病史的正式判断。',
    };
  }

  return { level: 'none' };
}

function extractStructuredAnswerJson(raw: string): TrustedStructuredAnswer | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const withoutFence = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const firstBrace = withoutFence.indexOf('{');
  const lastBrace = withoutFence.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  const candidate = withoutFence.slice(firstBrace, lastBrace + 1);

  try {
    const parsed = JSON.parse(candidate) as {
      conclusion?: unknown;
      reasons?: unknown;
      actions?: unknown;
      when_to_seek_care?: unknown;
      uncertainty_note?: unknown;
    };

    return {
      conclusion: typeof parsed.conclusion === 'string' ? parsed.conclusion.trim() : '',
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map((item) => String(item).trim()).filter(Boolean) : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions.map((item) => String(item).trim()).filter(Boolean) : [],
      whenToSeekCare: Array.isArray(parsed.when_to_seek_care)
        ? parsed.when_to_seek_care.map((item) => String(item).trim()).filter(Boolean)
        : [],
      uncertaintyNote: typeof parsed.uncertainty_note === 'string' ? parsed.uncertainty_note.trim() : undefined,
    };
  } catch {
    return null;
  }
}

function dedupeLines(lines: string[]): string[] {
  return Array.from(new Set(lines.map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean)));
}

function buildFallbackActions(question: string, riskLevel: TrustedRiskLevel): string[] {
  if (/发烧|发热|高热/u.test(question)) {
    return dedupeLines([
      '先记录体温、精神状态、吃奶/进食和尿量变化。',
      '避免自行叠加用药或反复更换处理方式。',
      riskLevel === 'red' ? '不要继续居家等待，直接就医。' : '若体温持续升高或状态变差，尽快线下就医。',
    ]).slice(0, 3);
  }

  if (/出血|见红|流血/u.test(question)) {
    return dedupeLines([
      '记录出血量、颜色、持续时间以及是否伴随腹痛。',
      '减少不必要活动，不要自行处理或拖延观察。',
      riskLevel === 'red' ? '立即前往急诊或产科。' : '若量增多、颜色鲜红或伴腹痛，尽快就医。',
    ]).slice(0, 3);
  }

  if (/腹泻|拉肚子|呕吐|脱水/u.test(question)) {
    return dedupeLines([
      '关注进食、饮水、尿量和精神状态。',
      '先避免自行使用不明确药物。',
      '若出现明显脱水、尿少或精神差，尽快就医。',
    ]).slice(0, 3);
  }

  if (/咳嗽|呼吸|喘/u.test(question)) {
    return dedupeLines([
      '先观察呼吸是否费力、是否有喘憋或发青。',
      '记录症状持续时间以及是否影响吃奶/进食和睡眠。',
      riskLevel === 'red' ? '立即线下就医。' : '若呼吸加快、凹陷呼吸或精神差，尽快就医。',
    ]).slice(0, 3);
  }

  return dedupeLines([
    '先补充症状持续时间、对象阶段（孕周或月龄）和精神状态等关键信息。',
    '避免把线上信息当成诊断结论，也不要自行尝试高风险处理。',
    riskLevel === 'red' ? '现阶段以立即就医为先。' : '若症状持续、加重或您明显不放心，尽快线下就医。',
  ]).slice(0, 3);
}

function buildFallbackSeekCare(question: string, riskLevel: TrustedRiskLevel): string[] {
  if (riskLevel === 'red') {
    return ['现在就医，不建议继续线上等待或居家观察。'];
  }

  const lines = [
    '出现呼吸困难、抽搐、意识异常、大量出血等情况时立即就医。',
  ];

  if (/发烧|发热|高热/u.test(question)) {
    lines.push('体温持续升高、精神差、拒奶/拒食、尿量减少时尽快就医。');
  } else if (/出血|见红|流血/u.test(question)) {
    lines.push('出血量增多、颜色鲜红或伴明显腹痛时尽快就医。');
  } else {
    lines.push('症状持续不缓解、明显加重或出现新的高危信号时尽快就医。');
  }

  return dedupeLines(lines).slice(0, 3);
}

function buildFallbackReasons(results: KnowledgeSearchResult[], question: string, riskLevel: TrustedRiskLevel): string[] {
  const fromSources = results
    .slice(0, 2)
    .map((item) => item.sourceReference.excerpt || item.answer.replace(/\s+/g, ' ').slice(0, 80))
    .filter(Boolean)
    .map((text) => String(text).trim());

  if (fromSources.length > 0) {
    return dedupeLines(fromSources).slice(0, 3);
  }

  if (riskLevel === 'red') {
    return ['问题描述中包含高风险信号，线上信息无法替代急诊或专科现场评估。'];
  }

  if (/检查单|化验单|报告/u.test(question)) {
    return ['仅凭文字描述无法安全完成检查结果解读，仍需结合病史、体征和医生面诊。'];
  }

  return ['当前只能基于有限信息给出保守建议，无法把线上答复当作诊断或治疗方案。'];
}

function buildFallbackStructuredAnswer(params: {
  question: string;
  riskLevel: TrustedRiskLevel;
  triageCategory: TrustedTriageCategory;
  results: KnowledgeSearchResult[];
  uncertainty: TrustedUncertaintyInfo;
}): TrustedStructuredAnswer {
  const { question, riskLevel, triageCategory, results, uncertainty } = params;

  if (triageCategory === 'emergency') {
    return {
      conclusion: '这类情况属于高风险，现阶段最重要的是立即线下就医，而不是继续在线上详细分析。',
      reasons: ['问题描述中包含可能危及孕妇或宝宝安全的危险信号。'],
      actions: [
        '立即前往急诊、产科急诊或儿科急诊；必要时直接拨打 120。',
        '带上既往检查结果、用药信息和症状发生时间。',
      ],
      whenToSeekCare: ['现在就医，不建议继续居家观察。'],
      uncertaintyNote: '线上信息不能替代急诊评估，系统已优先触发安全止损。',
    };
  }

  if (triageCategory === 'out_of_scope') {
    return {
      conclusion: '当前问题不在母婴问题助手的支持范围内。',
      reasons: ['系统目前只回答备孕、孕期、产后、喂养、护理、发育和常见母婴症状相关问题。'],
      actions: ['请改用母婴相关表述重新提问，或直接咨询对应专业人士。'],
      whenToSeekCare: ['若现实中已经存在明显不适或急症，请直接线下就医。'],
      uncertaintyNote: '超出范围时，系统不会继续猜测或强行生成答案。',
    };
  }

  const conclusion = triageCategory === 'caution'
    ? '当前更适合先做谨慎观察，并结合升级条件决定是否尽快线下就医。'
    : '从现有信息看，更接近常见母婴知识或护理问题，但仍应按稳妥方式处理。';

  return {
    conclusion,
    reasons: buildFallbackReasons(results, question, riskLevel),
    actions: buildFallbackActions(question, riskLevel),
    whenToSeekCare: buildFallbackSeekCare(question, riskLevel),
    uncertaintyNote: uncertainty.message,
  };
}

function sanitizeStructuredAnswer(
  candidate: TrustedStructuredAnswer | null,
  fallback: TrustedStructuredAnswer,
  uncertainty: TrustedUncertaintyInfo,
): TrustedStructuredAnswer {
  if (!candidate) {
    return fallback;
  }

  const conclusion = candidate.conclusion.trim() || fallback.conclusion;
  const reasons = dedupeLines(candidate.reasons).slice(0, 3);
  const actions = dedupeLines(candidate.actions).slice(0, 3);
  const whenToSeekCare = dedupeLines(candidate.whenToSeekCare).slice(0, 3);

  return {
    conclusion,
    reasons: reasons.length > 0 ? reasons : fallback.reasons,
    actions: actions.length > 0 ? actions : fallback.actions,
    whenToSeekCare: whenToSeekCare.length > 0 ? whenToSeekCare : fallback.whenToSeekCare,
    uncertaintyNote: candidate.uncertaintyNote?.trim() || fallback.uncertaintyNote || uncertainty.message,
  };
}

function renderSources(sources: SourceReference[]): string[] {
  if (sources.length === 0) {
    return ['- 当前未检索到可用来源，系统已按保守规则处理，无法安全给出更具体判断。'];
  }

  return sources.slice(0, 3).map((source) => {
    const details = [
      source.sourceOrg || source.source,
      source.sourceType === 'authority' ? '权威来源' : (source.sourceType === 'dataset' ? '数据集/知识库' : '一般来源'),
      source.updatedAt ? `更新于 ${source.updatedAt.slice(0, 10)}` : undefined,
    ].filter(Boolean).join(' · ');

    return `- ${source.title}（${details}）`;
  });
}

function renderStructuredAnswer(answer: TrustedStructuredAnswer, sources: SourceReference[]): string {
  const sections = [
    '结论',
    answer.conclusion,
    '',
    '原因',
    ...(answer.reasons.length > 0 ? answer.reasons.map((item) => `- ${item}`) : ['- 当前信息有限，系统仅能给出保守说明。']),
    '',
    '建议动作',
    ...(answer.actions.length > 0 ? answer.actions.map((item) => `- ${item}`) : ['- 请补充更多关键信息或尽快就医。']),
    '',
    '何时就医',
    ...(answer.whenToSeekCare.length > 0 ? answer.whenToSeekCare.map((item) => `- ${item}`) : ['- 如症状明显、持续加重或您明显不放心，请尽快就医。']),
  ];

  if (answer.uncertaintyNote) {
    sections.push('', '不确定性说明', answer.uncertaintyNote);
  }

  sections.push('', '参考来源', ...renderSources(sources));
  return sections.join('\n');
}

function buildReferencePrompt(sources: SourceReference[]): string {
  if (sources.length === 0) {
    return '未检索到可用来源。';
  }

  return sources.slice(0, 3).map((source, index) => {
    return [
      `[参考 ${index + 1}]`,
      `标题：${source.title}`,
      `来源机构：${source.sourceOrg || source.source}`,
      `来源类型：${source.sourceType || 'unknown'}`,
      `主题：${source.topic || source.category || '未知'}`,
      `默认风险：${source.riskLevelDefault || 'yellow'}`,
      `更新时间：${source.updatedAt || '未知'}`,
      `摘录：${source.excerpt || '无'}`,
    ].join('\n');
  }).join('\n\n');
}

function buildHistoryPrompt(history?: Array<{ role: 'user' | 'assistant'; content: string }>): string {
  if (!history || history.length === 0) {
    return '无历史对话。';
  }

  return history
    .slice(-6)
    .map((message) => `${message.role === 'user' ? '用户' : '助手'}：${message.content}`)
    .join('\n');
}

function buildStructuredAnswerPayload(answer: TrustedStructuredAnswer): string {
  return JSON.stringify({
    conclusion: answer.conclusion,
    reasons: answer.reasons,
    actions: answer.actions,
    when_to_seek_care: answer.whenToSeekCare,
    uncertainty_note: answer.uncertaintyNote || '',
  }, null, 2);
}

function buildTaskModelMessages(params: {
  taskRole: AITaskModelRole;
  question: string;
  context?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  plan: RoutePlan;
  riskLevel: TrustedRiskLevel;
  triageCategory: TrustedTriageCategory;
  sourceReliability: TrustedSourceReliability;
  sources: SourceReference[];
  fallbackStructured: TrustedStructuredAnswer;
  currentDraft: TrustedStructuredAnswer;
}): Array<{ role: 'system' | 'user'; content: string }> {
  const taskInstructionMap: Record<AITaskModelRole, string[]> = {
    glm_classify: [
      '你负责低成本分类/澄清层。',
      '如果信息不足或来源弱，请优先输出需要补充的信息，而不是自由发挥。',
      '必要时可以先把检索信息压缩成简短结论，但不要扩写成长文，不要做确诊，不要给剂量。',
    ],
    kimi_reason: [
      '你负责高质量理解整合层。',
      '基于已有资料和中间草稿做条件判断与多来源归纳。',
      '如果资料不够，必须明确保守边界。',
    ],
    minimax_render: [
      '你负责最终中文表达层。',
      '在不改变安全边界和动作建议的前提下，让表达更自然、更适合用户阅读。',
      '不要新增未在草稿中出现的高风险动作或诊断结论。',
    ],
  };

  const systemPrompt = [
    '你在执行母婴可信 AI 的固定任务链。',
    `当前任务角色：${params.taskRole}`,
    '只允许输出一个 JSON 对象，不要输出 Markdown、代码块、解释或额外文字。',
    'JSON 必须严格包含这些键：conclusion, reasons, actions, when_to_seek_care, uncertainty_note。',
    '其中 reasons/actions/when_to_seek_care 都必须是字符串数组，每个数组 1 到 3 条。',
    '回答原则：',
    '- 优先服从 triage_category 和 risk_level。',
    '- 不得把模型记忆伪装成权威来源，不得编造来源。',
    '- 不要给出具体药物剂量、处方、诊断结论或确定性病名判断。',
    '- red 风险时，不要展开病因分析，直接突出立即就医动作。',
    '- 如果当前来源不是权威指南，uncertainty_note 必须明确说明这一点。',
    '- 如果信息不足，明确表达无法安全判断。',
    ...taskInstructionMap[params.taskRole],
  ].join('\n');

  const userPrompt = [
    `triage_category: ${params.triageCategory}`,
    `risk_level: ${params.riskLevel}`,
    `source_reliability: ${params.sourceReliability}`,
    `retrieval_tier: ${params.plan.retrievalTier}`,
    `complexity: ${params.plan.complexity}`,
    `route_reason: ${params.plan.reason}`,
    '',
    `当前问题：${params.question}`,
    '',
    '补充上下文：',
    params.context || '无',
    '',
    '历史对话：',
    buildHistoryPrompt(params.history),
    '',
    '参考资料：',
    buildReferencePrompt(params.sources),
    '',
    '系统兜底草稿：',
    buildStructuredAnswerPayload(params.fallbackStructured),
    '',
    '当前链路草稿：',
    buildStructuredAnswerPayload(params.currentDraft),
  ].join('\n');

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

async function executePlannedGeneration(params: {
  question: string;
  finalContext?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  plan: RoutePlan;
  riskLevel: TrustedRiskLevel;
  triageCategory: TrustedTriageCategory;
  sourceReliability: TrustedSourceReliability;
  sources: SourceReference[];
  fallbackStructured: TrustedStructuredAnswer;
  uncertainty: TrustedUncertaintyInfo;
}): Promise<{
  structuredAnswer: TrustedStructuredAnswer;
  degraded: boolean;
  routeInfo?: AIGatewayRouteInfo;
  routeSummary: string;
}> {
  let currentDraft = params.fallbackStructured;
  let degraded = false;
  let lastRouteInfo: AIGatewayRouteInfo | undefined;
  const executedSteps: string[] = [];

  for (const step of params.plan.executionPlan) {
    if (step === 'system') {
      executedSteps.push('system');
      continue;
    }

    try {
      const result = await callTaskModelDetailed(
        step,
        buildTaskModelMessages({
          taskRole: step,
          question: params.question,
          context: params.finalContext,
          history: params.history,
          plan: params.plan,
          riskLevel: params.riskLevel,
          triageCategory: params.triageCategory,
          sourceReliability: params.sourceReliability,
          sources: params.sources,
          fallbackStructured: params.fallbackStructured,
          currentDraft,
        }),
        {
          temperature: step === 'minimax_render' ? 0.35 : 0.15,
          maxTokens: step === 'glm_classify' ? 900 : 1200,
        },
      );

      currentDraft = sanitizeStructuredAnswer(
        extractStructuredAnswerJson(result.answer),
        currentDraft,
        params.uncertainty,
      );
      lastRouteInfo = result.route;
      executedSteps.push(step);
    } catch (error) {
      degraded = true;
      executedSteps.push(`${step}:fallback`);
      console.error(`[Trusted AI] Task step failed: ${step}`, error);
    }
  }

  return {
    structuredAnswer: currentDraft,
    degraded,
    routeInfo: lastRouteInfo,
    routeSummary: `${params.plan.executionPlan.join('>')}|${params.plan.retrievalTier}|${params.plan.complexity}|${executedSteps.join('>')}`,
  };
}

function estimateConfidence(
  sources: SourceReference[],
  sourceReliability: TrustedSourceReliability,
  riskLevel: TrustedRiskLevel,
): number {
  if (sources.length === 0) {
    return 0.22;
  }

  const base = Math.min(0.3 + (sources[0]?.relevance || 0) * 0.5, 0.82);
  const reliabilityBoost = sourceReliability === 'authoritative'
    ? 0.12
    : (sourceReliability === 'mixed' ? 0.04 : -0.1);
  const riskPenalty = riskLevel === 'green' ? 0 : (riskLevel === 'yellow' ? -0.08 : -0.16);

  return Math.max(0.2, Math.min(0.92, Number((base + reliabilityBoost + riskPenalty).toFixed(2))));
}

function buildDomainResult(decision: AIDomainDecision): TrustedAIResult {
  const triageCategory: TrustedTriageCategory = decision.status === 'needs_clarification' ? 'caution' : 'out_of_scope';
  const riskLevel: TrustedRiskLevel = decision.status === 'needs_clarification' ? 'yellow' : 'green';
  const uncertainty: TrustedUncertaintyInfo = {
    level: 'high',
    message: decision.status === 'needs_clarification'
      ? '对象、孕周/月龄或症状关键信息不足，当前不适合继续猜测。'
      : '超出支持范围时，系统不会继续生成看似完整但不可靠的答案。',
  };
  const structuredAnswer = buildFallbackStructuredAnswer({
    question: '',
    riskLevel,
    triageCategory,
    results: [],
    uncertainty,
  });
  const adjustedStructuredAnswer: TrustedStructuredAnswer = {
    ...structuredAnswer,
    conclusion: decision.status === 'needs_clarification'
      ? '当前信息不足，系统暂时无法安全判断。'
      : '当前问题不在母婴问题助手的支持范围内。',
    reasons: decision.answer
      ? decision.answer.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 3)
      : structuredAnswer.reasons,
  };

  return {
    answer: renderStructuredAnswer(adjustedStructuredAnswer, []),
    sources: [],
    isEmergency: false,
    triageCategory,
    riskLevel,
    structuredAnswer: adjustedStructuredAnswer,
    uncertainty,
    sourceReliability: 'none',
    disclaimer: decision.status === 'needs_clarification' ? CLARIFICATION_DISCLAIMER : OUT_OF_SCOPE_DISCLAIMER,
    followUpQuestions: [],
    confidence: 0.18,
    degraded: false,
    provider: 'system',
    route: decision.status,
    model: 'rule-based',
  };
}

export async function generateTrustedAIResponse(request: TrustedAIRequest): Promise<TrustedAIResult> {
  const question = request.question.trim();
  const domainDecision = await resolveDomainDecision(question, {
    userId: request.userId,
    context: request.context,
    history: request.history,
  });

  if (domainDecision.status !== 'in_scope') {
    return buildDomainResult(domainDecision);
  }

  const { knowledgePack, finalContext } = await resolveKnowledge(question, request.userId, request.context);
  const riskLevel = determineRiskLevel(question, request.context, knowledgePack.results);
  const triageCategory: TrustedTriageCategory = riskLevel === 'red' ? 'emergency' : (riskLevel === 'yellow' ? 'caution' : 'normal');
  const sourceReliability = inferSourceReliability(knowledgePack.sources);
  const routePlan = planTrustedAIRoute({
    question,
    userId: request.userId,
    riskLevel,
    triageCategory,
    sources: knowledgePack.sources,
    sourceReliability,
  });
  const uncertainty = buildUncertainty(sourceReliability, knowledgePack.sources, question);
  const fallbackStructured = buildFallbackStructuredAnswer({
    question,
    riskLevel,
    triageCategory,
    results: knowledgePack.results,
    uncertainty,
  });

  if (triageCategory === 'emergency') {
    const structuredAnswer = {
      ...fallbackStructured,
      conclusion: '这类情况属于高风险，现阶段最重要的是立即就医，而不是继续线上详细分析。',
    };

    return {
      answer: renderStructuredAnswer(structuredAnswer, knowledgePack.sources),
      sources: knowledgePack.sources,
      isEmergency: true,
      triageCategory,
      riskLevel,
      structuredAnswer,
      uncertainty: {
        level: 'high',
        message: '高风险问题已触发快速止损，系统不会继续展开细节分析。',
      },
      sourceReliability,
      disclaimer: EMERGENCY_DISCLAIMER,
      followUpQuestions: [],
      confidence: estimateConfidence(knowledgePack.sources, sourceReliability, riskLevel),
      degraded: false,
      provider: 'system',
      route: 'emergency',
      model: 'rule-based',
    };
  }

  if (knowledgePack.sources.length === 0) {
    const structuredAnswer = {
      ...fallbackStructured,
      conclusion: '当前没有检索到可支撑判断的来源，无法安全给出更具体的回答。',
    };

    return {
      answer: renderStructuredAnswer(structuredAnswer, knowledgePack.sources),
      sources: knowledgePack.sources,
      isEmergency: false,
      triageCategory,
      riskLevel,
      structuredAnswer,
      uncertainty,
      sourceReliability,
      disclaimer: CLARIFICATION_DISCLAIMER,
      followUpQuestions: knowledgePack.followUpQuestions,
      confidence: estimateConfidence(knowledgePack.sources, sourceReliability, riskLevel),
      degraded: true,
      provider: 'system',
      route: 'knowledge-miss',
      model: 'rule-based',
    };
  }

  const generation = await executePlannedGeneration({
    question,
    finalContext,
    history: request.history,
    plan: routePlan,
    riskLevel,
    triageCategory,
    sourceReliability,
    sources: knowledgePack.sources,
    fallbackStructured,
    uncertainty,
  });
  const structuredAnswer = generation.structuredAnswer;
  const degraded = generation.degraded;

  if ((sourceReliability === 'dataset_only' || sourceReliability === 'none') && !structuredAnswer.uncertaintyNote) {
    structuredAnswer.uncertaintyNote = DATASET_ONLY_NOTICE;
  }

  return {
    answer: renderStructuredAnswer(structuredAnswer, knowledgePack.sources),
    sources: knowledgePack.sources,
    isEmergency: false,
    triageCategory,
    riskLevel,
    structuredAnswer,
    uncertainty,
    sourceReliability,
    disclaimer: sourceReliability === 'authoritative' ? AI_DISCLAIMER : `${AI_DISCLAIMER} ${DATASET_ONLY_NOTICE}`,
    followUpQuestions: triageCategory === 'normal' ? knowledgePack.followUpQuestions : knowledgePack.followUpQuestions.slice(0, 2),
    confidence: estimateConfidence(knowledgePack.sources, sourceReliability, riskLevel),
    degraded,
    model: generation.routeInfo?.model || request.model || 'rule-based',
    provider: generation.routeInfo?.provider || (degraded ? 'system' : undefined),
    route: generation.routeInfo?.route
      ? `${generation.routeInfo.route}:${generation.routeSummary}`
      : (degraded ? `fallback:${generation.routeSummary}` : generation.routeSummary),
  };
}

export function chunkTrustedAnswer(answer: string, maxChunkLength = 90): string[] {
  const normalized = answer.trim();
  if (!normalized) {
    return [];
  }

  const lines = normalized.split('\n');
  const chunks: string[] = [];
  let current = '';

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length <= maxChunkLength || current.length === 0) {
      current = candidate;
      continue;
    }

    chunks.push(current);
    current = line;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

export function buildTrustedEmergencyPreview(): string {
  return getEmergencyResponse();
}
